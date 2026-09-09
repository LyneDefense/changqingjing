#!/usr/bin/env bash
set -Eeuo pipefail

deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$deploy_dir/.." && pwd)"
temporary_environment="$(mktemp)"
temporary_certificates="$(mktemp -d)"
verification_image="changqingjing-web:verification"

cleanup() {
  rm -f "$temporary_environment"
  rm -rf "$temporary_certificates"
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
WECHAT_APP_SECRET=test
APP_PHONE_ENCRYPTION_KEY_BASE64=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=
COS_BUCKET=test-0000000000
COS_REGION=ap-test
COS_SECRET_ID=test-id
COS_SECRET_KEY=test
COS_OBJECT_PREFIX=prod
VITE_TENCENT_MAP_KEY=test-map-key
VITE_TENCENT_MAP_REFERER=test-map-referer
ENVIRONMENT

bash -n "$deploy_dir/deploy.sh" "$deploy_dir/monitor.sh" "$deploy_dir/test-stack.sh"
docker compose --project-directory "$deploy_dir" \
  --env-file "$temporary_environment" --file "$deploy_dir/compose.production.yaml" config --quiet

docker build --tag "$verification_image" --file "$deploy_dir/web.Dockerfile" "$repository_root"
docker run --rm --read-only --env DOMAIN=example.test --add-host backend:127.0.0.1 \
  --tmpfs /etc/nginx/conf.d --tmpfs /var/cache/nginx --tmpfs /var/run \
  --entrypoint /opt/changqingjing/nginx/entrypoint.sh \
  "$verification_image" nginx -t

mkdir -p "$temporary_certificates/live/example.test"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -subj '/CN=example.test' \
  -keyout "$temporary_certificates/live/example.test/privkey.pem" \
  -out "$temporary_certificates/live/example.test/fullchain.pem" >/dev/null 2>&1
docker run --rm --read-only --env DOMAIN=example.test --add-host backend:127.0.0.1 \
  --tmpfs /etc/nginx/conf.d --tmpfs /var/cache/nginx --tmpfs /var/run \
  --volume "$temporary_certificates:/etc/letsencrypt:ro" \
  --entrypoint /opt/changqingjing/nginx/entrypoint.sh \
  "$verification_image" nginx -t

echo "Production Compose and both Nginx modes are valid."
