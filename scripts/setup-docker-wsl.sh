#!/usr/bin/env bash
# Instala o Docker Engine (nativo, sem Docker Desktop) no Ubuntu do WSL2.
# Requisito: systemd habilitado em /etc/wsl.conf ([boot] systemd=true).
# Uso: sudo bash scripts/setup-docker-wsl.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo: sudo bash scripts/setup-docker-wsl.sh" >&2
  exit 1
fi

USUARIO="${SUDO_USER:-}"
if [ -z "$USUARIO" ] || [ "$USUARIO" = "root" ]; then
  echo "Rode via sudo a partir do seu usuário (não como root direto)." >&2
  exit 1
fi

if [ "$(ps -p 1 -o comm=)" != "systemd" ]; then
  echo "systemd não está ativo. Adicione em /etc/wsl.conf:" >&2
  echo "  [boot]" >&2
  echo "  systemd=true" >&2
  echo "e rode 'wsl --shutdown' no PowerShell antes de tentar de novo." >&2
  exit 1
fi

# Repositório oficial da Docker (https://docs.docker.com/engine/install/ubuntu/)
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now containerd docker

# Permite usar docker sem sudo
usermod -aG docker "$USUARIO"

docker run --rm hello-world

echo
echo "Docker instalado. Feche e reabra o terminal do WSL (ou rode 'newgrp docker')"
echo "para o grupo 'docker' valer para o usuário $USUARIO."
