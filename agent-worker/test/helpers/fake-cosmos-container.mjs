/**
 * In-memory fake implementing the `CosmosContainerLike` contract
 * (src/platform/azure/cosmos-types.ts) so Azure repository tests can cover
 * ETag races, 412/429 handling, and transactional batches without a live
 * Cosmos account.
 */

import assert from "node:assert/strict";

function cosmosError(code, retryAfterInMs) {
  const error = new Error(`simulated cosmos error ${code}`);
  error.code = code;
  if (retryAfterInMs !== undefined) error.retryAfterInMs = retryAfterInMs;
  return error;
}

export class FakeCosmosContainer {
  /** `partitionKeyField` mirrors a real container's fixed partition key
   * path — production Cosmos derives the partition from that configured
   * path, never by guessing from whichever fields happen to be present. */
  constructor(partitionKeyField = "target_id") {
    this.partitionKeyField = partitionKeyField;
    this.documents = new Map();
    this.etagCounter = 0;
    /** Queue of { operation: "read"|"replace"|"delete"|"create"|"upsert"|"batch", code, retryAfterInMs }
     * consumed in order; lets tests force a bounded number of throttled or
     * conflicting responses before the real behavior resumes. */
    this.injectedFailures = [];
  }

  failNext(operation, code, retryAfterInMs) {
    this.injectedFailures.push({ operation, code, retryAfterInMs });
    return this;
  }

  _consumeFailure(operation) {
    const index = this.injectedFailures.findIndex((failure) => failure.operation === operation);
    if (index === -1) return null;
    return this.injectedFailures.splice(index, 1)[0];
  }

  _key(partitionKey, id) {
    return `${partitionKey}\u0000${id}`;
  }

  _nextEtag() {
    this.etagCounter += 1;
    return `etag-${this.etagCounter}`;
  }

  item(id, partitionKey) {
    const key = this._key(partitionKey, id);
    return {
      read: async (_options) => {
        const failure = this._consumeFailure("read");
        if (failure) throw cosmosError(failure.code, failure.retryAfterInMs);
        const entry = this.documents.get(key);
        if (!entry) return { resource: undefined, etag: "", statusCode: 404 };
        return { resource: { ...entry.doc }, etag: entry.etag, statusCode: 200 };
      },
      replace: async (body, options) => {
        const failure = this._consumeFailure("replace");
        if (failure) throw cosmosError(failure.code, failure.retryAfterInMs);
        const entry = this.documents.get(key);
        if (!entry) throw cosmosError(404);
        if (
          options?.accessCondition?.type === "IfMatch" &&
          options.accessCondition.condition !== entry.etag
        ) {
          throw cosmosError(412);
        }
        const etag = this._nextEtag();
        this.documents.set(key, { doc: { ...body }, etag });
        return {
          resource: { ...body },
          etag,
          statusCode: 200,
          headers: { "x-ms-session-token": "fake-session-token" },
        };
      },
      delete: async (options) => {
        const failure = this._consumeFailure("delete");
        if (failure) throw cosmosError(failure.code, failure.retryAfterInMs);
        const entry = this.documents.get(key);
        if (!entry) throw cosmosError(404);
        if (
          options?.accessCondition?.type === "IfMatch" &&
          options.accessCondition.condition !== entry.etag
        ) {
          throw cosmosError(412);
        }
        this.documents.delete(key);
        return { resource: undefined, etag: "", statusCode: 204 };
      },
    };
  }

  get items() {
    return {
      create: async (body) => {
        const failure = this._consumeFailure("create");
        if (failure) throw cosmosError(failure.code, failure.retryAfterInMs);
        const partitionKey = body[this.partitionKeyField];
        const key = this._key(partitionKey, body.id);
        if (this.documents.has(key)) throw cosmosError(409);
        const etag = this._nextEtag();
        this.documents.set(key, { doc: { ...body }, etag });
        return {
          resource: { ...body },
          etag,
          statusCode: 201,
          headers: { "x-ms-session-token": "fake-session-token" },
        };
      },
      upsert: async (body) => {
        const failure = this._consumeFailure("upsert");
        if (failure) throw cosmosError(failure.code, failure.retryAfterInMs);
        const partitionKey = body[this.partitionKeyField];
        const key = this._key(partitionKey, body.id);
        const etag = this._nextEtag();
        this.documents.set(key, { doc: { ...body }, etag });
        return {
          resource: { ...body },
          etag,
          statusCode: 200,
          headers: { "x-ms-session-token": "fake-session-token" },
        };
      },
      query: (querySpec, options) => {
        const partitionKey = options?.partitionKey;
        return {
          fetchAll: async () => {
            const failure = this._consumeFailure("query");
            if (failure) throw cosmosError(failure.code, failure.retryAfterInMs);
            const entries = [...this.documents.entries()]
              .filter(([key]) => partitionKey === undefined || key.startsWith(`${partitionKey}\u0000`))
              .map(([, entry]) => entry.doc);

            // Reconciliation's "count every vote doc, legacy or Azure-native,
            // excluding the score metadata doc" query. Matches documents
            // missing the field entirely (legacy Cloudflare shape) or equal
            // to the given value (Azure-native shape), same as real Cosmos
            // SQL's IS_DEFINED semantics. Supports both parameterized
            // (`@type`) and literal (`'vote'`) forms of the predicate.
            const isDefinedMatch = querySpec.query.match(
              /COUNT\(1\)\s+FROM c\s+WHERE\s+\(NOT IS_DEFINED\(c\.(\w+)\)\s+OR\s+c\.\1\s*=\s*(@\w+|'[^']*')\)\s+AND\s+c\.id\s*!=\s*(@\w+|'[^']*')/i,
            );
            if (isDefinedMatch) {
              const [, field, typeToken, idToken] = isDefinedMatch;
              const resolveToken = (token) =>
                token.startsWith("@")
                  ? (querySpec.parameters ?? []).find((p) => p.name === token)?.value
                  : token.slice(1, -1);
              const typeValue = resolveToken(typeToken);
              const excludedId = resolveToken(idToken);
              const filtered = entries.filter((doc) => {
                if (doc.id === excludedId) return false;
                return !Object.hasOwn(doc, field) || doc[field] === typeValue;
              });
              return { resources: [filtered.length] };
            }

            const countMatch = querySpec.query.match(/COUNT\(1\)\s+FROM c(?:\s+WHERE c\.(\w+) = @(\w+))?/i);
            if (countMatch) {
              const [, field, paramName] = countMatch;
              const filtered = field
                ? entries.filter((doc) => {
                    const parameter = (querySpec.parameters ?? []).find((p) => p.name === `@${paramName}`);
                    return doc[field] === parameter?.value;
                  })
                : entries;
              return { resources: [filtered.length] };
            }
            return { resources: entries };
          },
        };
      },
      batch: async (operations, partitionKey) => {
        const failure = this._consumeFailure("batch");
        if (failure) {
          if (failure.code === "conflict") {
            // A non-throwing partial failure — Cosmos reports 207 with a
            // losing operation's status code rather than throwing.
            return { code: 207, result: operations.map(() => ({ statusCode: 409 })) };
          }
          throw cosmosError(failure.code, failure.retryAfterInMs);
        }

        // Validate every operation before applying any of them — Cosmos
        // transactional batches are all-or-nothing.
        const results = [];
        let allSucceeded = true;
        for (const operation of operations) {
          const key = this._key(partitionKey, operation.id ?? operation.resourceBody?.id);
          const entry = this.documents.get(key);
          if (operation.operationType === "Create") {
            if (entry) {
              results.push({ statusCode: 409 });
              allSucceeded = false;
            } else {
              results.push({ statusCode: 201 });
            }
          } else if (operation.operationType === "Delete") {
            if (!entry) {
              results.push({ statusCode: 404 });
              allSucceeded = false;
            } else if (operation.ifMatch && operation.ifMatch !== entry.etag) {
              results.push({ statusCode: 412 });
              allSucceeded = false;
            } else {
              results.push({ statusCode: 204 });
            }
          } else if (operation.operationType === "Replace") {
            if (!entry) {
              results.push({ statusCode: 404 });
              allSucceeded = false;
            } else if (operation.ifMatch && operation.ifMatch !== entry.etag) {
              results.push({ statusCode: 412 });
              allSucceeded = false;
            } else {
              results.push({ statusCode: 200 });
            }
          } else if (operation.operationType === "Upsert") {
            results.push({ statusCode: 200 });
          } else {
            results.push({ statusCode: 200 });
          }
        }

        if (!allSucceeded) {
          return { code: 207, result: results };
        }

        // Apply all operations now that every precondition passed.
        for (const operation of operations) {
          const key = this._key(partitionKey, operation.id ?? operation.resourceBody?.id);
          if (operation.operationType === "Create" || operation.operationType === "Upsert") {
            this.documents.set(key, { doc: { ...operation.resourceBody }, etag: this._nextEtag() });
          } else if (operation.operationType === "Replace") {
            this.documents.set(key, { doc: { ...operation.resourceBody }, etag: this._nextEtag() });
          } else if (operation.operationType === "Delete") {
            this.documents.delete(key);
          }
        }
        return { code: 200, result: results };
      },
    };
  }
}

export function assertContainerHasDocument(container, partitionKey, id) {
  assert.ok(container.documents.has(container._key(partitionKey, id)));
}
