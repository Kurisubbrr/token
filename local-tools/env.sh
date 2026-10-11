#!/usr/bin/env bash
# Shared paths for the local Mac development environment.
if [[ -n "${BASH_VERSION:-}" ]]; then
    TOKEN_ENV_SOURCE="${BASH_SOURCE[0]}"
elif [[ -n "${ZSH_VERSION:-}" ]]; then
    TOKEN_ENV_SOURCE="${(%):-%x}"
else
    printf 'Use bash or zsh to load the local environment.\n' >&2
    return 1
fi
TOKEN_ROOT="$(cd "$(dirname "${TOKEN_ENV_SOURCE}")/.." && pwd)"
TOKEN_WORKSPACE="$(cd "${TOKEN_ROOT}/.." && pwd)"
export CONTAINER_APP_ROOT="${TOKEN_WORKSPACE}/runtime-data"
export CONTAINER_INSTALL_ROOT="${TOKEN_WORKSPACE}/runtime/apple"
export PATH="${CONTAINER_INSTALL_ROOT}/bin:${TOKEN_WORKSPACE}/runtime/node-tools/node_modules/.bin:${TOKEN_WORKSPACE}/runtime/go/bin:${PATH}"
TOKEN_NODE="$(command -v node || true)"
if [[ -z "${TOKEN_NODE}" ]]; then
    for candidate in "${HOME}"/.nvm/versions/node/*/bin/node; do
        [[ -x "${candidate}" ]] && TOKEN_NODE="${candidate}"
    done
fi
if [[ -z "${TOKEN_NODE}" ]]; then
    printf 'Node.js was not found. Open this script from a terminal with Node.js installed.\n' >&2
    exit 1
fi
export PATH="${TOKEN_WORKSPACE}/runtime/node-tools/node_modules/.bin:$(dirname "${TOKEN_NODE}"):${PATH}"
mkdir -p "${TOKEN_ROOT}/.dev"
