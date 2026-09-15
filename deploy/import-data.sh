#!/usr/bin/env bash
# Sourced by deploy.sh; its production environment and deployment lock are reused.
import_database_psql() {
  local database="$1"
  shift
  "${compose[@]}" exec -T postgres psql -X -q -A -t --set ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" --dbname "$database" "$@"
}

rename_import_databases() {
  local current="$1" replacement="$2" saved="$3"
  import_database_psql postgres --set current="$current" --set replacement="$replacement" --set saved="$saved" <<'SQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname IN (:'current', :'replacement') AND pid <> pg_backend_pid();
BEGIN;
ALTER DATABASE :"current" RENAME TO :"saved";
ALTER DATABASE :"replacement" RENAME TO :"current";
COMMIT;
SQL
}

import_initial_data() (
  [[ "$EUID" -eq 0 ]] || die '数据导入请使用 sudo。'
  command -v python3 >/dev/null || die '数据导入需要 python3。'
  check_server_prerequisites
  ensure_runtime_directories
  read_release_state
  [[ -n "$CURRENT_BACKEND_IMAGE" && -n "$CURRENT_WEB_IMAGE" ]] || die '请先完成 bootstrap。'
  export BACKEND_IMAGE="$CURRENT_BACKEND_IMAGE" WEB_IMAGE="$CURRENT_WEB_IMAGE"
  local bundle stage_database saved_database failed_database path
  [[ -n "${1:-}" ]] || die '需要指定导入包目录。'
  bundle="$(readlink -f "$1")"
  [[ "$bundle" == "$(readlink -f "$deploy_dir")/data/"* && -d "$bundle" ]] || die '仅接受 deploy/data/ 下的导入包。'
  for path in "$bundle" "$bundle/source.dump" "$bundle/media.csv" "$bundle/manifest.json"; do
    [[ -e "$path" && ! -L "$path" ]] || die '导入文件缺失或为符号链接。'
    [[ "$(stat -c '%a' "$path")" == 600 || -d "$path" && "$(stat -c '%a' "$path")" == 700 ]] || die '导入目录权限须为 700，文件权限须为 600。'
  done
  stage_database="cqj_import_$(date -u +%Y%m%d%H%M%S)_$$"
  saved_database="cqj_before_import_$(date -u +%Y%m%d%H%M%S)_$$"
  failed_database="cqj_failed_import_$(date -u +%Y%m%d%H%M%S)_$$"
  local backend_stopped=false switched=false finished=false
  umask 077

  cleanup_initial_import() {
    local result="$?"
    trap - EXIT
    if [[ "$finished" != true && "$switched" == true ]]; then
      log '导入后检查失败，切回原服务器数据库'
      "${compose[@]}" stop backend >> "$bundle/operations.log" 2>&1 || true
      if ! rename_import_databases "$POSTGRES_DB" "$saved_database" "$failed_database" >> "$bundle/operations.log" 2>&1; then
        log "数据库回退失败；后端保持停止。原库：$saved_database；详见 $bundle/operations.log"
        exit 1
      fi
    fi
    if [[ "$finished" != true && "$backend_stopped" == true ]]; then
      if "${compose[@]}" up -d --no-deps backend >> "$bundle/operations.log" 2>&1 \
        && wait_for_service backend 180 >> "$bundle/operations.log" 2>&1; then
        "${compose[@]}" exec -T web nginx -t >> "$bundle/operations.log" 2>&1 \
          && "${compose[@]}" exec -T web nginx -s reload >> "$bundle/operations.log" 2>&1 \
          || log '原后端已恢复，但 Nginx 热加载失败，请检查导入日志。'
      else
        log '原后端启动失败，请检查导入日志。'
      fi
    fi
    [[ "$finished" == true ]] || log "导入未完成；当前数据库未被覆盖。导入临时库（若已创建）：$stage_database"
    exit "$result"
  }
  trap cleanup_initial_import EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  import_database_psql "$POSTGRES_DB" < "$deploy_dir/sql/data-import-snapshot.sql" > "$bundle/target-before.json"
  python3 "$deploy_dir/check-data-import.py" "$bundle" "$bundle/target-before.json"
  "${compose[@]}" exec -T postgres pg_restore --list < "$bundle/source.dump" > "$bundle/archive-list.txt"
  log "恢复本地备份到独立临时库：$stage_database"
  "${compose[@]}" exec -T postgres createdb --username "$POSTGRES_USER" "$stage_database"
  "${compose[@]}" exec -T postgres pg_restore --single-transaction --no-owner --no-acl \
    --username "$POSTGRES_USER" --dbname "$stage_database" < "$bundle/source.dump" > "$bundle/restore.log" 2>&1 || die "临时库恢复失败，原库未动；详见 $bundle/restore.log"
  import_database_psql "$stage_database" < "$deploy_dir/sql/data-import-snapshot.sql" > "$bundle/stage-before.json"
  python3 "$deploy_dir/check-data-import.py" "$bundle" "$bundle/target-before.json" "$bundle/stage-before.json"

  if [[ "${ADMIN_BOOTSTRAP_ENABLED:-false}" == true ]]; then
    cp -p "$environment_file" "$bundle/server-environment-before.env"
    python3 - "$environment_file" <<'PYTHON'
import os
from pathlib import Path
import re
import sys
import tempfile
path = Path(sys.argv[1])
metadata = path.stat()
text = path.read_text()
pattern = r'(?m)^[ \t]*(?:export[ \t]+)?ADMIN_BOOTSTRAP_ENABLED=.*$'
text, replacements = re.subn(pattern, 'ADMIN_BOOTSTRAP_ENABLED=false', text)
if not replacements:
    text = text.rstrip() + '\nADMIN_BOOTSTRAP_ENABLED=false\n'
descriptor, temporary = tempfile.mkstemp(prefix='.env.import-', dir=path.parent)
try:
    with os.fdopen(descriptor, 'w') as output:
        output.write(text)
    os.chown(temporary, metadata.st_uid, metadata.st_gid)
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
PYTHON
    export ADMIN_BOOTSTRAP_ENABLED=false
    log '已关闭一次性管理员初始化开关；管理员账号密码保持不变，原配置已备份。'
  fi
  log '临时库校验通过；暂停后端、备份服务器当前数据并保留服务器管理员'
  backend_stopped=true
  "${compose[@]}" stop backend >> "$bundle/operations.log" 2>&1
  create_backup
  printf '%s\n' "$LAST_BACKUP_FILE" > "$bundle/server-backup-path.txt"
  import_database_psql "$POSTGRES_DB" < "$deploy_dir/sql/data-import-snapshot.sql" > "$bundle/target-frozen.json"
  python3 "$deploy_dir/check-data-import.py" "$bundle" "$bundle/target-frozen.json" "$bundle/stage-before.json"
  import_database_psql "$POSTGRES_DB" --command 'COPY public.admin_account TO STDOUT WITH (FORMAT csv)' > "$bundle/server-admin.csv"
  "${compose[@]}" exec -T postgres pg_dump --data-only --column-inserts --no-owner --no-acl \
    --table public.admin_audit_event --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" > "$bundle/server-audit.sql"
  {
    sed -n '1,$p' "$deploy_dir/sql/transform-data-import.sql"
    sed -n '1,$p' "$bundle/server-admin.csv"
    printf '\\.\n'
    sed -n '1,$p' "$deploy_dir/sql/finish-data-import.sql"
    sed -n '1,$p' "$bundle/media.csv"
    printf '\\.\n'
    sed -n '1,$p' "$deploy_dir/sql/validate-data-import.sql"
  } | import_database_psql "$stage_database" --set import_prefix="$COS_OBJECT_PREFIX" > "$bundle/transform.log" 2>&1 || die "临时库转换失败，原库未动；详见 $bundle/transform.log"
  import_database_psql "$stage_database" < "$bundle/server-audit.sql" >> "$bundle/transform.log" 2>&1 || die '保留服务器审计记录失败，取消导入。'
  import_database_psql "$stage_database" < "$deploy_dir/sql/data-import-snapshot.sql" > "$bundle/stage-final.json"
  "${compose[@]}" exec -T postgres pg_dump --format custom --no-owner --no-acl \
    --username "$POSTGRES_USER" --dbname "$stage_database" > "$bundle/imported-final.dump"
  "${compose[@]}" exec -T postgres pg_restore --list < "$bundle/imported-final.dump" >/dev/null

  log '切换数据库；原服务器数据库将保留，不删除'
  rename_import_databases "$POSTGRES_DB" "$stage_database" "$saved_database" >> "$bundle/operations.log" 2>&1
  switched=true
  "${compose[@]}" up -d --no-deps backend >> "$bundle/operations.log" 2>&1
  wait_for_service backend 180 || die '导入后后端健康检查失败。'
  # Recreating backend can change its Docker IP; refresh Nginx's upstream resolution.
  "${compose[@]}" exec -T web nginx -t >> "$bundle/operations.log" 2>&1
  "${compose[@]}" exec -T web nginx -s reload >> "$bundle/operations.log" 2>&1
  check_external_health || die '导入后应用健康检查失败。'
  import_database_psql "$POSTGRES_DB" < "$deploy_dir/sql/data-import-snapshot.sql" > "$bundle/production-final.json"
  python3 - "$bundle/stage-final.json" "$bundle/production-final.json" <<'PYTHON'
import json
import sys
with open(sys.argv[1]) as source, open(sys.argv[2]) as target:
    before, after = json.load(source), json.load(target)
for table in ("content_entry", "content_revision", "content_revision_media", "media_asset", "app_user", "user_phone", "wechat_identity", "scenic_stats", "scenic_view_receipt", "admin_account"):
    assert before["tables"][table] == after["tables"][table], f"Post-cutover verification failed: {table}"
print("Imported business data, users, media references and preserved server administrator verified.")
PYTHON
  printf 'ORIGINAL_DATABASE=%s\nSERVER_BACKUP=%s\nCOMPLETED_AT=%s\n' \
    "$saved_database" "$LAST_BACKUP_FILE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$bundle/completed.txt"
  finished=true
  log "数据导入完成；原服务器库保留为 $saved_database；导入记录：$bundle"
)
