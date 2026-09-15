#!/usr/bin/env bash
set -Eeuo pipefail

test_deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Source functions without invoking any deployment command or loading secrets.
source "$test_deploy_dir/deploy.sh"
test_directory="$(mktemp -d)"
trap 'rm -rf "$test_directory"' EXIT

DOMAIN=''
PREVIEW_HTTP_PORT=8088
configure_deployment_runtime
[[ "$DEPLOY_MODE" == preview && "$HTTP_BIND_ADDRESS" == 127.0.0.1 && "$HTTPS_BIND_ADDRESS" == 127.0.0.1 ]]
[[ "$ADMIN_SESSION_COOKIE_SECURE" == false && "$(deployment_base_url)" == http://127.0.0.1:8088 ]]

DOMAIN=example.test
configure_deployment_runtime
[[ "$DEPLOY_MODE" == https && "$HTTP_BIND_ADDRESS" == 0.0.0.0 && "$HTTP_PORT" == 80 && "$HTTPS_PORT" == 443 ]]
[[ "$ADMIN_SESSION_COOKIE_SECURE" == true && "$(deployment_base_url)" == https://example.test ]]

deploy_dir="$test_directory"
mkdir -p "$deploy_dir/certbot/conf/live/$DOMAIN" "$deploy_dir/certbot/www"
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
printf 'Deployment mode selection and conditional certificate reload tests passed.\n'
