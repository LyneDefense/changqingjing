#!/usr/bin/env bash
set -Eeuo pipefail

test_deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Source functions without invoking any deployment command or loading secrets.
source "$test_deploy_dir/deploy.sh"
test_directory="$(mktemp -d)"
trap 'rm -rf "$test_directory"' EXIT

DOMAIN=''
DOMAIN_ALIAS=''
PREVIEW_HTTP_PORT=8088
configure_deployment_runtime
[[ "$DEPLOY_MODE" == preview && "$HTTP_BIND_ADDRESS" == 127.0.0.1 && "$HTTPS_BIND_ADDRESS" == 127.0.0.1 ]]
[[ "$ADMIN_SESSION_COOKIE_SECURE" == false && "$(deployment_base_url)" == http://127.0.0.1:8088 ]]

DOMAIN=example.test
configure_deployment_runtime
[[ "$DEPLOY_MODE" == https && "$HTTP_BIND_ADDRESS" == 0.0.0.0 && "$HTTP_PORT" == 80 && "$HTTPS_PORT" == 443 ]]
[[ "$ADMIN_SESSION_COOKIE_SECURE" == true && "$(deployment_base_url)" == https://example.test ]]

deploy_dir="$test_directory"
mkdir -p "$deploy_dir/certbot/conf/live/$DOMAIN" "$deploy_dir/certbot/www/.well-known/acme-challenge"
touch "$deploy_dir/certbot/conf/live/$DOMAIN/fullchain.pem"
compose=(fake_compose)
renewed=false
nginx_valid=true
renewal_succeeds=true
reload_succeeds=true
reloads=0
fake_compose() {
  case "$*" in
    'run --rm certbot renew '*)
      [[ "$*" == *"--cert-name $DOMAIN"* && "$*" == *--deploy-hook* ]]
      [[ "$renewal_succeeds" == true ]] || return 1
      if [[ "$renewed" == true && "$*" != *--dry-run* ]]; then
        touch "$deploy_dir/certbot/www/.renewed-$DOMAIN"
      fi
      ;;
    'exec -T web nginx -t') [[ "$nginx_valid" == true ]] ;;
    'exec -T web nginx -s reload')
      [[ "$reload_succeeds" == true ]] || return 1
      reloads=$((reloads + 1))
      ;;
    *) echo "Unexpected Compose command: $*" >&2; return 1 ;;
  esac
}

renew_certificate
[[ "$reloads" == 0 ]]
renewed=true
renew_certificate --dry-run
[[ "$reloads" == 0 ]]
renew_certificate
[[ "$reloads" == 1 && ! -f "$deploy_dir/certbot/www/.renewed-$DOMAIN" ]]
nginx_valid=false
if renew_certificate; then
  echo 'Invalid Nginx configuration must fail renewal rollout.' >&2
  exit 1
fi
[[ "$reloads" == 1 && -f "$deploy_dir/certbot/www/.renewed-$DOMAIN" ]]
nginx_valid=true
renewed=false
renew_certificate
[[ "$reloads" == 2 && ! -f "$deploy_dir/certbot/www/.renewed-$DOMAIN" ]]
renewal_succeeds=false
if renew_certificate; then
  echo 'Failed certificate renewal must fail without reload.' >&2
  exit 1
fi
[[ "$reloads" == 2 ]]
renewal_succeeds=true
renewed=true
reload_succeeds=false
if renew_certificate; then
  echo 'Failed Nginx reload must preserve its retry marker.' >&2
  exit 1
fi
[[ "$reloads" == 2 && -f "$deploy_dir/certbot/www/.renewed-$DOMAIN" ]]
renewed=false
reload_succeeds=true
renew_certificate
[[ "$reloads" == 3 && ! -f "$deploy_dir/certbot/www/.renewed-$DOMAIN" ]]
DOMAIN=''
configure_deployment_runtime
renew_certificate
[[ "$reloads" == 3 ]]

validate_domain example.test DOMAIN
validate_domain www.example.test DOMAIN_ALIAS
for invalid_domain in 'https://example.test' 'Example.test' 'example.test/admin' 'example..test' '-example.test' 'example-.test' 'example.test;' 'example.test.'; do
  if (validate_domain "$invalid_domain" DOMAIN) >/dev/null 2>&1; then
    echo "Unsafe domain must be rejected: $invalid_domain" >&2
    exit 1
  fi
done

DOMAIN=example.test
DOMAIN_ALIAS=www.example.test
CERTBOT_EMAIL=operator@example.test
CERTBOT_STAGING=false
configure_deployment_runtime
[[ "$(deployment_domains)" == $'example.test\nwww.example.test' ]]
fake_compose() {
  [[ "$*" == 'run --rm certbot certonly '* ]]
  [[ "$*" == *'--cert-name example.test --domain example.test --domain www.example.test'* ]]
  [[ "$*" == *'--keep-until-expiring --expand'* && "$*" == *'--non-interactive'* ]]
  [[ "$*" != *'--force-renewal'* ]]
  printf '%s\n' "$*" >> "$test_directory/certificate-requests"
}
request_first_certificate
# Existing root-only certificates must not skip alias expansion on repeat activation.
request_first_certificate
[[ "$(wc -l < "$test_directory/certificate-requests" | tr -d '[:space:]')" == 2 ]]
curl() {
  local url="${!#}"
  [[ "$url" == http://example.test/.well-known/acme-challenge/* || "$url" == http://www.example.test/.well-known/acme-challenge/* ]]
  printf '%s\n' "$url" >> "$test_directory/acme-requests"
  printf '%s' "${url##*/}"
}
check_acme_route
[[ "$(wc -l < "$test_directory/acme-requests" | tr -d '[:space:]')" == 4 ]]
[[ "$(find "$deploy_dir/certbot/www/.well-known/acme-challenge" -type f | wc -l | tr -d '[:space:]')" == 0 ]]
alias_redirect_valid=true
curl() {
  case "${!#}" in
    'https://example.test/healthz') return 0 ;;
    'https://www.example.test/admin/?https-check=1')
      if [[ "$alias_redirect_valid" == true ]]; then
        printf '301 https://example.test/admin/?https-check=1'
      else
        printf '200 '
      fi
      ;;
    *) return 1 ;;
  esac
}
check_external_health
alias_redirect_valid=false
if check_external_health; then
  echo 'Incorrect alias HTTPS redirect must fail the release health check.' >&2
  exit 1
fi
DOMAIN_ALIAS=''
[[ "$(deployment_domains)" == example.test ]]
printf 'Deployment modes, renewal, certificate alias expansion and both ACME routes passed.\n'
