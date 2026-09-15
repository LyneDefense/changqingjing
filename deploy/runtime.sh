#!/usr/bin/env bash
# Source after .env.production. Domain presence is the single switch for HTTPS.
configure_deployment_runtime() {
  export DOMAIN="${DOMAIN:-}"
  export DOMAIN_ALIAS="${DOMAIN_ALIAS:-}"
  if [[ -z "$DOMAIN" ]]; then
    export DEPLOY_MODE=preview
    export HTTP_BIND_ADDRESS=127.0.0.1 HTTP_PORT="${PREVIEW_HTTP_PORT:-8088}"
    export HTTPS_BIND_ADDRESS=127.0.0.1 HTTPS_PORT=8443
    export ADMIN_SESSION_COOKIE_SECURE=false
  else
    export DEPLOY_MODE=https
    export HTTP_BIND_ADDRESS=0.0.0.0 HTTP_PORT=80
    export HTTPS_BIND_ADDRESS=0.0.0.0 HTTPS_PORT=443
    export ADMIN_SESSION_COOKIE_SECURE=true
  fi
}

deployment_base_url() {
  if [[ "$DEPLOY_MODE" == preview ]]; then
    printf 'http://127.0.0.1:%s' "$HTTP_PORT"
  else
    printf 'https://%s' "$DOMAIN"
  fi
}
