#!/usr/bin/env bash
set -Eeuo pipefail

[[ -r /etc/os-release ]] || { echo 'Cannot identify OS.' >&2; exit 1; }
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == ubuntu ]] || { echo 'Only Ubuntu is supported.' >&2; exit 1; }

if command -v docker >/dev/null; then
  docker compose version >/dev/null || {
    echo 'Docker exists but the Compose plugin is missing; install it before retrying.' >&2
    exit 1
  }
  exit 0
fi

[[ "$EUID" -eq 0 ]] || { echo 'Run bootstrap with sudo to install Docker.' >&2; exit 1; }
for package in docker.io docker-compose docker-compose-v2 podman-docker containerd runc; do
  status="$(dpkg-query -W -f='${Status}' "$package" 2>/dev/null || true)"
  [[ "$status" != 'install ok installed' ]] || {
    echo "Conflicting package $package exists; no packages were removed. Resolve it manually first." >&2
    exit 1
  }
done

printf '[changqingjing] Installing Docker from its official Ubuntu repository.\n'
apt-get update
apt-get install --yes --no-install-recommends ca-certificates curl openssl util-linux iproute2 git
install -d -m 0755 /etc/apt/keyrings
curl --fail --silent --show-error --connect-timeout 10 --max-time 60 \
  https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod 0644 /etc/apt/keyrings/docker.asc

repository_file="$(mktemp)"
trap 'rm -f "$repository_file"' EXIT
printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' \
  "${UBUNTU_CODENAME:-$VERSION_CODENAME}" "$(dpkg --print-architecture)" > "$repository_file"
install -m 0644 "$repository_file" /etc/apt/sources.list.d/docker.sources
apt-get update
apt-get install --yes --no-install-recommends \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker info >/dev/null
docker compose version
