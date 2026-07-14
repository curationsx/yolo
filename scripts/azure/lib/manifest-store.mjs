// scripts/azure/lib/manifest-store.mjs
//
// Writes and reads local JSON manifests (rollback manifests, acceptance
// snapshots) outside of git, with restrictive file permissions. Never
// writes inside the repository working tree by default.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Resolves the directory used for local, non-git-tracked operational
 * manifests (DNS cutover rollback manifests, etc). Overridable via
 * YOLO_CUTOVER_STATE_DIR for tests and for operators who want a different
 * location; defaults to a dotfile directory under the user's home,
 * deliberately outside any git working tree.
 */
export function resolveStateDir(envOverride = process.env.YOLO_CUTOVER_STATE_DIR) {
  return envOverride || path.join(os.homedir(), ".curationsx-yolo", "cutover");
}

export function writeManifest(dir, name, data) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, name);
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(file, json, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

export function readManifest(file) {
  const contents = fs.readFileSync(file, "utf8");
  return JSON.parse(contents);
}

export function manifestFileName(prefix, timestamp = new Date()) {
  const iso = timestamp.toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${iso}.json`;
}
