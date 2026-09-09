#!/bin/sh
set -eu

: "${DOMAIN:?DOMAIN is required}"

certificate="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [ -f "$certificate" ]; then
  template="/opt/changqingjing/nginx/https.conf.template"
else
  template="/opt/changqingjing/nginx/http.conf.template"
fi

envsubst '${DOMAIN}' < "$template" > /etc/nginx/conf.d/default.conf
exec "$@"

