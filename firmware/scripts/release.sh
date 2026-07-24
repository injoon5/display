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
ARTIFACT_PATH="${OUT_DIR}/matrix-panel-${CHANNEL}.bin"

# Prefer a published object URL; otherwise a local file:// placeholder for device-side testing.
URL="${R2_URL:-file://${ARTIFACT_PATH}}"

if [[ -n "${OTA_SIGNATURE:-}" ]]; then
  SIGNATURE="${OTA_SIGNATURE}"
  if [[ ! "${SIGNATURE}" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "OTA_SIGNATURE must be exactly 64 hex characters" >&2
    exit 1
  fi
elif [[ -n "${OTA_SIGNING_KEY:-}" ]]; then
  echo "OTA_SIGNING_KEY is set; provide the 64-hex ed25519 signature via OTA_SIGNATURE." >&2
  echo "Production must sign the image digest with the factory ed25519 private key." >&2
  exit 1
else
  # Demo/dev only: deterministic 64-hex stand-in derived from the binary sha256.
  # This is NOT a real ed25519 signature. Production must set OTA_SIGNATURE
  # (from a factory key) and bake MX_OTA_ED25519_PUBKEY_HEX into the firmware.
  SIGNATURE="${SHA256}"
  echo "No OTA_SIGNING_KEY/OTA_SIGNATURE set; using demo sha256 stand-in signature" >&2
fi

cat > "${OUT_DIR}/manifest.json" <<EOF
{
  "version": "${MX_FW_VERSION:-0.1.0}",
  "channel": "${CHANNEL}",
  "url": "${URL}",
  "sha256": "${SHA256}",
  "signature": "${SIGNATURE}"
}
EOF

echo "Wrote ${OUT_DIR}/matrix-panel-${CHANNEL}.bin"
echo "Wrote ${OUT_DIR}/manifest.json"
echo "url=${URL}"
echo "signature=${SIGNATURE}"
echo "Production: set R2_URL to the published artifact and OTA_SIGNATURE to a real ed25519 signature."
