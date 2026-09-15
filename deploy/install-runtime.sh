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

docker_registry_mirror_is_active() {
  docker info --format '{{if .RegistryConfig.Mirrors}}{{index .RegistryConfig.Mirrors 0}}{{end}}' 2>/dev/null |
    grep -Fxq -e 'https://mirror.ccs.tencentyun.com' -e 'https://mirror.ccs.tencentyun.com/'
}

configure_docker_registry_mirror() (
  local config_path="$1" mirror_url=https://mirror.ccs.tencentyun.com
  local temporary_directory replacement_path='' backup_path=''
  local had_config=false replacement_installed=false
  command -v python3 >/dev/null && command -v dockerd >/dev/null || {
    echo '配置 Docker 镜像加速器需要 python3 和 dockerd，未修改配置。' >&2
    exit 1
  }
  [[ ! -L "$config_path" && ( ! -e "$config_path" || -f "$config_path" ) ]] || {
    echo 'Docker 配置不是普通文件，停止自动修改。' >&2
    exit 1
  }
  [[ ! -f "$config_path" ]] || had_config=true
  temporary_directory="$(mktemp -d)"

  cleanup_mirror_configuration() {
    local exit_status="$?" restored=false
    trap - EXIT
    if [[ "$exit_status" -ne 0 && "$replacement_installed" == true ]]; then
      if [[ "$had_config" == true ]]; then
        if install -m 0600 "$backup_path" "$replacement_path" && mv -f "$replacement_path" "$config_path"; then
          restored=true
        fi
      elif rm -f "$config_path"; then
        restored=true
      fi
      if [[ "$restored" == true ]]; then
        echo '镜像加速配置失败，已恢复原 Docker 配置；没有重启 Docker。' >&2
        systemctl reload docker >/dev/null 2>&1 || echo '原配置已恢复，但热加载失败，请检查 Docker 服务日志。' >&2
      else
        echo "Docker 配置恢复失败，请检查 $config_path；原文件备份：$backup_path" >&2
      fi
    fi
    [[ -z "$replacement_path" ]] || rm -f "$replacement_path"
    rm -rf "$temporary_directory"
    exit "$exit_status"
  }
  trap cleanup_mirror_configuration EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  # JSON parsing is required to preserve nested settings such as proxies and log options.
  if ! python3 - "$config_path" "$mirror_url" > "$temporary_directory/daemon.json" <<'PYTHON'
import json
import pathlib
import sys

def unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result

try:
    path = pathlib.Path(sys.argv[1])
    original = path.read_text(encoding="utf-8") if path.exists() else "{}"
    config = json.loads(original, object_pairs_hook=unique_keys)
    if not isinstance(config, dict):
        raise ValueError("configuration must be an object")
    mirrors = config.get("registry-mirrors", [])
    if not isinstance(mirrors, list) or any(not isinstance(item, str) for item in mirrors):
        raise ValueError("registry-mirrors must be a string array")
    mirror = sys.argv[2]
    preferred = [mirror] + [item for item in mirrors if item.rstrip("/") != mirror]
    if mirrors == preferred:
        sys.stdout.write(original)
    else:
        config["registry-mirrors"] = preferred
        sys.stdout.write(json.dumps(config, ensure_ascii=False, indent=2) + "\n")
except (OSError, ValueError):
    # Do not include raw configuration or proxy credentials in diagnostics.
    print("Docker 配置无法安全解析；请检查 JSON 格式和 registry-mirrors，未修改原文件。", file=sys.stderr)
    sys.exit(1)
PYTHON
  then
    exit 1
  fi

  if cmp -s "$config_path" "$temporary_directory/daemon.json" && docker_registry_mirror_is_active; then
    printf '[changqingjing] 腾讯云 Docker 镜像加速器已生效，保持现有配置。\n'
    exit 0
  fi
  if ! curl --fail --silent --show-error --connect-timeout 5 --max-time 10 \
    --retry 2 --retry-delay 1 --retry-all-errors --retry-max-time 30 \
    "$mirror_url/v2/" --output /dev/null; then
    echo '腾讯云内网镜像加速器不可达，未修改 Docker 配置；请在腾讯云服务器检查网络后重试。' >&2
    exit 1
  fi
  if ! dockerd --validate --config-file "$temporary_directory/daemon.json" > "$temporary_directory/validation.log" 2>&1; then
    echo 'Docker 配置校验失败，未修改原文件；请检查现有配置是否适用于当前 Docker 版本。' >&2
    exit 1
  fi
  docker info >/dev/null 2>&1 || { echo 'Docker 服务不可用，未修改配置。' >&2; exit 1; }

  [[ -d "$(dirname "$config_path")" ]] || install -d -m 0755 "$(dirname "$config_path")" || exit 1
  replacement_path="$(mktemp "$(dirname "$config_path")/.daemon.json.changqingjing.XXXXXX")" || exit 1
  if [[ "$had_config" == true ]]; then
    backup_path="$(mktemp "$config_path.changqingjing-backup.XXXXXX")" || exit 1
    install -m 0600 "$config_path" "$backup_path" || exit 1
  fi
  install -m 0600 "$temporary_directory/daemon.json" "$replacement_path" || exit 1
  mv -f "$replacement_path" "$config_path" || exit 1
  replacement_installed=true
  printf '[changqingjing] 热加载腾讯云 Docker 镜像加速器（不重启容器）。\n'
  systemctl reload docker || exit 1
  local attempt
  for attempt in {1..10}; do
    if docker_registry_mirror_is_active; then
      printf '[changqingjing] 腾讯云 Docker 镜像加速器已生效。\n'
      [[ -z "$backup_path" ]] || printf '[changqingjing] 原 Docker 配置已备份：%s\n' "$backup_path"
      exit 0
    fi
    sleep 1
  done
  echo 'Docker 未启用目标镜像加速器，停止部署；请检查 Docker 服务启动参数和日志。' >&2
  exit 1
)

install_runtime() {
  [[ -r /etc/os-release ]] || { echo 'Cannot identify OS.' >&2; return 1; }
  # shellcheck disable=SC1091
  source /etc/os-release
  [[ "${ID:-}" == ubuntu ]] || { echo 'Only Ubuntu is supported.' >&2; return 1; }
  [[ "$EUID" -eq 0 ]] || { echo 'Run bootstrap with sudo to configure Docker.' >&2; return 1; }

  if command -v docker >/dev/null; then
    docker compose version >/dev/null || {
      echo 'Docker exists but the Compose plugin is missing; install it before retrying.' >&2
      return 1
    }
    configure_docker_registry_mirror /etc/docker/daemon.json
    return
  fi

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
    ca-certificates curl openssl util-linux iproute2 git python3
  configure_docker_apt_repository /etc/apt/keyrings/docker.asc /etc/apt/sources.list.d/docker.sources \
    "${UBUNTU_CODENAME:-$VERSION_CODENAME}" "$(dpkg --print-architecture)"
  apt-get -o Acquire::Retries=3 update
  apt-get -o Acquire::Retries=3 install --yes --no-install-recommends \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  docker info >/dev/null
  docker compose version
  configure_docker_registry_mirror /etc/docker/daemon.json
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  install_runtime "$@"
fi
