#!/usr/bin/env bash
set -uo pipefail

deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
environment_file="$deploy_dir/.env.production"
compose_file="$deploy_dir/compose.production.yaml"
backup_dir="$deploy_dir/backups"
failures=()

record_failure() {
  failures+=("$1")
}

if [[ ! -f "$environment_file" ]]; then
  printf '[changqingjing-monitor] ERROR: 缺少 %s\n' "$environment_file" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$environment_file"
set +a

# shellcheck source=runtime.sh
source "$deploy_dir/runtime.sh"
configure_deployment_runtime

compose=(docker compose --project-directory "$deploy_dir" --env-file "$environment_file" --file "$compose_file")

for service in postgres backend web; do
  container_id="$("${compose[@]}" ps -q "$service" 2>/dev/null)"
  if [[ -z "$container_id" ]]; then
    record_failure "$service 容器不存在"
    continue
  fi
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null)"
  [[ "$status" == "healthy" ]] || record_failure "$service 状态为 $status"
done

if ! curl --fail --silent --show-error --connect-timeout 5 --max-time 10 "$(deployment_base_url)/healthz" >/dev/null; then
  record_failure "$DEPLOY_MODE 外部健康检查失败"
fi

tls_warning_days="${TLS_WARNING_DAYS:-30}"
if [[ ! "$tls_warning_days" =~ ^[0-9]+$ ]]; then
  record_failure "TLS_WARNING_DAYS 不是正整数"
  tls_warning_days=30
fi
if [[ "$DEPLOY_MODE" == https ]]; then
  certificate="$deploy_dir/certbot/conf/live/$DOMAIN/fullchain.pem"
  if [[ ! -f "$certificate" ]]; then
    record_failure "找不到 TLS 证书"
  elif ! openssl x509 -checkend "$((tls_warning_days * 86400))" -noout -in "$certificate" >/dev/null; then
    record_failure "TLS 证书将在 $tls_warning_days 天内到期"
  fi
fi

backup_max_age_hours="${BACKUP_MAX_AGE_HOURS:-26}"
if [[ ! "$backup_max_age_hours" =~ ^[0-9]+$ ]]; then
  record_failure "BACKUP_MAX_AGE_HOURS 不是正整数"
  backup_max_age_hours=26
fi
latest_backup="$(find "$backup_dir" -maxdepth 1 -type f -name 'changqingjing-*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -nr | sed -n '1s/^[^ ]* //p')"
if [[ -z "$latest_backup" ]]; then
  record_failure "没有数据库备份"
else
  backup_age_seconds="$(( $(date +%s) - $(stat -c '%Y' "$latest_backup") ))"
  (( backup_age_seconds <= backup_max_age_hours * 3600 )) || record_failure "最新数据库备份已超过 $backup_max_age_hours 小时"
fi

disk_usage_warn_percent="${DISK_USAGE_WARN_PERCENT:-85}"
if [[ ! "$disk_usage_warn_percent" =~ ^[0-9]+$ || "$disk_usage_warn_percent" -lt 1 || "$disk_usage_warn_percent" -gt 100 ]]; then
  record_failure "DISK_USAGE_WARN_PERCENT 必须是 1～100"
  disk_usage_warn_percent=85
fi
disk_usage="$(df -P "$deploy_dir" | awk 'NR == 2 {gsub(/%/, "", $5); print $5}')"
if [[ "$disk_usage" =~ ^[0-9]+$ ]]; then
  (( disk_usage < disk_usage_warn_percent )) || record_failure "部署磁盘使用率已达到 ${disk_usage}%"
else
  record_failure "无法读取部署磁盘使用率"
fi

if (( ${#failures[@]} > 0 )); then
  for failure in "${failures[@]}"; do
    printf '[changqingjing-monitor] ERROR: %s\n' "$failure" >&2
  done
  exit 1
fi

printf '[changqingjing-monitor] OK: mode=%s, containers, endpoint, backup, and disk are healthy\n' "$DEPLOY_MODE"
