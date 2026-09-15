#!/usr/bin/env bash
set -Eeuo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="${1:-}"
release_notes="${2:-常清净文旅投 V1 发布}"
production_environment="$repository_root/miniprogram/.env.production.local"
artifact_root="$repository_root/artifacts/releases"

die() {
  printf 'Release preparation failed: %s\n' "$*" >&2
  exit 1
}

[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "请提供 x.y.z 格式版本号，例如 ./scripts/prepare-release.sh 1.0.0。"
[[ -f "$production_environment" ]] || die "请先复制 miniprogram/.env.production.local.example 为 .env.production.local 并填写正式 HTTPS API。"

set -a
# shellcheck disable=SC1090
source "$production_environment"
set +a

api_base_url="${TARO_APP_API_BASE_URL%/}"
[[ "$api_base_url" =~ ^https://[^/:]+/api/v1/app$ ]] || die "TARO_APP_API_BASE_URL 必须使用无自定义端口的 HTTPS 域名，并以 /api/v1/app 结尾。"
[[ "$api_base_url" != *CHANGE_ME* && "$api_base_url" != *localhost* && "$api_base_url" != *127.0.0.1* ]] || die "TARO_APP_API_BASE_URL 仍是开发或占位地址。"

command -v node >/dev/null || die "缺少 Node.js。"
command -v pnpm >/dev/null || die "缺少 pnpm。"
command -v rg >/dev/null || die "缺少 ripgrep (rg)。"
command -v shasum >/dev/null || die "缺少 shasum。"

API_BASE_URL="$api_base_url" node -e \
  'require(process.argv[1]).productionApiUrl(process.env.API_BASE_URL)' \
  "$repository_root/scripts/miniprogram-release.cjs"
node --test "$repository_root/scripts/miniprogram-release.test.cjs"

app_id="$(node -e "const c=require(process.argv[1]); process.stdout.write(c.appid || '')" "$repository_root/miniprogram/project.config.json")"
[[ "$app_id" =~ ^wx[0-9A-Za-z]{16}$ ]] || die "miniprogram/project.config.json 尚未配置有效正式 AppID。"

unexpected_changes="$(git -C "$repository_root" status --porcelain | grep -vE '^ M miniprogram/project\.config\.json$' || true)"
[[ -z "$unexpected_changes" ]] || die "除本机 AppID 配置外仍有未提交改动，请先提交或处理：\n$unexpected_changes"

"$repository_root/scripts/verify-release.sh"

TARO_APP_API_BASE_URL="$api_base_url" \
TARO_APP_REQUIRE_PRODUCTION_API=true \
  pnpm --dir "$repository_root/miniprogram" build:weapp

rg --fixed-strings --quiet "$api_base_url" "$repository_root/miniprogram/dist" \
  || die "构建产物中未找到正式 API 地址。"
if rg --text --quiet 'http://(localhost|127\.0\.0\.1)' "$repository_root/miniprogram/dist"; then
  die "构建产物仍含本地 API 地址。"
fi

release_directory="$artifact_root/$version"
[[ ! -e "$release_directory" ]] || die "版本 $version 的制品目录已经存在；版本号必须唯一。"
mkdir -p "$release_directory"
upload_project="$release_directory/miniprogram"
node "$repository_root/scripts/miniprogram-release.cjs" \
  "$repository_root/miniprogram" "$upload_project" "$api_base_url"
tar -czf "$release_directory/miniprogram-$version.tgz" \
  -C "$upload_project" dist project.config.json

source_revision="$(git -C "$repository_root" rev-parse HEAD)"
openapi_sha256="$(shasum -a 256 "$repository_root/contracts/openapi.json" | awk '{print $1}')"
miniprogram_sha256="$(shasum -a 256 "$release_directory/miniprogram-$version.tgz" | awk '{print $1}')"
latest_migration="$(node -e "const fs=require('fs'); const p=process.argv[1]; const files=fs.readdirSync(p).filter(f=>/^V[0-9].*\\.sql$/.test(f)).sort((a,b)=>a.localeCompare(b, undefined, {numeric:true})); process.stdout.write(files.at(-1) || '')" "$repository_root/backend/src/main/resources/db/migration")"
created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

VERSION="$version" RELEASE_NOTES="$release_notes" API_BASE_URL="$api_base_url" APP_ID="$app_id" \
SOURCE_REVISION="$source_revision" OPENAPI_SHA256="$openapi_sha256" MINIPROGRAM_SHA256="$miniprogram_sha256" \
LATEST_MIGRATION="$latest_migration" CREATED_AT="$created_at" \
node > "$release_directory/release-manifest.json" <<'NODE'
const manifest = {
  version: process.env.VERSION,
  releaseNotes: process.env.RELEASE_NOTES,
  createdAt: process.env.CREATED_AT,
  sourceRevision: process.env.SOURCE_REVISION,
  openapiSha256: process.env.OPENAPI_SHA256,
  latestMigration: process.env.LATEST_MIGRATION,
  miniprogram: {
    appId: process.env.APP_ID,
    apiBaseUrl: process.env.API_BASE_URL,
    archive: `miniprogram-${process.env.VERSION}.tgz`,
    sha256: process.env.MINIPROGRAM_SHA256,
  },
}
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
NODE

cat <<RESULT
Release $version is ready.
Manifest: $release_directory/release-manifest.json
Mini program source directory for WeChat DevTools: $upload_project
Use the WeChat DevTools “上传” button and enter version $version. No upload was performed automatically.
RESULT
