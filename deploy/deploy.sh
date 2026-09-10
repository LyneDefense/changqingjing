#!/usr/bin/env bash
set -Eeuo pipefail

deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$deploy_dir/.." && pwd)"
environment_file="$deploy_dir/.env.production"
compose_file="$deploy_dir/compose.production.yaml"
backup_dir="$deploy_dir/backups"
release_state_file="$deploy_dir/.release-state"
lock_file="$deploy_dir/.deploy.lock"
compose=(docker compose --project-directory "$deploy_dir" --env-file "$environment_file" --file "$compose_file")

log() {
  printf '[changqingjing] %s\n' "$*"
}

die() {
  printf '[changqingjing] ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage: ./deploy.sh <command>

Commands:
  bootstrap             首次检查服务器、建库迁移、申请证书并安装全部运维定时器
  deploy                备份、迁移、发布、健康检查，失败时自动回退应用镜像
  backup                立即生成并校验一份 PostgreSQL 备份
  restore-check [file]  把指定或最新备份恢复到临时数据库并校验，然后删除临时库
  rollback              切换到上一个成功发布的应用镜像
  renew-cert            续签证书，通过 nginx -t 后重新加载
  renew-cert --dry-run  执行 Let's Encrypt 续签演练
  status                显示容器、HTTPS 健康和证书有效期
USAGE
}

load_environment() {
  [[ -f "$environment_file" ]] || die "缺少 $environment_file；请先复制 .env.production.example 并填写真实值。"

  local mode
  mode="$(stat -c '%a' "$environment_file")"
  if (( (8#$mode & 077) != 0 )); then
    die "$environment_file 权限过宽（当前 $mode）；请执行 chmod 600。"
  fi

  set -a
  # shellcheck disable=SC1090
  source "$environment_file"
  set +a

  local required=(
    DOMAIN SERVER_PUBLIC_IP CERTBOT_EMAIL POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD
    BACKEND_IMAGE WEB_IMAGE WECHAT_APP_ID WECHAT_APP_SECRET APP_PHONE_ENCRYPTION_KEY_BASE64
    COS_BUCKET COS_REGION COS_SECRET_ID COS_SECRET_KEY COS_OBJECT_PREFIX
  )
  local key value
  for key in "${required[@]}"; do
    value="${!key:-}"
    [[ -n "$value" ]] || die "$environment_file 中缺少 $key。"
    [[ "$value" != *CHANGE_ME* && "$value" != *change-me* ]] || die "$key 仍是示例占位值。"
  done

  export VITE_TENCENT_MAP_KEY="${VITE_TENCENT_MAP_KEY:-}"
  export VITE_TENCENT_MAP_REFERER="${VITE_TENCENT_MAP_REFERER:-changqingjing-admin}"

  [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ && "$DOMAIN" == *.* ]] || die "DOMAIN 格式无效。"
  [[ "$SERVER_PUBLIC_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || die "SERVER_PUBLIC_IP 必须是服务器公网 IPv4。"
  [[ "$CERTBOT_EMAIL" == *@*.* ]] || die "CERTBOT_EMAIL 格式无效。"
  [[ ${#POSTGRES_PASSWORD} -ge 20 ]] || die "POSTGRES_PASSWORD 至少需要 20 位。"
  [[ "$COS_OBJECT_PREFIX" != "dev" && "$COS_OBJECT_PREFIX" != "local" ]] || die "生产 COS_OBJECT_PREFIX 不能使用 dev 或 local。"
  validate_image_reference "$BACKEND_IMAGE" BACKEND_IMAGE
  validate_image_reference "$WEB_IMAGE" WEB_IMAGE

  local decoded_length
  if ! decoded_length="$(printf '%s' "$APP_PHONE_ENCRYPTION_KEY_BASE64" | base64 --decode 2>/dev/null | wc -c | tr -d '[:space:]')"; then
    die "APP_PHONE_ENCRYPTION_KEY_BASE64 不是有效 Base64。"
  fi
  [[ "$decoded_length" == "32" ]] || die "APP_PHONE_ENCRYPTION_KEY_BASE64 解码后必须正好是 32 字节。"

  case "${ADMIN_BOOTSTRAP_ENABLED:-false}" in
    true)
      [[ -n "${ADMIN_BOOTSTRAP_LOGIN_NAME:-}" && -n "${ADMIN_BOOTSTRAP_DISPLAY_NAME:-}" ]] || die "首次管理员初始化缺少登录名或显示名。"
      [[ ${#ADMIN_BOOTSTRAP_PASSWORD} -ge 12 && "$ADMIN_BOOTSTRAP_PASSWORD" =~ [[:alpha:]] && "$ADMIN_BOOTSTRAP_PASSWORD" =~ [[:digit:]] ]] || die "首次管理员密码需为 12～128 位并同时包含字母和数字。"
      ;;
    false) ;;
    *) die "ADMIN_BOOTSTRAP_ENABLED 只能是 true 或 false。" ;;
  esac

  BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
  [[ "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ && "$BACKUP_RETENTION_DAYS" -ge 1 ]] || die "BACKUP_RETENTION_DAYS 必须是正整数。"
}

validate_image_reference() {
  local image="$1"
  local name="$2"
  [[ "$image" =~ ^[A-Za-z0-9._/@:-]+$ ]] || die "$name 不是有效镜像引用。"
  [[ "$image" != *:latest ]] || die "$name 不允许使用 latest，请使用可追溯版本标签。"
  [[ "$image" == *:* || "$image" == *@sha256:* ]] || die "$name 必须包含版本标签或 digest。"
}

acquire_lock() {
  exec 9>"$lock_file"
  flock -n 9 || die "已有部署或备份任务正在运行。"
}

ensure_runtime_directories() {
  mkdir -p "$backup_dir" "$deploy_dir/certbot/conf" "$deploy_dir/certbot/www/.well-known/acme-challenge"
  chmod 700 "$backup_dir" "$deploy_dir/certbot/conf"
}

check_server_prerequisites() {
  [[ -r /etc/os-release ]] || die "无法识别服务器操作系统。"
  # shellcheck disable=SC1091
  source /etc/os-release
  [[ "${ID:-}" == "ubuntu" ]] || die "bootstrap 仅支持 Ubuntu；当前系统是 ${ID:-unknown}。"

  local command_name
  for command_name in docker curl getent ss openssl flock systemctl base64 sudo; do
    command -v "$command_name" >/dev/null || die "缺少命令：$command_name。"
  done
  docker info >/dev/null || die "Docker 服务不可用，或当前用户没有 Docker 权限。"
  docker compose version >/dev/null || die "缺少 Docker Compose v2 插件。"

  local resolved_ips
  resolved_ips="$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u)"
  [[ -n "$resolved_ips" ]] || die "域名 $DOMAIN 尚无 IPv4 解析。"
  grep -Fxq "$SERVER_PUBLIC_IP" <<<"$resolved_ips" || die "域名 $DOMAIN 未解析到 SERVER_PUBLIC_IP=$SERVER_PUBLIC_IP；当前为：$resolved_ips"

  if [[ -z "$("${compose[@]}" ps -q web 2>/dev/null || true)" ]] && ss -H -ltn | awk '{print $4}' | grep -Eq '(^|:)(80|443)$'; then
    die "80 或 443 端口已被其他进程占用。"
  fi
}

pull_runtime_images() {
  log "拉取 PostgreSQL、Flyway 和 Certbot 基础镜像"
  "${compose[@]}" pull postgres migrate certbot
}

CURRENT_BACKEND_IMAGE=""
CURRENT_WEB_IMAGE=""
PREVIOUS_BACKEND_IMAGE=""
PREVIOUS_WEB_IMAGE=""

read_release_state() {
  CURRENT_BACKEND_IMAGE=""
  CURRENT_WEB_IMAGE=""
  PREVIOUS_BACKEND_IMAGE=""
  PREVIOUS_WEB_IMAGE=""
  [[ -f "$release_state_file" ]] || return 0

  local state_key state_value
  while IFS='=' read -r state_key state_value; do
    case "$state_key" in
      CURRENT_BACKEND_IMAGE) CURRENT_BACKEND_IMAGE="$state_value" ;;
      CURRENT_WEB_IMAGE) CURRENT_WEB_IMAGE="$state_value" ;;
      PREVIOUS_BACKEND_IMAGE) PREVIOUS_BACKEND_IMAGE="$state_value" ;;
      PREVIOUS_WEB_IMAGE) PREVIOUS_WEB_IMAGE="$state_value" ;;
    esac
  done < "$release_state_file"

  [[ -z "$CURRENT_BACKEND_IMAGE" ]] || validate_image_reference "$CURRENT_BACKEND_IMAGE" CURRENT_BACKEND_IMAGE
  [[ -z "$CURRENT_WEB_IMAGE" ]] || validate_image_reference "$CURRENT_WEB_IMAGE" CURRENT_WEB_IMAGE
  [[ -z "$PREVIOUS_BACKEND_IMAGE" ]] || validate_image_reference "$PREVIOUS_BACKEND_IMAGE" PREVIOUS_BACKEND_IMAGE
  [[ -z "$PREVIOUS_WEB_IMAGE" ]] || validate_image_reference "$PREVIOUS_WEB_IMAGE" PREVIOUS_WEB_IMAGE
}

write_release_state() {
  local current_backend="$1"
  local current_web="$2"
  local previous_backend="$3"
  local previous_web="$4"
  local revision="unknown"
  revision="$(git -C "$repository_root" rev-parse --verify HEAD 2>/dev/null || printf 'unknown')"

  local temporary_state
  temporary_state="$(mktemp "$deploy_dir/.release-state.XXXXXX")"
  chmod 600 "$temporary_state"
  {
    printf 'CURRENT_BACKEND_IMAGE=%s\n' "$current_backend"
    printf 'CURRENT_WEB_IMAGE=%s\n' "$current_web"
    printf 'PREVIOUS_BACKEND_IMAGE=%s\n' "$previous_backend"
    printf 'PREVIOUS_WEB_IMAGE=%s\n' "$previous_web"
    printf 'SOURCE_REVISION=%s\n' "$revision"
    printf 'DEPLOYED_AT=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$temporary_state"
  mv "$temporary_state" "$release_state_file"
}

build_release_images() {
  local services=()
  [[ "$BACKEND_IMAGE" == "$CURRENT_BACKEND_IMAGE" ]] || services+=(backend)
  [[ "$WEB_IMAGE" == "$CURRENT_WEB_IMAGE" ]] || services+=(web)
  if (( ${#services[@]} == 0 )); then
    die "BACKEND_IMAGE 和 WEB_IMAGE 都与当前版本相同；请至少为变更项设置新的可追溯标签。"
  fi
  log "构建发布镜像：${services[*]}"
  "${compose[@]}" build --pull "${services[@]}"
}

wait_for_service() {
  local service="$1"
  local timeout_seconds="${2:-180}"
  local deadline=$((SECONDS + timeout_seconds))
  local container_id status
  while (( SECONDS < deadline )); do
    container_id="$("${compose[@]}" ps -q "$service")"
    if [[ -n "$container_id" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
      case "$status" in
        healthy|running)
          log "$service 已就绪"
          return 0
          ;;
        unhealthy|exited|dead)
          "${compose[@]}" logs --tail 100 "$service" >&2 || true
          return 1
          ;;
      esac
    fi
    sleep 3
  done
  "${compose[@]}" logs --tail 100 "$service" >&2 || true
  return 1
}

run_migrations() {
  log "执行 Flyway 数据库迁移"
  "${compose[@]}" run --rm migrate
}

LAST_BACKUP_FILE=""

create_backup() {
  local timestamp temporary_file
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  LAST_BACKUP_FILE="$backup_dir/changqingjing-$timestamp.dump"
  temporary_file="$LAST_BACKUP_FILE.incomplete"

  log "备份 PostgreSQL 到 $LAST_BACKUP_FILE"
  if ! "${compose[@]}" exec -T postgres pg_dump \
    --format=custom --no-owner --no-acl \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" > "$temporary_file"; then
    rm -f "$temporary_file"
    die "PostgreSQL 备份失败。"
  fi
  [[ -s "$temporary_file" ]] || { rm -f "$temporary_file"; die "PostgreSQL 备份为空。"; }
  if ! "${compose[@]}" exec -T postgres pg_restore --list < "$temporary_file" >/dev/null; then
    rm -f "$temporary_file"
    die "PostgreSQL 备份校验失败。"
  fi
  chmod 600 "$temporary_file"
  mv "$temporary_file" "$LAST_BACKUP_FILE"
  find "$backup_dir" -type f -name 'changqingjing-*.dump' -mtime "+$BACKUP_RETENTION_DAYS" -delete
  log "备份已生成并通过归档校验"
}

check_external_health() {
  curl --fail --silent --show-error \
    --retry 20 --retry-delay 3 --retry-all-errors \
    --connect-timeout 5 --max-time 10 \
    "https://$DOMAIN/healthz" >/dev/null
}

rollback_services_to() {
  local backend_image="$1"
  local web_image="$2"
  [[ -n "$backend_image" && -n "$web_image" ]] || return 1
  log "回退应用到 $backend_image 和 $web_image"
  BACKEND_IMAGE="$backend_image" WEB_IMAGE="$web_image" "${compose[@]}" up -d --no-deps backend
  wait_for_service backend 180
  BACKEND_IMAGE="$backend_image" WEB_IMAGE="$web_image" "${compose[@]}" up -d --no-deps web
  wait_for_service web 120
  check_external_health
}

install_operations_timers() {
  [[ "$deploy_dir" =~ ^/[A-Za-z0-9._/-]+$ ]] || die "部署目录含 systemd 不支持的字符：$deploy_dir"
  local unit temporary_unit service_user
  service_user="${SUDO_USER:-$(id -un)}"
  [[ "$service_user" =~ ^[A-Za-z_][A-Za-z0-9_-]*$ ]] || die "无法确定安全的 systemd 运行用户。"
  local units=(
    changqingjing-cert-renew.service changqingjing-cert-renew.timer
    changqingjing-backup.service changqingjing-backup.timer
    changqingjing-monitor.service changqingjing-monitor.timer
  )
  for unit in "${units[@]}"; do
    temporary_unit="$(mktemp)"
    sed -e "s|@@DEPLOY_DIR@@|$deploy_dir|g" \
      -e "s|@@DEPLOY_SCRIPT@@|$deploy_dir/deploy.sh|g" \
      -e "s|@@SERVICE_USER@@|$service_user|g" \
      "$deploy_dir/systemd/$unit" > "$temporary_unit"
    sudo install -m 0644 "$temporary_unit" "/etc/systemd/system/$unit"
    rm -f "$temporary_unit"
  done
  sudo systemctl daemon-reload
  sudo systemctl enable --now \
    changqingjing-cert-renew.timer changqingjing-backup.timer changqingjing-monitor.timer
  log "证书续签、每日备份和健康监控定时器已启用"
}

check_acme_route() {
  local token_file token
  token="bootstrap-$PPID-$(date +%s)"
  token_file="$deploy_dir/certbot/www/.well-known/acme-challenge/$token"
  printf '%s' "$token" > "$token_file"
  if ! curl --fail --silent --show-error --connect-timeout 5 --max-time 10 \
    --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/.well-known/acme-challenge/$token" | grep -Fxq "$token"; then
    rm -f "$token_file"
    die "本机 Nginx ACME webroot 检查失败。"
  fi
  if ! curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
    "http://$DOMAIN/.well-known/acme-challenge/$token" | grep -Fxq "$token"; then
    rm -f "$token_file"
    die "公网无法通过 80 端口访问 ACME webroot；请检查安全组、防火墙和 DNS。"
  fi
  rm -f "$token_file"
}

request_first_certificate() {
  if [[ -f "$deploy_dir/certbot/conf/live/$DOMAIN/fullchain.pem" ]]; then
    log "已有证书，跳过首次申请"
    return 0
  fi
  local staging=()
  [[ "${CERTBOT_STAGING:-false}" == "true" ]] && staging+=(--staging)
  log "向 Let's Encrypt 申请 $DOMAIN 的首次证书"
  "${compose[@]}" run --rm certbot certonly \
    --webroot --webroot-path /var/www/certbot \
    --domain "$DOMAIN" --email "$CERTBOT_EMAIL" \
    --agree-tos --no-eff-email --non-interactive "${staging[@]}"
}

bootstrap() {
  check_server_prerequisites
  ensure_runtime_directories
  read_release_state
  pull_runtime_images
  build_release_images

  "${compose[@]}" up -d postgres
  wait_for_service postgres 120 || die "PostgreSQL 未就绪。"
  run_migrations
  "${compose[@]}" up -d --no-deps backend
  wait_for_service backend 180 || die "后端未就绪。"
  "${compose[@]}" up -d --no-deps web
  wait_for_service web 120 || die "Nginx 未就绪。"
  check_acme_route
  request_first_certificate
  "${compose[@]}" up -d --force-recreate --no-deps web
  wait_for_service web 120 || die "HTTPS Nginx 未就绪。"
  check_external_health || die "HTTPS 健康检查失败。"
  create_backup
  write_release_state "$BACKEND_IMAGE" "$WEB_IMAGE" "" ""
  install_operations_timers
  log "首次部署完成：https://$DOMAIN/admin/"
}

deploy_release() {
  [[ "${ADMIN_BOOTSTRAP_ENABLED:-false}" == "false" ]] || die "日常发布前必须把 ADMIN_BOOTSTRAP_ENABLED 改回 false。"
  [[ -f "$deploy_dir/certbot/conf/live/$DOMAIN/fullchain.pem" ]] || die "尚无 HTTPS 证书，请先执行 bootstrap。"
  ensure_runtime_directories
  read_release_state
  [[ -n "$CURRENT_BACKEND_IMAGE" && -n "$CURRENT_WEB_IMAGE" ]] || die "缺少上一次成功发布记录，请先执行 bootstrap。"
  pull_runtime_images
  build_release_images

  "${compose[@]}" up -d postgres
  wait_for_service postgres 120 || die "PostgreSQL 未就绪。"
  create_backup
  run_migrations

  log "更新后端"
  if ! "${compose[@]}" up -d --no-deps backend || ! wait_for_service backend 180; then
    rollback_services_to "$CURRENT_BACKEND_IMAGE" "$CURRENT_WEB_IMAGE" || true
    die "新后端未通过健康检查，应用已尝试回退；数据库迁移不会自动回滚。"
  fi

  log "更新管理后台与 Nginx"
  if ! "${compose[@]}" up -d --no-deps web || ! wait_for_service web 120 || ! check_external_health; then
    rollback_services_to "$CURRENT_BACKEND_IMAGE" "$CURRENT_WEB_IMAGE" || true
    die "新版本未通过外部健康检查，应用已尝试回退；数据库迁移不会自动回滚。"
  fi

  write_release_state "$BACKEND_IMAGE" "$WEB_IMAGE" "$CURRENT_BACKEND_IMAGE" "$CURRENT_WEB_IMAGE"
  log "发布完成：https://$DOMAIN/admin/"
}

backup_now() {
  ensure_runtime_directories
  "${compose[@]}" up -d postgres
  wait_for_service postgres 120 || die "PostgreSQL 未就绪。"
  create_backup
}

restore_check() {
  ensure_runtime_directories
  local requested_file="${1:-}"
  if [[ -z "$requested_file" ]]; then
    requested_file="$(find "$backup_dir" -maxdepth 1 -type f -name 'changqingjing-*.dump' | sort | tail -n 1)"
  fi
  [[ -n "$requested_file" && -f "$requested_file" ]] || die "没有可用于恢复演练的备份。"

  local resolved_file resolved_backup_dir
  resolved_file="$(readlink -f "$requested_file")"
  resolved_backup_dir="$(readlink -f "$backup_dir")"
  [[ "$resolved_file" == "$resolved_backup_dir"/* ]] || die "恢复演练只接受 $backup_dir 内的备份。"
  "${compose[@]}" exec -T postgres pg_restore --list < "$resolved_file" >/dev/null || die "备份归档校验失败。"

  local temporary_database table_count
  temporary_database="restore_check_$(date -u +%Y%m%d%H%M%S)_$$"
  log "恢复到临时数据库 $temporary_database"
  "${compose[@]}" exec -T postgres createdb --username "$POSTGRES_USER" "$temporary_database"
  if ! "${compose[@]}" exec -T postgres pg_restore \
    --exit-on-error --no-owner --no-acl \
    --username "$POSTGRES_USER" --dbname "$temporary_database" < "$resolved_file"; then
    "${compose[@]}" exec -T postgres dropdb --if-exists --force --username "$POSTGRES_USER" "$temporary_database" || true
    die "备份恢复失败。"
  fi
  table_count="$("${compose[@]}" exec -T postgres psql --username "$POSTGRES_USER" --dbname "$temporary_database" --tuples-only --no-align --command "select count(*) from information_schema.tables where table_schema = 'public';")"
  "${compose[@]}" exec -T postgres dropdb --if-exists --force --username "$POSTGRES_USER" "$temporary_database"
  [[ "$table_count" =~ ^[1-9][0-9]*$ ]] || die "恢复后的临时数据库没有业务表。"
  log "恢复演练通过，共检查到 $table_count 张 public 表；临时数据库已删除"
}

rollback_release() {
  read_release_state
  [[ -n "$PREVIOUS_BACKEND_IMAGE" && -n "$PREVIOUS_WEB_IMAGE" ]] || die "没有可回退的上一版应用镜像。"
  rollback_services_to "$PREVIOUS_BACKEND_IMAGE" "$PREVIOUS_WEB_IMAGE" || die "回退版本未通过健康检查。"
  write_release_state "$PREVIOUS_BACKEND_IMAGE" "$PREVIOUS_WEB_IMAGE" "$CURRENT_BACKEND_IMAGE" "$CURRENT_WEB_IMAGE"
  log "应用回退完成；数据库保持当前迁移版本。"
}

renew_certificate() {
  local dry_run="${1:-}"
  [[ -f "$deploy_dir/certbot/conf/live/$DOMAIN/fullchain.pem" ]] || die "找不到 $DOMAIN 的现有证书。"
  local extra=()
  [[ "$dry_run" == "--dry-run" ]] && extra+=(--dry-run)
  [[ -z "$dry_run" || "$dry_run" == "--dry-run" ]] || die "renew-cert 只接受可选参数 --dry-run。"
  "${compose[@]}" run --rm certbot renew \
    --webroot --webroot-path /var/www/certbot --non-interactive "${extra[@]}"
  "${compose[@]}" exec -T web nginx -t
  "${compose[@]}" exec -T web nginx -s reload
  log "证书续签${dry_run:+演练}完成，Nginx 配置有效并已重新加载"
}

show_status() {
  "${compose[@]}" ps
  if check_external_health; then
    log "HTTPS 健康检查通过"
  else
    log "HTTPS 健康检查失败"
  fi
  openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" </dev/null 2>/dev/null \
    | openssl x509 -noout -subject -issuer -dates || true
  if [[ -f "$release_state_file" ]]; then
    grep -E '^(CURRENT_|PREVIOUS_|SOURCE_REVISION|DEPLOYED_AT)' "$release_state_file"
  fi
}

main() {
  local command="${1:-}"
  case "$command" in
    bootstrap|deploy|backup|restore-check|rollback|renew-cert|status) ;;
    -h|--help|help|"") usage; exit 0 ;;
    *) usage >&2; die "未知命令：$command" ;;
  esac

  load_environment
  acquire_lock
  case "$command" in
    bootstrap) bootstrap ;;
    deploy) deploy_release ;;
    backup) backup_now ;;
    restore-check) restore_check "${2:-}" ;;
    rollback) rollback_release ;;
    renew-cert) renew_certificate "${2:-}" ;;
    status) show_status ;;
  esac
}

main "$@"
