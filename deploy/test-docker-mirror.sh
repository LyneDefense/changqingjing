#!/usr/bin/env bash
set -Eeuo pipefail

test_deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$test_deploy_dir/install-runtime.sh"
test_directory="$(mktemp -d)"
trap 'rm -rf "$test_directory"' EXIT

# All Docker/service/network operations are mocked. JSON merging uses real Python.
curl() {
  [[ "$*" == *'https://mirror.ccs.tencentyun.com/v2/'* && "$*" == *'--retry-max-time 30'* ]] || return 1
  [[ "$network_available" == true ]]
}
dockerd() {
  [[ "$1" == --validate && "$2" == --config-file ]] || return 1
  python3 -m json.tool "$3" >/dev/null || return 1
  [[ "$configuration_valid" == true ]]
}
docker() {
  [[ "$1" == info && "$daemon_available" == true ]] || return 1
  if [[ $# -gt 1 ]]; then
    python3 - "$active_config" <<'PYTHON'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as source:
    mirrors = json.load(source).get("registry-mirrors", [])
    if mirrors:
        print(mirrors[0].rstrip("/") + "/")
PYTHON
  fi
}
systemctl() {
  [[ "$*" == 'reload docker' ]] || { echo 'Docker must never be restarted by mirror configuration.' >&2; return 1; }
  printf 'reload\n' >> "$service_calls"
  [[ "$reload_succeeds" == true ]] || return 1
  if [[ "$reload_applies" == true ]]; then
    if [[ -f "$config_path" ]]; then
      cp "$config_path" "$active_config"
    else
      printf '{}\n' > "$active_config"
    fi
  fi
}
sleep() { :; }

reset_fixture() {
  local fixture_path="$test_directory/$1"
  mkdir -p "$fixture_path"
  config_path="$fixture_path/config/daemon.json"
  active_config="$fixture_path/active.json"
  service_calls="$fixture_path/service-calls"
  printf '{}\n' > "$active_config"
  : > "$service_calls"
  network_available=true configuration_valid=true daemon_available=true
  reload_succeeds=true reload_applies=true
}
expect_failure() {
  if configure_docker_registry_mirror "$config_path"; then
    echo 'Expected configuration failure.' >&2
    exit 1
  fi
}
assert_reload_count() {
  [[ "$(wc -l < "$service_calls" | tr -d ' ')" == "$1" ]]
}

reset_fixture new
configure_docker_registry_mirror "$config_path"
grep -Fq 'https://mirror.ccs.tencentyun.com' "$config_path"
docker_registry_mirror_is_active
assert_reload_count 1
cp "$config_path" "$test_directory/new-config"
configure_docker_registry_mirror "$config_path"
cmp "$config_path" "$test_directory/new-config"
assert_reload_count 1

reset_fixture preserve
mkdir -p "$(dirname "$config_path")"
printf '%s\n' '{"registry-mirrors":["https://existing.example.test","https://mirror.ccs.tencentyun.com/"],"log-opts":{"max-size":"20m"},"proxies":{"https-proxy":"https://user:private@example.test"},"live-restore":true}' > "$config_path"
cp "$config_path" "$test_directory/original-config"
configure_docker_registry_mirror "$config_path"
python3 - "$config_path" "$test_directory/original-config" <<'PYTHON'
import json
import pathlib
import sys
config_path = pathlib.Path(sys.argv[1])
current = json.loads(config_path.read_text())
original = json.loads(pathlib.Path(sys.argv[2]).read_text())
assert current.pop("registry-mirrors") == ["https://mirror.ccs.tencentyun.com", "https://existing.example.test"]
original.pop("registry-mirrors")
assert current == original
backups = list(config_path.parent.glob("daemon.json.changqingjing-backup.*"))
assert len(backups) == 1
assert backups[0].read_bytes() == pathlib.Path(sys.argv[2]).read_bytes()
assert backups[0].stat().st_mode & 0o777 == 0o600
PYTHON

# A prepared but not yet loaded config must still be applied.
printf '{}\n' > "$active_config"
configure_docker_registry_mirror "$config_path"
docker_registry_mirror_is_active
assert_reload_count 2

reset_fixture wrong-order
mkdir -p "$(dirname "$config_path")"
printf '{"registry-mirrors":["https://mirror.ccs.tencentyun.com","https://existing.example.test"]}\n' > "$config_path"
printf '{"registry-mirrors":["https://existing.example.test","https://mirror.ccs.tencentyun.com"]}\n' > "$active_config"
configure_docker_registry_mirror "$config_path"
docker_registry_mirror_is_active
assert_reload_count 1

for invalid_json in '{broken' '[]' '{"registry-mirrors":1}' '{"registry-mirrors":[1]}' '{"debug":true,"debug":false}'; do
  reset_fixture "invalid-$RANDOM"
  mkdir -p "$(dirname "$config_path")"
  printf '%s\n' "$invalid_json" > "$config_path"
  cp "$config_path" "$test_directory/invalid-original"
  expect_failure
  cmp "$config_path" "$test_directory/invalid-original"
  assert_reload_count 0
done

for failure in network validation daemon; do
  reset_fixture "$failure"
  mkdir -p "$(dirname "$config_path")"
  printf '{"log-driver":"local"}\n' > "$config_path"
  cp "$config_path" "$test_directory/failure-original"
  case "$failure" in
    network) network_available=false ;;
    validation) configuration_valid=false ;;
    daemon) daemon_available=false ;;
  esac
  expect_failure
  cmp "$config_path" "$test_directory/failure-original"
  assert_reload_count 0
done

for failure in reload unapplied; do
  reset_fixture "$failure"
  mkdir -p "$(dirname "$config_path")"
  printf '{"log-driver":"local"}\n' > "$config_path"
  cp "$config_path" "$test_directory/rollback-original"
  if [[ "$failure" == reload ]]; then reload_succeeds=false; else reload_applies=false; fi
  expect_failure
  cmp "$config_path" "$test_directory/rollback-original"
  assert_reload_count 2
done

reset_fixture rollback-new
reload_applies=false
expect_failure
[[ ! -e "$config_path" ]]
assert_reload_count 2

reset_fixture symlink
mkdir -p "$(dirname "$config_path")"
ln -s "$active_config" "$config_path"
expect_failure
[[ -L "$config_path" && "$(< "$active_config")" == '{}' ]]
assert_reload_count 0

printf 'Docker registry mirror merge, idempotency, validation and rollback tests passed.\n'
