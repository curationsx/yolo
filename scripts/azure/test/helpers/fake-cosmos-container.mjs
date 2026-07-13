// scripts/azure/test/helpers/fake-cosmos-container.mjs
//
// Minimal, self-contained in-memory fake of the exact subset of the
// `@azure/cosmos` container interface reconcile-scores.mjs's
// `fetchVotesFromContainer`/`fetchLegacyScoresFromContainer`/
// `writeReconciledScores` actually use (`items.query(...).fetchAll()` and
// `items.upsert(doc, options)`). This lets scripts/azure/test/** exercise
// the real (non-fixture) Cosmos query/write logic -- including the
// legacy-vs-Azure-native doc_type predicate -- without installing the
// optional `@azure/cosmos`/`@azure/identity` packages and without reaching
// a live Cosmos account. This is intentionally NOT a general Cosmos SQL
// emulator: it only understands the two query shapes this script issues.

export class FakeVotesContainer {
  constructor(seedDocs = []) {
    this.docs = seedDocs.map((doc) => ({ ...doc }));
  }

  /** Seeds a true legacy Cloudflare-Worker-written vote document: shaped
   * `{id, target_id, user_id, created_at}` with NO `doc_type` field at
   * all (agent-worker/src/vote-guard.ts:237-243). */
  addLegacyVote(targetId, userId) {
    this.docs.push({ id: `github-${userId}`, target_id: targetId, user_id: userId, created_at: new Date().toISOString() });
    return this;
  }

  /** Seeds an Azure-native vote document: `doc_type: "vote"`
   * (agent-worker/src/platform/azure/community.ts). */
  addAzureVote(targetId, userId) {
    this.docs.push({
      id: `github-${userId}`,
      doc_type: "vote",
      target_id: targetId,
      user_id: userId,
      created_at: new Date().toISOString(),
    });
    return this;
  }

  /** Seeds the same-partition score metadata document that must never be
   * counted as a vote. */
  addScoreMetadataDoc(targetId, count) {
    this.docs.push({ id: "score", doc_type: "score", target_id: targetId, count, updated_at: new Date().toISOString() });
    return this;
  }

  get items() {
    return {
      query: (querySpec) => ({
        fetchAll: async () => {
          const query = typeof querySpec === "string" ? querySpec : querySpec.query;
          const parameters = typeof querySpec === "string" ? [] : querySpec.parameters ?? [];
          const param = (name) => parameters.find((p) => p.name === name)?.value;

          // reconcile-scores.mjs's votes query: count both legacy
          // (no doc_type) and Azure-native (doc_type = 'vote') documents,
          // excluding the score metadata doc.
          if (/target_id AS target, c\.user_id AS viewerId/.test(query)) {
            const voteType = param("@voteType");
            const scoreId = param("@scoreId");
            const resources = this.docs
              .filter((doc) => doc.id !== scoreId)
              .filter((doc) => !Object.hasOwn(doc, "doc_type") || doc.doc_type === voteType)
              .map((doc) => ({ target: doc.target_id, viewerId: doc.user_id }));
            return { resources };
          }
          throw new Error(`FakeVotesContainer: unsupported query shape: ${query}`);
        },
      }),
    };
  }
}

export class FakeScoresContainer {
  constructor(seedDocs = []) {
    // Keyed by (scope, id) exactly like a real container partitioned on
    // `scope` -- but every legacy scores document uses the single
    // `scope: "global"` partition value, so a flat map keyed by `id` is
    // sufficient here and lets tests assert on `.docs`/`.get(id)` directly.
    this.docs = new Map(seedDocs.map((doc) => [doc.id, { ...doc }]));
  }

  get items() {
    return {
      query: (query) => ({
        fetchAll: async () => {
          if (/target_id AS target, c\.count FROM c/.test(query)) {
            const resources = [...this.docs.values()].map((doc) => ({ target: doc.target_id, count: doc.count }));
            return { resources };
          }
          throw new Error(`FakeScoresContainer: unsupported query shape: ${query}`);
        },
      }),
      upsert: async (body, options) => {
        // A real container partitioned on `scope` would reject an upsert
        // whose body doesn't carry the partition key field at all --
        // simulate that so a regression of the earlier {id, target,
        // count}-only write-back bug fails loudly here too.
        if (!Object.hasOwn(body, "scope")) {
          throw new Error("FakeScoresContainer: upsert body is missing the 'scope' partition key field");
        }
        if (options && options.partitionKey !== body.scope) {
          throw new Error(
            `FakeScoresContainer: explicit partitionKey option ('${options.partitionKey}') does not match the document's own 'scope' field ('${body.scope}')`
          );
        }
        if (!Object.hasOwn(body, "target_id")) {
          throw new Error("FakeScoresContainer: upsert body is missing the 'target_id' field required by real readers");
        }
        this.docs.set(body.id, { ...body });
        return { resource: { ...body }, statusCode: 200 };
      },
    };
  }
}
