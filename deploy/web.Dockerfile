FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /workspace/admin-web
COPY admin-web/package.json admin-web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY admin-web/ ./
ARG MAP_BROWSER_ID
ARG MAP_REFERER_NAME
RUN VITE_TENCENT_MAP_KEY="$MAP_BROWSER_ID" \
    VITE_TENCENT_MAP_REFERER="$MAP_REFERER_NAME" \
    pnpm build

FROM nginx:1.27-alpine
RUN apk add --no-cache gettext
COPY --from=build /workspace/admin-web/dist/ /usr/share/nginx/html/admin/
COPY deploy/nginx/http.conf.template /opt/changqingjing/nginx/http.conf.template
COPY deploy/nginx/preview.conf.template /opt/changqingjing/nginx/preview.conf.template
COPY deploy/nginx/https.conf.template /opt/changqingjing/nginx/https.conf.template
COPY deploy/nginx/alias.conf.template /opt/changqingjing/nginx/alias.conf.template
COPY deploy/nginx/entrypoint.sh /opt/changqingjing/nginx/entrypoint.sh
RUN chmod 0755 /opt/changqingjing/nginx/entrypoint.sh \
    && rm -f /etc/nginx/conf.d/default.conf
EXPOSE 80 443
ENTRYPOINT ["/opt/changqingjing/nginx/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
