#!/usr/bin/env bash
set -Eeuo pipefail

deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$deploy_dir/.." && pwd)"
temporary_environment="$(mktemp)"
temporary_certificates="$(mktemp -d)"
verification_image="changqingjing-web:verification"
preview_container=''
https_container=''

cleanup() {
  [[ -z "$preview_container" ]] || docker rm -f "$preview_container" >/dev/null 2>&1 || true
  [[ -z "$https_container" ]] || docker rm -f "$https_container" >/dev/null 2>&1 || true
  rm -f "$temporary_environment"
  rm -rf "$temporary_certificates"
}
trap cleanup EXIT

cat > "$temporary_environment" <<'ENVIRONMENT'
DOMAIN=example.test
DOMAIN_ALIAS=www.example.test
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
ENVIRONMENT

bash -n "$deploy_dir/deploy.sh" "$deploy_dir/runtime.sh" "$deploy_dir/install-runtime.sh" "$deploy_dir/monitor.sh" "$deploy_dir/test-stack.sh"
bash -n "$deploy_dir/import-data.sh"
bash "$deploy_dir/test-deploy.sh"
bash "$deploy_dir/test-install-runtime.sh"
bash "$deploy_dir/test-docker-mirror.sh"
docker compose --project-directory "$deploy_dir" \
  --env-file "$temporary_environment" --file "$deploy_dir/compose.production.yaml" config --quiet

# Exercise the same derived Compose variables as deploy.sh, without production secrets.
source "$deploy_dir/runtime.sh"
DOMAIN=''
DOMAIN_ALIAS=''
configure_deployment_runtime
compose_configuration="$(docker compose --project-directory "$deploy_dir" \
  --env-file "$temporary_environment" --file "$deploy_dir/compose.production.yaml" config)"
[[ "$compose_configuration" == *'DEPLOY_MODE: preview'* && "$compose_configuration" == *'SERVER_SERVLET_SESSION_COOKIE_SECURE: "false"'* ]]
[[ "$(printf '%s\n' "$compose_configuration" | awk '/host_ip:/ {print $2}' | sort -u)" == 127.0.0.1 ]]
DOMAIN=example.test
DOMAIN_ALIAS=www.example.test
configure_deployment_runtime
compose_configuration="$(docker compose --project-directory "$deploy_dir" \
  --env-file "$temporary_environment" --file "$deploy_dir/compose.production.yaml" config)"
[[ "$compose_configuration" == *'DEPLOY_MODE: https'* && "$compose_configuration" == *'SERVER_SERVLET_SESSION_COOKIE_SECURE: "true"'* ]]
[[ "$compose_configuration" == *'DOMAIN_ALIAS: www.example.test'* ]]

docker build --tag "$verification_image" --file "$deploy_dir/web.Dockerfile" "$repository_root"
docker run --rm --read-only --env DEPLOY_MODE=preview --env DOMAIN= --add-host backend:127.0.0.1 \
  --tmpfs /etc/nginx/conf.d --tmpfs /var/cache/nginx --tmpfs /var/run \
  --entrypoint /opt/changqingjing/nginx/entrypoint.sh \
  "$verification_image" nginx -t

preview_container="$(docker run --detach --read-only --env DEPLOY_MODE=preview --env DOMAIN= \
  --publish 127.0.0.1::80 --add-host backend:127.0.0.1 \
  --tmpfs /etc/nginx/conf.d --tmpfs /var/cache/nginx --tmpfs /var/run \
  "$verification_image")"
preview_address="$(docker port "$preview_container" 80/tcp)"
curl --fail --silent --show-error --retry 5 --retry-delay 1 --retry-connrefused \
  "http://$preview_address/admin/" >/dev/null
curl --fail --silent --show-error "http://$preview_address/admin/company-intro" >/dev/null
docker run --rm --read-only --env DOMAIN=example.test --add-host backend:127.0.0.1 \
  --tmpfs /etc/nginx/conf.d --tmpfs /var/cache/nginx --tmpfs /var/run \
  --entrypoint /opt/changqingjing/nginx/entrypoint.sh \
  "$verification_image" nginx -t

mkdir -p "$temporary_certificates/live/example.test"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -subj '/CN=example.test' \
  -addext 'subjectAltName=DNS:example.test,DNS:www.example.test' \
  -keyout "$temporary_certificates/live/example.test/privkey.pem" \
  -out "$temporary_certificates/live/example.test/fullchain.pem" >/dev/null 2>&1
docker run --rm --read-only --env DOMAIN=example.test --add-host backend:127.0.0.1 \
  --tmpfs /etc/nginx/conf.d --tmpfs /var/cache/nginx --tmpfs /var/run \
  --volume "$temporary_certificates:/etc/letsencrypt:ro" \
  --entrypoint /opt/changqingjing/nginx/entrypoint.sh \
  "$verification_image" nginx -t

# Run the real HTTPS server with an isolated test certificate, not production data.
https_container="$(docker run --detach --read-only --env DEPLOY_MODE=https \
  --env DOMAIN=example.test --env DOMAIN_ALIAS=www.example.test \
  --publish 127.0.0.1::80 --publish 127.0.0.1::443 --add-host backend:127.0.0.1 \
  --tmpfs /etc/nginx/conf.d --tmpfs /var/cache/nginx --tmpfs /var/run \
  --volume "$temporary_certificates:/etc/letsencrypt:ro" \
  --volume "$temporary_certificates:/var/www/certbot:ro" "$verification_image")"
http_port="$(docker port "$https_container" 80/tcp | awk -F: '{print $NF}')"
https_port="$(docker port "$https_container" 443/tcp | awk -F: '{print $NF}')"
test_path='/admin/company-intro?tab=blocks'
for domain in example.test www.example.test; do
  headers="$(curl --silent --show-error --retry 5 --retry-delay 1 --retry-connrefused \
    --noproxy '*' --resolve "$domain:$http_port:127.0.0.1" --dump-header - --output /dev/null \
    "http://$domain:$http_port$test_path" | tr -d '\r')"
  [[ "$headers" == *'301 Moved Permanently'* && "$headers" == *"Location: https://example.test$test_path"* ]]
done
headers="$(curl --silent --show-error --noproxy '*' \
  --cacert "$temporary_certificates/live/example.test/fullchain.pem" \
  --resolve "www.example.test:$https_port:127.0.0.1" --dump-header - --output /dev/null \
  "https://www.example.test:$https_port$test_path" | tr -d '\r')"
[[ "$headers" == *'301 Moved Permanently'* && "$headers" == *"Location: https://example.test$test_path"* ]]
curl --fail --silent --show-error --noproxy '*' \
  --cacert "$temporary_certificates/live/example.test/fullchain.pem" \
  --resolve "example.test:$https_port:127.0.0.1" "https://example.test:$https_port/admin/" >/dev/null
headers="$(curl --silent --show-error --noproxy '*' \
  --cacert "$temporary_certificates/live/example.test/fullchain.pem" \
  --resolve "example.test:$https_port:127.0.0.1" --dump-header - --output /dev/null \
  "https://example.test:$https_port/" | tr -d '\r')"
[[ "$headers" == *'302 Moved Temporarily'* && "$headers" == *'/admin/'* ]]
mkdir -p "$temporary_certificates/.well-known/acme-challenge"
printf 'alias-acme-test' > "$temporary_certificates/.well-known/acme-challenge/verification"
for domain in example.test www.example.test; do
  [[ "$(curl --fail --silent --show-error --noproxy '*' --resolve "$domain:$http_port:127.0.0.1" \
    "http://$domain:$http_port/.well-known/acme-challenge/verification")" == alias-acme-test ]]
done
docker exec "$https_container" nginx -t
echo "Compose, preview/ACME/HTTPS modes, trusted alias redirects and both ACME routes are valid."
