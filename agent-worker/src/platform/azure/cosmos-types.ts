/**
 * Narrow Cosmos container contract used by the Azure state and community
 * repositories. The real `@azure/cosmos` `Container` class satisfies this
 * shape structurally, so production code passes it directly with no cast.
 * Unit tests implement this interface with small in-memory fakes instead of
 * a live Cosmos account, which is what makes 100% branch coverage of ETag
 * races, 412/429 handling, and transactional batches possible.
 *
 * Cosmos items are loosely-typed JSON (`ItemDefinition`), same as the rest
 * of this codebase's `(await res.json()) as T` pattern for other REST/SDK
 * boundaries (see `cosmos.ts`) — callers narrow the untyped resource to
 * their own document shape with a single, ordinary `as` cast at the read
 * site, not a portability cast across platform contracts.
 */

import type { ItemDefinition } from "@azure/cosmos";

export interface CosmosResource {
  id: string;
  _etag?: string;
  ttl?: number;
  [key: string]: unknown;
}

export interface CosmosAccessCondition {
  type: "IfMatch" | "IfNoneMatch";
  condition: string;
}

export interface CosmosItemResponse<T> {
  resource?: T;
  etag: string;
  statusCode: number;
}

export type CosmosQueryParameterValue = string | number | boolean | null | string[] | number[];

export interface CosmosQuerySpec {
  query: string;
  parameters?: { name: string; value: CosmosQueryParameterValue }[];
}

export interface CosmosBatchOperationResult {
  statusCode: number;
  resourceBody?: object;
  eTag?: string;
}

export interface CosmosBatchResponse {
  code?: number;
  result?: CosmosBatchOperationResult[];
}

export type CosmosBatchOperation =
  | { operationType: "Create"; resourceBody: ItemDefinition }
  | { operationType: "Upsert"; resourceBody: ItemDefinition }
  | { operationType: "Replace"; id: string; resourceBody: ItemDefinition; ifMatch?: string }
  | { operationType: "Delete"; id: string; ifMatch?: string }
  | { operationType: "Read"; id: string };

export interface CosmosItemLike {
  read(): Promise<CosmosItemResponse<ItemDefinition>>;
  replace(
    body: ItemDefinition,
    options?: { accessCondition?: CosmosAccessCondition },
  ): Promise<CosmosItemResponse<ItemDefinition>>;
  delete(options?: { accessCondition?: CosmosAccessCondition }): Promise<CosmosItemResponse<ItemDefinition>>;
}

export interface CosmosItemsLike {
  create(body: ItemDefinition): Promise<CosmosItemResponse<ItemDefinition>>;
  upsert(body: ItemDefinition): Promise<CosmosItemResponse<ItemDefinition>>;
  query<T>(
    querySpec: CosmosQuerySpec,
    options?: { partitionKey?: string },
  ): { fetchAll(): Promise<{ resources: T[] }> };
  batch(operations: CosmosBatchOperation[], partitionKey?: string): Promise<CosmosBatchResponse>;
}

export interface CosmosContainerLike {
  item(id: string, partitionKey?: string): CosmosItemLike;
  items: CosmosItemsLike;
}
