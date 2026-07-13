// scripts/azure/lib/cli-args.mjs
//
// Small dependency-free argument parser shared by the scripts/azure/*.mjs
// CLIs. Intentionally minimal: no external package, no dynamic eval of
// argument values, precise flag matching only.

/**
 * Parses process.argv-style arguments against a spec of known flags.
 * @param {string[]} argv - arguments after the script path (e.g. process.argv.slice(2))
 * @param {Record<string, { type: "boolean"|"string", default?: any }>} spec
 * @returns {{ values: Record<string, any>, unknown: string[] }}
 */
export function parseArgs(argv, spec) {
  const values = {};
  for (const [name, def] of Object.entries(spec)) {
    values[name] = def.type === "boolean" ? Boolean(def.default) : def.default;
  }
  const unknown = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      unknown.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (!(name in spec)) {
      unknown.push(arg);
      continue;
    }
    const def = spec[name];
    if (def.type === "boolean") {
      values[name] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new CliArgError(`Missing value for --${name}`);
    }
    values[name] = next;
    i++;
  }
  return { values, unknown };
}

export class CliArgError extends Error {
  constructor(message) {
    super(message);
    this.name = "CliArgError";
  }
}
