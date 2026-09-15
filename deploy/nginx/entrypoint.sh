#!/bin/sh
set -eu

case "${DEPLOY_MODE:-https}" in
  preview)
    [ -z "${DOMAIN:-}" ] || { echo 'Preview mode must not have DOMAIN.' >&2; exit 1; }
    template="/opt/changqingjing/nginx/preview.conf.template"
    ;;
  https)
    : "${DOMAIN:?DOMAIN is required for HTTPS}"
    certificate="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    if [ -f "$certificate" ]; then
      template="/opt/changqingjing/nginx/https.conf.template"
    else
      template="/opt/changqingjing/nginx/http.conf.template"
    fi
    ;;
  *) echo 'DEPLOY_MODE must be preview or https.' >&2; exit 1 ;;
esac

envsubst '${DOMAIN} ${DOMAIN_ALIAS}' < "$template" > /etc/nginx/conf.d/default.conf
if [ "${DEPLOY_MODE:-https}" = https ] && [ -n "${DOMAIN_ALIAS:-}" ] && [ -f "$certificate" ]; then
  envsubst '${DOMAIN} ${DOMAIN_ALIAS}' < /opt/changqingjing/nginx/alias.conf.template > /etc/nginx/conf.d/alias.conf
else
  rm -f /etc/nginx/conf.d/alias.conf
fi
exec "$@"
