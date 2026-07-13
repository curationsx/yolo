// scripts/azure/lib/redaction.mjs
//
// Shared secret-redaction helpers for the Node-based scripts/azure/*.mjs
// tools (verify.mjs, reconcile-scores.mjs, cutover.mjs). Mirrors the intent
// of scripts/azure/lib/common.sh's redact_line for bash: never let a secret
// reach stdout/stderr, even as a backstop over a caller mistake.

// Patterns that indicate a value is secret-shaped and must be redacted
// before logging or including in any report. This is deliberately broad;
// false positives (over-redaction) are safe, false negatives are not.
const SECRET_KEY_PATTERN =
  /(client[_-]?secret|api[_-]?key|token|password|secret|authorization|private[_-]?key|bearer)/i;

const SECRET_VALUE_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9]{20,}/g, // GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_)
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT-shaped
];

/**
 * Redacts "key: value" / "key=value" pairs whose key looks secret-shaped,
 * plus any value matching a known secret-value shape, from a line of text.
 * @param {string} line
 * @returns {string}
 */
export function redactLine(line) {
  if (typeof line !== "string") return line;
  let out = line.replace(
    new RegExp(`(${SECRET_KEY_PATTERN.source})([\"']?\\s*[:=]\\s*)([^\\s,"']+)`, "gi"),
    "$1$2[REDACTED]"
  );
  for (const pattern of SECRET_VALUE_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

/**
 * Scans arbitrary response/body text for secret-shaped substrings without
 * ever returning the secret itself -- only a redacted preview and a count,
 * suitable for inclusion in a verification report.
 * @param {string} text
 * @returns {{ leaked: boolean, findings: Array<{ pattern: string, preview: string }> }}
 */
export function scanForSecretLeak(text) {
  if (typeof text !== "string" || text.length === 0) {
    return { leaked: false, findings: [] };
  }
  const findings = [];
  for (const pattern of SECRET_VALUE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      findings.push({
        pattern: pattern.source.slice(0, 24),
        preview: `${match[0].slice(0, 6)}...[REDACTED]`,
      });
      if (match.index === re.lastIndex) re.lastIndex++;
    }
  }
  // Also flag "authorization: <value>" style headers embedded in body dumps.
  const headerLeak = /(authorization|cookie|set-cookie)\s*:\s*\S+/gi;
  let match;
  while ((match = headerLeak.exec(text)) !== null) {
    findings.push({ pattern: "header-leak", preview: redactLine(match[0]) });
  }
  return { leaked: findings.length > 0, findings };
}

export function redactObject(obj) {
  if (obj == null) return obj;
  if (typeof obj === "string") return redactLine(obj);
  if (Array.isArray(obj)) return obj.map(redactObject);
  if (typeof obj === "object") {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactObject(value);
    }
    return out;
  }
  return obj;
}
