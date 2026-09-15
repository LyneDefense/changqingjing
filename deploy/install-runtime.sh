#!/usr/bin/env bash
set -Eeuo pipefail

configure_docker_apt_repository() (
  local key_path="$1" source_path="$2" suite="$3" architecture="$4"
  local repository_url=https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu
  # Verified against https://download.docker.com/linux/ubuntu/gpg.
  local official_key_sha256=1500c1f56fa9e26b9b8f42452a553675796ade0807cdce11975eb98170b3a570
  local temporary_directory downloaded_checksum
  temporary_directory="$(mktemp -d)"
  trap 'rm -rf "$temporary_directory"' EXIT

  if ! curl --fail --silent --show-error --connect-timeout 10 --max-time 30 \
    --retry 3 --retry-delay 2 --retry-all-errors --retry-max-time 90 \
    "$repository_url/gpg" --output "$temporary_directory/docker.asc"; then
    echo 'Docker 公钥下载失败；已重试，未修改软件源。请检查网络后重新运行 bootstrap。' >&2
    exit 1
  fi
  [[ -s "$temporary_directory/docker.asc" ]] || { echo 'Docker 公钥为空，停止安装。' >&2; exit 1; }
  downloaded_checksum="$(sha256sum "$temporary_directory/docker.asc")"
  [[ "${downloaded_checksum%% *}" == "$official_key_sha256" ]] || {
    echo 'Docker 公钥校验失败，未修改软件源；请核对 Docker 官方公钥是否更新。' >&2
    exit 1
  }

  install -d -m 0755 "$(dirname "$key_path")" "$(dirname "$source_path")"
  install -m 0644 "$temporary_directory/docker.asc" "$key_path"
  printf 'Types: deb\nURIs: %s\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: %s\n' \
    "$repository_url" "$suite" "$architecture" "$key_path" > "$temporary_directory/docker.sources"
  install -m 0644 "$temporary_directory/docker.sources" "$source_path"
)

install_runtime() {
  [[ -r /etc/os-release ]] || { echo 'Cannot identify OS.' >&2; return 1; }
  # shellcheck disable=SC1091
  source /etc/os-release
  [[ "${ID:-}" == ubuntu ]] || { echo 'Only Ubuntu is supported.' >&2; return 1; }

  if command -v docker >/dev/null; then
    docker compose version >/dev/null || {
      echo 'Docker exists but the Compose plugin is missing; install it before retrying.' >&2
      return 1
    }
    return 0
  fi

  [[ "$EUID" -eq 0 ]] || { echo 'Run bootstrap with sudo to install Docker.' >&2; return 1; }
  local package status
  for package in docker.io docker-compose docker-compose-v2 podman-docker containerd runc; do
    status="$(dpkg-query -W -f='${Status}' "$package" 2>/dev/null || true)"
    [[ "$status" != 'install ok installed' ]] || {
      echo "Conflicting package $package exists; no packages were removed. Resolve it manually first." >&2
      return 1
    }
  done

  printf "[changqingjing] Installing Docker using Tencent Cloud's Ubuntu mirror.\n"
  apt-get -o Acquire::Retries=3 update
  apt-get -o Acquire::Retries=3 install --yes --no-install-recommends \
    ca-certificates curl openssl util-linux iproute2 git
  configure_docker_apt_repository /etc/apt/keyrings/docker.asc /etc/apt/sources.list.d/docker.sources \
    "${UBUNTU_CODENAME:-$VERSION_CODENAME}" "$(dpkg --print-architecture)"
  apt-get -o Acquire::Retries=3 update
  apt-get -o Acquire::Retries=3 install --yes --no-install-recommends \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  docker info >/dev/null
  docker compose version
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  install_runtime "$@"
fi
