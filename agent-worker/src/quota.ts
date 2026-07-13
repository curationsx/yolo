/**
 * Atomic daily quota reservations.
 *
 * One Durable Object instance is used per UTC day. Its storage transaction
 * checks every rule before incrementing any of them, so rejected personal
 * requests never consume the global Azure allowance.
 */

export interface QuotaRule {
  key: string;
  limit: number;
}

interface QuotaResult {
  allowed: boolean;
  blocked_key?: string;
}

interface QuotaEnv {
  QUOTA: DurableObjectNamespace;
}

export class QuotaGuard {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    let rules: QuotaRule[];
    try {
      const body = (await req.json()) as { rules?: QuotaRule[] };
      rules = body.rules ?? [];
    } catch {
      return Response.json({ allowed: false }, { status: 400 });
    }
    if (
      !rules.length ||
      rules.length > 5 ||
      rules.some(
        (rule) =>
          !rule.key ||
          rule.key.length > 180 ||
          !Number.isSafeInteger(rule.limit) ||
          rule.limit < 1,
      )
    ) {
      return Response.json({ allowed: false }, { status: 400 });
    }

    const result = await this.state.storage.transaction<QuotaResult>(async (txn) => {
      const keys = rules.map((rule) => rule.key);
      const current = await txn.get<number>(keys);
      for (const rule of rules) {
        if ((current.get(rule.key) ?? 0) >= rule.limit) {
          return { allowed: false, blocked_key: rule.key };
        }
      }
      const updates: Record<string, number> = {};
      for (const rule of rules) {
        updates[rule.key] = (current.get(rule.key) ?? 0) + 1;
      }
      await txn.put(updates);
      return { allowed: true };
    });
    return Response.json(result);
  }
}

export async function reserveDailyQuota(
  env: QuotaEnv,
  rules: QuotaRule[],
): Promise<QuotaResult> {
  const date = new Date().toISOString().slice(0, 10);
  const id = env.QUOTA.idFromName(`daily:${date}`);
  const response = await env.QUOTA.get(id).fetch("https://quota.internal/reserve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rules }),
  });
  if (!response.ok) throw new Error(`quota guard failed: ${response.status}`);
  return (await response.json()) as QuotaResult;
}
