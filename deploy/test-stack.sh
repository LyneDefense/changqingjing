#!/usr/bin/env bash
set -Eeuo pipefail

deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
temporary_environment="$(mktemp)"
temporary_backup="$(mktemp)"
validation_project="changqingjing-verify"

cleanup() {
  docker compose --project-name "$validation_project" --project-directory "$deploy_dir" \
    --env-file "$temporary_environment" --file "$deploy_dir/compose.production.yaml" \
    down --volumes >/dev/null 2>&1 || true
  unlink "$temporary_environment" 2>/dev/null || true
  unlink "$temporary_backup" 2>/dev/null || true
}
trap cleanup EXIT

cat > "$temporary_environment" <<'ENVIRONMENT'
DOMAIN=example.test
SERVER_PUBLIC_IP=192.0.2.1
CERTBOT_EMAIL=operator@example.test
POSTGRES_DB=changqingjing
POSTGRES_USER=changqingjing
POSTGRES_PASSWORD=a-test-password-with-24-chars
BACKEND_IMAGE=changqingjing-backend:verification
WEB_IMAGE=changqingjing-web:verification
WECHAT_APP_ID=wx-test
WECHAT_APP_SECRET=test-secret
APP_PHONE_ENCRYPTION_KEY_BASE64=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=
COS_BUCKET=test-0000000000
COS_REGION=ap-guangzhou
COS_SECRET_ID=test-id
COS_SECRET_KEY=test-key
COS_OBJECT_PREFIX=prod
VITE_TENCENT_MAP_KEY=test-map-key
VITE_TENCENT_MAP_REFERER=test-map-referer
ENVIRONMENT

compose=(docker compose --project-name "$validation_project" --project-directory "$deploy_dir" \
  --env-file "$temporary_environment" --file "$deploy_dir/compose.production.yaml")

"${compose[@]}" up -d postgres
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --no-build backend

backend_container="$("${compose[@]}" ps -q backend)"
health="starting"
for _attempt in $(seq 1 60); do
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$backend_container")"
  [[ "$health" == "healthy" ]] && break
  if [[ "$health" == "unhealthy" || "$health" == "exited" ]]; then
    "${compose[@]}" logs --tail 120 backend
    exit 1
  fi
  sleep 2
done
[[ "$health" == "healthy" ]]

migration_count="$("${compose[@]}" exec -T postgres psql \
  --username changqingjing --dbname changqingjing --tuples-only --no-align \
  --command 'select count(*) from flyway_schema_history;')"
[[ "$migration_count" == "5" ]]

"${compose[@]}" exec -T postgres pg_dump \
  --format=custom --no-owner --no-acl \
  --username changqingjing --dbname changqingjing > "$temporary_backup"
[[ -s "$temporary_backup" ]]
"${compose[@]}" exec -T postgres pg_restore --list < "$temporary_backup" >/dev/null
"${compose[@]}" exec -T postgres createdb --username changqingjing restore_check
"${compose[@]}" exec -T postgres pg_restore \
  --exit-on-error --no-owner --no-acl \
  --username changqingjing --dbname restore_check < "$temporary_backup"
restored_migration_count="$("${compose[@]}" exec -T postgres psql \
  --username changqingjing --dbname restore_check --tuples-only --no-align \
  --command 'select count(*) from flyway_schema_history;')"
[[ "$restored_migration_count" == "5" ]]

echo "Production stack migration, health, backup, and restore verification passed."
