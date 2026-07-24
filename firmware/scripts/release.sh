#!/usr/bin/env bash
set -euo pipefail

CHANNEL="${1:-stable}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build"
OUT_DIR="${ROOT_DIR}/dist/${CHANNEL}"

mkdir -p "${OUT_DIR}"

cd "${ROOT_DIR}"
idf.py build

BIN_PATH="${BUILD_DIR}/matrix_portal_s3_firmware.bin"
if [[ ! -f "${BIN_PATH}" ]]; then
  echo "Firmware binary not found at ${BIN_PATH}" >&2
  exit 1
fi

SHA256="$(sha256sum "${BIN_PATH}" | awk '{print $1}')"
cp "${BIN_PATH}" "${OUT_DIR}/matrix-panel-${CHANNEL}.bin"

cat > "${OUT_DIR}/manifest.json" <<EOF
{
  "version": "${MX_FW_VERSION:-0.1.0}",
  "channel": "${CHANNEL}",
  "url": "REPLACE_WITH_R2_URL",
  "sha256": "${SHA256}",
  "signature": "ED25519_SIGNATURE_TODO"
}
EOF

echo "Wrote ${OUT_DIR}/matrix-panel-${CHANNEL}.bin"
echo "Wrote ${OUT_DIR}/manifest.json"
echo "TODO: sign manifest with factory ed25519 private key before publishing"
