#!/usr/bin/env bash
set -Eeuo pipefail
test_deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_directory="$(mktemp -d)"
test_container=''
cleanup() {
  [[ -z "$test_container" ]] || docker rm -f "$test_container" >/dev/null 2>&1 || true
  rm -rf "$test_directory"
}
trap cleanup EXIT
umask 077
# No host ports, no network, no persistent volumes, no production/local business data.
test_container="$(docker run --detach --pull=never --network none --env POSTGRES_PASSWORD=isolated-test-only \
  --tmpfs /var/lib/postgresql/data postgres:16-alpine)"
for attempt in {1..30}; do
  docker exec "$test_container" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
import_database_psql() {
  local database="$1"; shift
  docker exec -i "$test_container" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$database" "$@"
}
source "$test_deploy_dir/import-data.sh"
# Use the isolated container instead of production Compose.
import_database_psql() {
  local database="$1"; shift
  docker exec -i "$test_container" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$database" "$@"
}
for database in source_fixture target_fixture; do
  docker exec "$test_container" createdb -U postgres "$database"
  while IFS= read -r migration; do
    import_database_psql "$database" < "$migration"
  done < <(find "$test_deploy_dir/../backend/src/main/resources/db/migration" -name 'V*__*.sql' | sort -V)
  import_database_psql "$database" <<'SQL'
CREATE TABLE flyway_schema_history(installed_rank int, version text, checksum int, success boolean);
INSERT INTO flyway_schema_history VALUES (1, '1', 100, true);
SQL
done
import_database_psql source_fixture <<'SQL'
INSERT INTO admin_account(id, login_name, login_name_normalized, password_hash, display_name, role, password_changed_at)
VALUES ('10000000-0000-0000-0000-000000000001', 'admin', 'admin', 'local-hash-not-for-production', 'Local', 'ADMIN', now());
INSERT INTO app_user(id) VALUES ('10000000-0000-0000-0000-000000000002');
INSERT INTO media_asset(id,object_key,original_filename,media_type,content_type,size_bytes,etag,status,purpose,uploaded_by,verified_at,upload_expires_at)
VALUES ('10000000-0000-0000-0000-000000000003','dev/fixture.png','fixture.png','IMAGE','image/png',42,'source-etag','READY','PRODUCT','10000000-0000-0000-0000-000000000001',now(),now());
INSERT INTO media_asset(id,object_key,original_filename,media_type,content_type,size_bytes,etag,status,purpose,uploaded_by_app_user,verified_at,upload_expires_at)
VALUES ('10000000-0000-0000-0000-000000000004','dev/avatar.png','avatar.png','IMAGE','image/png',42,'avatar-etag','READY','APP_AVATAR','10000000-0000-0000-0000-000000000002',now(),now());
UPDATE app_user SET avatar_media_id='10000000-0000-0000-0000-000000000004';
INSERT INTO content_entry(id,kind,created_by,updated_by) VALUES ('10000000-0000-0000-0000-000000000005','PRODUCT','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO content_revision(id,entry_id,revision_no,title,cover_media_id,created_by) VALUES ('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000005',1,'Fixture','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001');
UPDATE content_entry SET draft_revision_id='10000000-0000-0000-0000-000000000006',published_revision_id='10000000-0000-0000-0000-000000000006',visibility='PUBLISHED';
INSERT INTO content_revision_media VALUES ('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000003','COVER',0);
INSERT INTO app_session(id,token_digest,user_id,expires_at) VALUES ('10000000-0000-0000-0000-000000000007','\x01','10000000-0000-0000-0000-000000000002',now()+interval '1 day');
INSERT INTO user_phone(user_id,phone_ciphertext,phone_query_digest,masked_phone,encryption_key_version) VALUES ('10000000-0000-0000-0000-000000000002','\x02','\x03','000****0000',1);
INSERT INTO admin_audit_event(id,actor_id,action,target_type,result,trace_id) VALUES ('10000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','TEST','TEST','SUCCESS','fixture');
SQL
import_database_psql target_fixture <<'SQL'
INSERT INTO admin_account(id, login_name, login_name_normalized, password_hash, display_name, role, password_changed_at)
VALUES ('20000000-0000-0000-0000-000000000001', 'admin', 'admin', 'preserved-server-hash', 'Server', 'ADMIN', now());
SQL
import_database_psql source_fixture < "$test_deploy_dir/sql/data-import-snapshot.sql" > "$test_directory/source.json"
import_database_psql target_fixture < "$test_deploy_dir/sql/data-import-snapshot.sql" > "$test_directory/target.json"
docker exec "$test_container" pg_dump -Fc --no-owner --no-acl -U postgres source_fixture > "$test_directory/source.dump"
docker exec "$test_container" createdb -U postgres stage_fixture
docker exec -i "$test_container" pg_restore -1 --no-owner --no-acl -U postgres -d stage_fixture < "$test_directory/source.dump"
import_database_psql stage_fixture < "$test_deploy_dir/sql/data-import-snapshot.sql" > "$test_directory/stage.json"
if ! cmp "$test_directory/source.json" "$test_directory/stage.json"; then
  for database in source_fixture stage_fixture; do
    import_database_psql "$database" --command "SELECT conrelid::regclass::text,conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2" > "$test_directory/$database-constraints.txt"
  done
  diff -u "$test_directory/source_fixture-constraints.txt" "$test_directory/stage_fixture-constraints.txt"
  exit 1
fi
import_database_psql target_fixture --command 'COPY admin_account TO STDOUT WITH (FORMAT csv)' > "$test_directory/admin.csv"
printf '%s\n' '10000000-0000-0000-0000-000000000003,dev/fixture.png,prod/imports/fixture.png,source-etag,copied-etag,42' \
  '10000000-0000-0000-0000-000000000004,dev/avatar.png,prod/imports/avatar.png,avatar-etag,copied-avatar-etag,42' > "$test_directory/media.csv"
python3 - "$test_directory" <<'PYTHON'
import hashlib, json, os, pathlib, sys
bundle = pathlib.Path(sys.argv[1])
manifest = {"format_version":1, "snapshot":json.loads((bundle/"source.json").read_text()),
 "dump_sha256":hashlib.sha256((bundle/"source.dump").read_bytes()).hexdigest(),
 "media_sha256":hashlib.sha256((bundle/"media.csv").read_bytes()).hexdigest(),
 "settings":{key:hashlib.sha256(b"fixture").hexdigest() for key in ("APP_PHONE_ENCRYPTION_KEY_BASE64","WECHAT_APP_ID","COS_BUCKET","COS_REGION","COS_OBJECT_PREFIX")}}
(bundle/"manifest.json").write_text(json.dumps(manifest))
PYTHON
export APP_PHONE_ENCRYPTION_KEY_BASE64=fixture WECHAT_APP_ID=fixture COS_BUCKET=fixture COS_REGION=fixture COS_OBJECT_PREFIX=fixture
python3 "$test_deploy_dir/check-data-import.py" "$test_directory" "$test_directory/target.json" "$test_directory/stage.json"
if python3 "$test_deploy_dir/check-data-import.py" "$test_directory" "$test_directory/source.json"; then
  echo 'Populated destination must be rejected.' >&2; exit 1
fi
transform_fixture() {
  sed -n '1,$p' "$test_deploy_dir/sql/transform-data-import.sql"
  sed -n '1,$p' "$test_directory/admin.csv"
  printf '\\.\n'
  sed -n '1,$p' "$test_deploy_dir/sql/finish-data-import.sql"
  [[ "$1" != invalid ]] || sed -n '1p' "$test_directory/media.csv"
  [[ "$1" != valid ]] || sed -n '1,$p' "$test_directory/media.csv"
  printf '\\.\n'
  sed -n '1,$p' "$test_deploy_dir/sql/validate-data-import.sql"
}
if transform_fixture invalid | import_database_psql stage_fixture -v import_prefix=prod > "$test_directory/invalid-transform.log" 2>&1; then
  echo 'Incomplete media mapping must fail.' >&2; exit 1
fi
import_database_psql stage_fixture < "$test_deploy_dir/sql/data-import-snapshot.sql" > "$test_directory/after-failure.json"
cmp "$test_directory/source.json" "$test_directory/after-failure.json"
transform_fixture valid | import_database_psql stage_fixture -v import_prefix=prod >/dev/null
[[ "$(import_database_psql stage_fixture -c "SELECT password_hash FROM admin_account")" == preserved-server-hash ]]
[[ "$(import_database_psql stage_fixture -c "SELECT count(*) FROM media_asset WHERE object_key LIKE 'prod/imports/%'")" == 2 ]]
[[ "$(import_database_psql stage_fixture -c 'SELECT count(*) FROM app_session')" == 0 ]]
[[ "$(import_database_psql stage_fixture -c 'SELECT count(*) FROM user_phone')" == 1 ]]
[[ "$(import_database_psql stage_fixture -c "SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated")" == 0 ]]
rename_import_databases target_fixture stage_fixture saved_fixture >/dev/null
[[ "$(import_database_psql target_fixture -c 'SELECT count(*) FROM content_entry')" == 1 ]]
[[ "$(import_database_psql saved_fixture -c 'SELECT count(*) FROM content_entry')" == 0 ]]
rename_import_databases target_fixture saved_fixture failed_fixture >/dev/null
[[ "$(import_database_psql target_fixture -c 'SELECT count(*) FROM content_entry')" == 0 ]]
[[ "$(import_database_psql failed_fixture -c 'SELECT count(*) FROM content_entry')" == 1 ]]
printf 'Isolated data restore, destination guards, admin preservation, media remapping, transaction rollback and database cutover tests passed.\n'
