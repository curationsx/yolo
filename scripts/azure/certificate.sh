#!/usr/bin/env bash
# scripts/azure/certificate.sh
#
# Prepares (but does not, in this task, execute) the temporary ACME DNS-01
# certificate workflow for api.curations.dev described in
# .azure/deployment-plan.md ("API Certificate Cutover"). This script only
# generates key/CSR material and prints the DNS-01 challenge instructions;
# it never prints or commits private key material or the Cloudflare token.
#
# Certificate hygiene (Certbot / DNS-01):
#   - If Certbot is used, --config-dir, --work-dir, and --logs-dir are
#     ALWAYS forced into one private 0700 temp directory created by this
#     script. Certbot's account key, registration state, and issued
#     private key therefore never land in the global Certbot paths
#     (/etc/letsencrypt, /var/lib/letsencrypt, /var/log/letsencrypt) --
#     nothing from a single-use ACME order can leak into a shared/global
#     location or persist across runs.
#   - Automated DNS-01 via Cloudflare (preferred when CLOUDFLARE_API_TOKEN
#     is present in the environment -- never a CLI flag, never printed):
#     an isolated Python venv is created inside that same private temp
#     directory, and a `certbot-dns-cloudflare` credentials file
#     (`dns_cloudflare_api_token = ...`) is written into it at 0600,
#     generated directly from the env var. Certbot's `--dns-cloudflare`
#     plugin then creates/removes the `_acme-challenge` TXT record itself
#     via that credentials file -- no manual DNS step, and the token value
#     never appears in a log line, command-line argument list, or the
#     credentials file's path (only the file's *existence* is mentioned).
#     Falls back to the manual DNS-01 flow (operator creates the TXT
#     record by hand, using a system-installed certbot/acme.sh) when no
#     Cloudflare token is available.
#   - PFX conversion (--convert-to-pfx) exports with a randomly generated
#     password written to its own 0600 file and passed to openssl via
#     `-passout file:...` -- never via a `pass:...` argument, which would
#     otherwise appear in the process list.
#   - The full apply flow is: generate/obtain the certificate inside the
#     isolated directory -> convert to PFX -> upload to the Container Apps
#     environment -> verify the uploaded certificate (see verify.mjs's TLS
#     check) -> securely remove the ENTIRE temporary directory (venv,
#     credentials file, and all Certbot state together) AND the ACME
#     `_acme-challenge` TXT record if it was created manually. Upload and
#     verification require a live Azure session this task does not have,
#     so --apply still stops short of actually running `pip install` or
#     submitting the real ACME order (as directed previously) and instead
#     prepares everything and prints the exact remaining commands for the
#     operator or a follow-up authorized run.
#   - Never echoed, anywhere, under any mode: the ACME TXT challenge value,
#     the Cloudflare API token, the PFX export password, or the private
#     key's file path. (The CSR path, the output PFX path, the Cloudflare
#     credentials file's path, and an operator-supplied password-file path
#     ARE printed when useful -- none of those is the secret itself.)
#
# Modes:
#   (default)          dry run: show the plan, generate nothing
#   --plan             same as default, explicit
#   --generate-csr      generate a private key + CSR in a private 0700/0600
#                       working directory (cleaned up automatically, unless
#                       --keep-workdir is passed for inspection)
#   --convert-to-pfx    convert an existing cert + key to a password-protected
#                       PFX for Container Apps certificate upload. Real and
#                       independently usable regardless of how the
#                       cert/key were obtained.
#   --apply --confirm issue-api-curations-dev
#                       prepares an isolated Certbot + certbot-dns-cloudflare
#                       venv and credentials file when CLOUDFLARE_API_TOKEN
#                       is set (falling back to a system certbot/acme.sh and
#                       the manual DNS-01 flow otherwise). Refuses to run if
#                       neither a Cloudflare token nor an installed ACME
#                       client is available.
#
# Usage:
#   scripts/azure/certificate.sh [--plan]
#   scripts/azure/certificate.sh --generate-csr [--domain <fqdn>] [--keep-workdir]
#   scripts/azure/certificate.sh --convert-to-pfx --cert <path> --key <path>
#                        [--chain <path>] --out <path.pfx>
#                        [--password-file <path>] [--keep-workdir]
#   scripts/azure/certificate.sh --apply --confirm issue-api-curations-dev [--domain <fqdn>]
#
# Safety guarantees:
#   - Default action is read-only planning output.
#   - All secret-bearing material (private keys, PFX passwords, and the
#     Cloudflare credentials file) is written only under a private (0700)
#     temp directory with files at 0600, removed by an EXIT/INT/TERM trap.
#   - No private key, CSR, certificate, PFX password, or Cloudflare token
#     content is ever printed to stdout.
#   - The Cloudflare API token is read only from the CLOUDFLARE_API_TOKEN
#     environment variable -- never a CLI flag, never logged, never
#     embedded in a file outside the private temp directory.
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=lib/config.sh
source "${SCRIPT_DIR}/lib/config.sh"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

MODE="plan"
DOMAIN="${YOLO_API_DOMAIN}"
KEEP_WORKDIR=0
CONFIRM_TOKEN=""
ISSUE_CONFIRM_PHRASE="issue-${YOLO_API_DOMAIN//./-}"
WORKDIR=""

# --convert-to-pfx arguments
PFX_CERT=""
PFX_KEY=""
PFX_CHAIN=""
PFX_OUT=""
PFX_PASSWORD_FILE=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [--plan]
       $(basename "$0") --generate-csr [--domain <fqdn>] [--keep-workdir]
       $(basename "$0") --convert-to-pfx --cert <path> --key <path> [--chain <path>]
                        --out <path.pfx> [--password-file <path>] [--keep-workdir]
       $(basename "$0") --apply --confirm ${ISSUE_CONFIRM_PHRASE} [--domain <fqdn>]

Default mode only prints the certificate cutover plan. No key material is
generated. Certificate issuance never happens implicitly.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan) MODE="plan"; shift ;;
    --generate-csr) MODE="generate-csr"; shift ;;
    --convert-to-pfx) MODE="convert-to-pfx"; shift ;;
    --apply) MODE="apply"; shift ;;
    --confirm)
      require_flag_value "--confirm" "${2-}"
      CONFIRM_TOKEN="$2"; shift 2 ;;
    --domain)
      require_flag_value "--domain" "${2-}"
      DOMAIN="$2"; shift 2 ;;
    --cert)
      require_flag_value "--cert" "${2-}"
      PFX_CERT="$2"; shift 2 ;;
    --key)
      require_flag_value "--key" "${2-}"
      PFX_KEY="$2"; shift 2 ;;
    --chain)
      require_flag_value "--chain" "${2-}"
      PFX_CHAIN="$2"; shift 2 ;;
    --out)
      require_flag_value "--out" "${2-}"
      PFX_OUT="$2"; shift 2 ;;
    --password-file)
      require_flag_value "--password-file" "${2-}"
      PFX_PASSWORD_FILE="$2"; shift 2 ;;
    --keep-workdir) KEEP_WORKDIR=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

cleanup() {
  local status=$?
  if [[ -n "$WORKDIR" && -d "$WORKDIR" ]]; then
    if [[ "$KEEP_WORKDIR" == "1" ]]; then
      log_warn "Leaving certificate material at $WORKDIR (0700/0600) for manual inspection. Delete it when finished."
    else
      # Precise, path-scoped removal only -- never a broad/recursive glob
      # outside this one private working directory.
      if command -v shred >/dev/null 2>&1; then
        for f in "$WORKDIR"/*; do
          [[ -f "$f" ]] && shred -u -- "$f" 2>/dev/null
        done
      fi
      rm -rf -- "$WORKDIR"
      log_info "Cleaned up temporary certificate working directory."
    fi
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

print_plan() {
  local dns_mode_note
  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    dns_mode_note="CLOUDFLARE_API_TOKEN is set: --apply prefers the automated certbot-dns-cloudflare plugin (an isolated Python venv + a 0600 credentials file built from that env var, inside the same private directory), so no manual TXT record step is needed."
  else
    dns_mode_note="No CLOUDFLARE_API_TOKEN in the environment: --apply falls back to manual DNS-01 with a system-installed certbot/acme.sh."
  fi
  cat <<EOF
Certificate cutover plan for ${DOMAIN} (dry run -- nothing generated):

${dns_mode_note}

  1. Generate a private key + CSR for ${DOMAIN} in a private 0700 directory
     (private key file mode 0600). If using Certbot instead, its
     --config-dir/--work-dir/--logs-dir are ALL forced into that same
     private 0700 directory -- never the global Certbot paths -- so its
     account key and issued private key never land anywhere shared.
  2. DNS-01 challenge: with a Cloudflare token, certbot-dns-cloudflare
     creates/removes the _acme-challenge TXT record itself via a 0600
     credentials file built from CLOUDFLARE_API_TOKEN (never printed, never
     embedded outside that one private directory). Without a token, the
     operator manually creates _acme-challenge.${DOMAIN%%.*}... TXT record
     in Cloudflare (or via a separately authorized DNS tool) instead.
  3. Operator (manual mode only) confirms DNS propagation (e.g.
     'dig TXT _acme-challenge.${DOMAIN}').
  4. Run Certbot, isolated as above, to complete validation and obtain the
     certificate + chain.
  5. Convert the certificate + key to a password-protected PFX with
     '$(basename "$0") --convert-to-pfx' (random password, written to its
     own 0600 file, passed to openssl via -passout file:... so it is never
     visible in the process list), then upload it to the Container Apps
     environment ('az containerapp env certificate upload'). This
     temporary certificate is what bridges TLS for api.curations.dev
     during the cut-api step of scripts/azure/cutover.mjs.
  6. Verify the uploaded certificate (e.g. 'node scripts/azure/verify.mjs
     --gateway-url https://api.curations.dev' -- its TLS check confirms
     validity and expiry) before relying on it.
  7. Securely remove the ENTIRE temporary working directory -- venv,
     Cloudflare credentials file, and all Certbot state together (already
     automatic on exit unless --keep-workdir was used) -- and, in manual
     mode only, delete the ACME _acme-challenge TXT record from Cloudflare
     (automatic in Cloudflare-token mode, since certbot-dns-cloudflare
     removes its own challenge record after validation).
  8. Azure's free managed certificate for api.curations.dev cannot issue
     until the gateway's default-deny IP restriction is removed (DigiCert
     must be able to reach the app) -- that only happens after every
     internal/manual acceptance check passes, per the plan's Stage 5. Keep
     this temporary certificate bound until then.
  9. After the IP restriction is removed and Azure reports the managed
     certificate 'Secured', remove the temporary one.

Note: this certificate only bridges api.curations.dev. curations.dev and
www.curations.dev do not need this workflow -- scripts/azure/cutover.mjs
prevalidates both as Azure Static Web Apps custom hostnames
('dns-txt-token' method) before cutover, and Azure issues their managed
certificates automatically once the CNAME points at the Static Web App.

Never echoed, anywhere: the ACME TXT challenge value, the Cloudflare API
token, the PFX export password, or the private key's file path. No
certificate private key ever enters git, GitHub artifacts, shell history,
or logs. Run with --generate-csr to create key/CSR material, --convert-to-pfx
to package an existing cert+key, or --apply --confirm ${ISSUE_CONFIRM_PHRASE}
to prepare (but not submit) the ACME order.
EOF
}

detect_acme_client() {
  if command -v certbot >/dev/null 2>&1; then
    printf 'certbot\n'
  elif command -v acme.sh >/dev/null 2>&1; then
    printf 'acme.sh\n'
  else
    printf '\n'
  fi
}

# Builds the three isolated Certbot directories under one private 0700
# working directory, so account/private-key material never lands in the
# global Certbot paths (/etc/letsencrypt, /var/lib/letsencrypt,
# /var/log/letsencrypt). Sets CERTBOT_CONFIG_DIR/CERTBOT_WORK_DIR/
# CERTBOT_LOGS_DIR (intentionally not `local`, so the caller can read them
# directly rather than parsing captured stdout). Nothing sensitive is
# printed here -- these are just directory paths, created empty.
build_certbot_isolated_dirs() {
  local workdir="$1"
  CERTBOT_CONFIG_DIR="${workdir}/certbot-config"
  CERTBOT_WORK_DIR="${workdir}/certbot-work"
  CERTBOT_LOGS_DIR="${workdir}/certbot-logs"
  mkdir -p -- "$CERTBOT_CONFIG_DIR" "$CERTBOT_WORK_DIR" "$CERTBOT_LOGS_DIR"
  chmod 0700 "$CERTBOT_CONFIG_DIR" "$CERTBOT_WORK_DIR" "$CERTBOT_LOGS_DIR"
}

# Prepares an isolated Python venv + a certbot-dns-cloudflare credentials
# file, both inside the given private working directory, from
# CLOUDFLARE_API_TOKEN. Real and fast (no network call) -- venv creation is
# purely local. Sets CLOUDFLARE_VENV_DIR and CLOUDFLARE_CREDENTIALS_FILE
# (intentionally not `local`, mirroring build_certbot_isolated_dirs) so the
# caller can reference them without re-parsing output. The token value is
# never printed; only the credentials file's *path* is (its presence, not
# its content, is what an operator needs to chain the next command).
prepare_cloudflare_dns_plugin() {
  local workdir="$1"
  require_cmd python3
  CLOUDFLARE_VENV_DIR="${workdir}/venv"
  CLOUDFLARE_CREDENTIALS_FILE="${workdir}/cloudflare-credentials.ini"

  log_step "Creating an isolated Python virtual environment for Certbot + certbot-dns-cloudflare"
  python3 -m venv "$CLOUDFLARE_VENV_DIR" >/dev/null 2>&1

  ( umask 077 && printf 'dns_cloudflare_api_token = %s\n' "$CLOUDFLARE_API_TOKEN" > "$CLOUDFLARE_CREDENTIALS_FILE" )
  chmod 0600 "$CLOUDFLARE_CREDENTIALS_FILE"

  log_info "Cloudflare DNS-01 credentials file created (0600) at: $CLOUDFLARE_CREDENTIALS_FILE"
  log_info "Its value (the API token) is never printed."
}

generate_csr() {
  require_cmd openssl
  WORKDIR="$(make_private_workdir "yolo-cert")"
  local key_file="${WORKDIR}/${DOMAIN}.key"
  local csr_file="${WORKDIR}/${DOMAIN}.csr"

  log_step "Generating private key + CSR for ${DOMAIN} in a private working directory"
  ( umask 077 && openssl genrsa -out "$key_file" 2048 >/dev/null 2>&1 )
  chmod 0600 "$key_file"
  openssl req -new -key "$key_file" -subj "/CN=${DOMAIN}" -out "$csr_file" >/dev/null 2>&1
  chmod 0600 "$csr_file"

  log_info "Private key generated (0600). Its file path is deliberately not printed to logs."
  log_info "CSR (public, safe to reference): $csr_file"
  log_info "Next: create the _acme-challenge TXT record manually in Cloudflare, then re-run with --apply."
  if [[ "$KEEP_WORKDIR" == "1" ]]; then
    log_warn "--keep-workdir set: material will remain on disk under $WORKDIR after this script exits. Handle it like a secret."
  fi
}

convert_to_pfx() {
  require_cmd openssl
  [[ -n "$PFX_CERT" ]] || die "--convert-to-pfx requires --cert <path>"
  [[ -n "$PFX_KEY" ]] || die "--convert-to-pfx requires --key <path>"
  [[ -n "$PFX_OUT" ]] || die "--convert-to-pfx requires --out <path.pfx>"
  [[ -f "$PFX_CERT" ]] || die "Certificate file not found: $PFX_CERT"
  [[ -f "$PFX_KEY" ]] || die "Key file not found: $PFX_KEY"
  if [[ -n "$PFX_CHAIN" && ! -f "$PFX_CHAIN" ]]; then
    die "Chain file not found: $PFX_CHAIN"
  fi

  WORKDIR="$(make_private_workdir "yolo-cert-pfx")"

  local password_file="$PFX_PASSWORD_FILE"
  local generated_password_file=0
  if [[ -z "$password_file" ]]; then
    password_file="${WORKDIR}/pfx.pass"
    ( umask 077 && openssl rand -base64 24 > "$password_file" )
    chmod 0600 "$password_file"
    generated_password_file=1
  elif [[ ! -f "$password_file" ]]; then
    die "--password-file $password_file does not exist"
  fi

  log_step "Converting certificate + key to a password-protected PFX"
  local cmd=(openssl pkcs12 -export
    -in "$PFX_CERT"
    -inkey "$PFX_KEY"
    -out "$PFX_OUT"
    -passout "file:${password_file}")
  if [[ -n "$PFX_CHAIN" ]]; then
    cmd+=(-certfile "$PFX_CHAIN")
  fi
  # The password is passed via -passout file:... (never pass:...) so it is
  # never visible as a plain command-line argument in the process list.
  "${cmd[@]}" >/dev/null 2>&1
  chmod 0600 "$PFX_OUT"

  log_info "PFX written: $PFX_OUT (0600)"
  if [[ "$generated_password_file" == "1" ]]; then
    log_info "PFX password (never printed) written to a 0600 file: $password_file"
    log_warn "This password file lives inside a temporary working directory and is removed on exit unless --keep-workdir is set. Copy it out first if you need it beyond this run."
  else
    log_info "PFX password read from the provided --password-file (contents never printed)."
  fi
  log_info "Next: upload with 'az containerapp env certificate upload', verify with verify.mjs's TLS check, then delete this PFX/password and the ACME TXT record."
}

apply_issue() {
  require_exact_confirmation "$CONFIRM_TOKEN" "$ISSUE_CONFIRM_PHRASE"

  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    apply_issue_cloudflare_dns_plugin
  else
    apply_issue_manual_dns01
  fi
}

# Preferred path when CLOUDFLARE_API_TOKEN is available: an isolated venv +
# certbot-dns-cloudflare automates the DNS-01 challenge entirely (no manual
# TXT record step). Still stops short of actually running pip/certbot --
# this task defers real ACME issuance -- but every piece of real,
# non-network, offline preparation (isolated dirs, venv, 0600 credentials
# file from the env token) happens for real.
apply_issue_cloudflare_dns_plugin() {
  log_info "CLOUDFLARE_API_TOKEN detected: using the automated certbot-dns-cloudflare plugin (no manual TXT record step)."

  WORKDIR="$(make_private_workdir "yolo-cert")"
  build_certbot_isolated_dirs "$WORKDIR"
  local config_dir="$CERTBOT_CONFIG_DIR" work_dir="$CERTBOT_WORK_DIR" logs_dir="$CERTBOT_LOGS_DIR"
  prepare_cloudflare_dns_plugin "$WORKDIR"
  local venv_dir="$CLOUDFLARE_VENV_DIR" creds_file="$CLOUDFLARE_CREDENTIALS_FILE"

  log_step "Preparing automated DNS-01 challenge for ${DOMAIN} via certbot-dns-cloudflare"
  log_info "Isolated Certbot directories created (never the global Certbot paths):"
  log_info "  config-dir: $config_dir"
  log_info "  work-dir:   $work_dir"
  log_info "  logs-dir:   $logs_dir"
  log_warn "This task explicitly defers actual certificate issuance. Refusing to run pip install or submit the ACME order."
  log_info "Remaining steps once you intentionally continue outside this task:"
  log_info "  1. Run: $venv_dir/bin/pip install --quiet certbot certbot-dns-cloudflare"
  log_info "  2. Run: $venv_dir/bin/certbot certonly --dns-cloudflare \\"
  log_info "       --dns-cloudflare-credentials '$creds_file' \\"
  log_info "       --config-dir '$config_dir' --work-dir '$work_dir' --logs-dir '$logs_dir' \\"
  log_info "       -d '$DOMAIN' --non-interactive --agree-tos"
  log_info "     (certbot-dns-cloudflare creates AND removes the _acme-challenge TXT record itself -- no manual DNS step, and it never appears in a log line.)"
  log_info "  3. Convert the result with: $(basename "$0") --convert-to-pfx --cert <fullchain> --key <privkey> --out <path.pfx>"
  log_info "  4. Upload the PFX via 'az containerapp env certificate upload', then verify with verify.mjs's TLS check."
  log_info "  5. Securely remove this entire working directory ($WORKDIR) -- venv, credentials file, and all Certbot state together -- already automatic on exit."
  exit 0
}

# Fallback path when no Cloudflare token is available: a system-installed
# certbot/acme.sh drives manual DNS-01, and the operator creates the
# _acme-challenge TXT record by hand.
apply_issue_manual_dns01() {
  local client
  client="$(detect_acme_client)"
  if [[ -z "$client" ]]; then
    die "No supported ACME client (certbot or acme.sh) found on PATH, and no CLOUDFLARE_API_TOKEN in the environment to use the automated plugin. Install one, or export CLOUDFLARE_API_TOKEN, before running --apply."
  fi
  log_info "Detected ACME client: $client"

  WORKDIR="$(make_private_workdir "yolo-cert")"
  build_certbot_isolated_dirs "$WORKDIR"
  local config_dir="$CERTBOT_CONFIG_DIR" work_dir="$CERTBOT_WORK_DIR" logs_dir="$CERTBOT_LOGS_DIR"

  log_step "Preparing manual DNS-01 challenge for ${DOMAIN} using $client"
  log_info "Isolated Certbot directories created (never the global Certbot paths):"
  log_info "  config-dir: $config_dir"
  log_info "  work-dir:   $work_dir"
  log_info "  logs-dir:   $logs_dir"
  log_warn "This task explicitly defers actual certificate issuance. Refusing to submit the ACME order."
  log_info "Manual next steps once you intentionally continue outside this task:"
  log_info "  1. Run: certbot certonly --manual --preferred-challenges dns-01 \\"
  log_info "       --config-dir '$config_dir' --work-dir '$work_dir' --logs-dir '$logs_dir' \\"
  log_info "       -d '$DOMAIN' --non-interactive --agree-tos"
  log_info "  2. Create _acme-challenge.${DOMAIN} TXT record in Cloudflare with the token $client provides (never logged)."
  log_info "  3. Wait for propagation, then let $client complete validation."
  log_info "  4. Convert the result with: $(basename "$0") --convert-to-pfx --cert <fullchain> --key <privkey> --out <path.pfx>"
  log_info "  5. Upload the PFX via 'az containerapp env certificate upload', then verify with verify.mjs's TLS check."
  log_info "  6. Securely remove this entire working directory ($WORKDIR) -- already automatic on exit -- AND delete the ACME TXT record from Cloudflare."
  exit 0
}

case "$MODE" in
  plan) print_plan ;;
  generate-csr) generate_csr ;;
  convert-to-pfx) convert_to_pfx ;;
  apply) apply_issue ;;
esac
