#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAURI_CONFIG_PATH="${ROOT_DIR}/src-tauri/tauri.conf.json"
BUNDLE_DIR="${ROOT_DIR}/src-tauri/target/release/bundle"

show_help() {
  cat <<'EOF'
Usage:
  npm run installers -- [options]
  ./scripts/build-installers.sh [options]

Options:
  --bundles <list>   Bundle types to generate. Example: deb,rpm,appimage
  --target <triple>  Rust target triple. Example: x86_64-pc-windows-msvc
  --debug            Build installers from a debug build.
  --ci               Run Tauri in CI mode, skipping prompts.
  --clean            Remove existing bundle artifacts before building.
  --skip-checks      Skip local frontend and Rust checks before packaging.
  --verbose          Print verbose Tauri output.
  -h, --help         Show this help.

Examples:
  ./scripts/build-installers.sh
  ./scripts/build-installers.sh --bundles deb,rpm,appimage --ci
  ./scripts/build-installers.sh --target x86_64-unknown-linux-gnu --bundles appimage --ci
EOF
}

fail() {
  echo "[installers] $1" >&2
  exit 1
}

require_value() {
  local option="$1"
  local value="${2:-}"

  if [[ -z "${value}" || "${value}" == -* ]]; then
    fail "${option} requires a value"
  fi
}

format_relative() {
  local path="$1"
  realpath --relative-to="${ROOT_DIR}" "${path}" 2>/dev/null || printf '%s\n' "${path}"
}

bundles=""
target=""
debug=false
ci=false
clean=false
skip_checks=false
verbose=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    --bundles|-b)
      require_value "$1" "${2:-}"
      bundles="$2"
      shift 2
      ;;
    --bundles=*)
      bundles="${1#--bundles=}"
      [[ -n "${bundles}" ]] || fail "--bundles requires at least one bundle type"
      shift
      ;;
    --target|-t)
      require_value "$1" "${2:-}"
      target="$2"
      shift 2
      ;;
    --target=*)
      target="${1#--target=}"
      [[ -n "${target}" ]] || fail "--target requires a Rust target triple"
      shift
      ;;
    --debug)
      debug=true
      shift
      ;;
    --ci)
      ci=true
      shift
      ;;
    --clean)
      clean=true
      shift
      ;;
    --skip-checks)
      skip_checks=true
      shift
      ;;
    --verbose)
      verbose=true
      shift
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

cd "${ROOT_DIR}"

[[ -f "${TAURI_CONFIG_PATH}" ]] || fail "Could not find Tauri config at $(format_relative "${TAURI_CONFIG_PATH}")"

if ! npm run tauri -- --version >/dev/null 2>&1; then
  fail "Could not run Tauri CLI through npm. Run npm install before generating installers."
fi

if [[ "${clean}" == true && -d "${BUNDLE_DIR}" ]]; then
  echo "[installers] Removing $(format_relative "${BUNDLE_DIR}")"
  rm -rf "${BUNDLE_DIR}"
fi

if [[ "${skip_checks}" == false ]]; then
  echo "[installers] Running project checks"
  npm run check
fi

tauri_args=(run tauri -- build)

[[ "${debug}" == true ]] && tauri_args+=(--debug)
[[ "${ci}" == true ]] && tauri_args+=(--ci)
[[ "${verbose}" == true ]] && tauri_args+=(--verbose)
[[ -n "${target}" ]] && tauri_args+=(--target "${target}")
[[ -n "${bundles}" ]] && tauri_args+=(--bundles "${bundles}")

echo "[installers] Building with Tauri: npm ${tauri_args[*]}"
npm "${tauri_args[@]}"

if [[ ! -d "${BUNDLE_DIR}" ]]; then
  echo "[installers] Build finished, but no bundle directory was found at $(format_relative "${BUNDLE_DIR}")"
  exit 0
fi

mapfile -t installers < <(
  find "${BUNDLE_DIR}" -type f \( \
    -iname '*.AppImage' -o \
    -iname '*.deb' -o \
    -iname '*.dmg' -o \
    -iname '*.exe' -o \
    -iname '*.msi' -o \
    -iname '*.pkg' -o \
    -iname '*.rpm' \
  \) | sort
)

if [[ "${#installers[@]}" -eq 0 ]]; then
  echo "[installers] Build finished, but no installer files were found in $(format_relative "${BUNDLE_DIR}")"
  exit 0
fi

echo "[installers] Generated installer artifacts:"
for installer in "${installers[@]}"; do
  echo "- $(format_relative "${installer}")"
done
