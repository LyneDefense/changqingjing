#!/usr/bin/env bash
set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
backend_log="$(mktemp)"
raw_contract="$(mktemp)"
server_port="${OPENAPI_SERVER_PORT:-18081}"
backend_pid=""

cleanup() {
  if [[ -n "$backend_pid" ]]; then
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
  rm -f "$backend_log" "$raw_contract"
}
trap cleanup EXIT

if [[ -f "$repository_root/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$repository_root/.env.local"
  set +a
fi

mkdir -p "$repository_root/contracts"

(
  cd "$repository_root/backend"
  SPRING_PROFILES_ACTIVE=openapi \
  OPENAPI_ENABLED=true \
  ADMIN_BOOTSTRAP_ENABLED=false \
  SERVER_PORT="$server_port" \
  ./mvnw -q -DskipTests spring-boot:run
) >"$backend_log" 2>&1 &
backend_pid=$!

for _ in {1..90}; do
  if curl --silent --fail "http://127.0.0.1:$server_port/actuator/health" >/dev/null; then
    break
  fi
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    sed -n '1,220p' "$backend_log" >&2
    exit 1
  fi
  sleep 1
done

curl --silent --show-error --fail \
  "http://127.0.0.1:$server_port/internal/openapi" \
  --output "$raw_contract"

node -e '
  const fs = require("node:fs");
  const [source, target] = process.argv.slice(1);
  const contract = JSON.parse(fs.readFileSync(source, "utf8"));
  delete contract.servers;
  contract.info = { title: "Changqingjing API", version: "1.0.0" };
  fs.writeFileSync(target, `${JSON.stringify(contract, null, 2)}\n`);
' "$raw_contract" "$repository_root/contracts/openapi.json"

echo "Generated contracts/openapi.json"
