#!/usr/bin/env bash
set -Eeuo pipefail

test_deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$test_deploy_dir/install-runtime.sh"
test_directory="$(mktemp -d)"
trap 'rm -rf "$test_directory"' EXIT
key_path="$test_directory/config/docker.asc"
source_path="$test_directory/config/docker.sources"
download_result=success
checksum_matches=true

# No package manager or host configuration is touched by this test.
apt-get() { echo 'Unexpected package installation in test.' >&2; return 1; }
curl() {
  [[ "$*" == *'--retry 3'* && "$*" == *'--retry-all-errors'* && "$*" == *'--retry-max-time 90'* ]]
  [[ "$*" == *'https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu/gpg'* ]]
  local output_path=''
  while (( $# > 0 )); do
    if [[ "$1" == --output ]]; then output_path="$2"; break; fi
    shift
  done
  [[ -n "$output_path" ]]
  case "$download_result" in
    success) printf 'test public key\n' > "$output_path" ;;
    empty) : > "$output_path" ;;
    failed) printf 'partial download\n' > "$output_path"; return 35 ;;
    *) return 1 ;;
  esac
}
sha256sum() {
  if [[ "$checksum_matches" == true ]]; then
    printf '1500c1f56fa9e26b9b8f42452a553675796ade0807cdce11975eb98170b3a570  %s\n' "$1"
  else
    printf 'unexpected-checksum  %s\n' "$1"
  fi
}

configure_docker_apt_repository "$key_path" "$source_path" noble amd64
[[ "$(< "$key_path")" == 'test public key' ]]
grep -Fxq 'URIs: https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu' "$source_path"
grep -Fxq 'Suites: noble' "$source_path"
grep -Fxq 'Architectures: amd64' "$source_path"
grep -Fxq "Signed-By: $key_path" "$source_path"
cp "$key_path" "$test_directory/original-key"
cp "$source_path" "$test_directory/original-source"

for download_result in failed empty; do
  if configure_docker_apt_repository "$key_path" "$source_path" noble amd64; then
    echo 'Failed or empty download must stop repository configuration.' >&2
    exit 1
  fi
  cmp "$key_path" "$test_directory/original-key"
  cmp "$source_path" "$test_directory/original-source"
done
download_result=success
checksum_matches=false
if configure_docker_apt_repository "$key_path" "$source_path" noble amd64; then
  echo 'Untrusted public key must stop repository configuration.' >&2
  exit 1
fi
cmp "$key_path" "$test_directory/original-key"
cmp "$source_path" "$test_directory/original-source"
printf 'Docker mirror, retry options and failure-safe key installation tests passed.\n'
