/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as cards from "../cards.js";
import type * as crons from "../crons.js";
import type * as devices from "../devices.js";
import type * as firmware from "../firmware.js";
import type * as http from "../http.js";
import type * as lib_cbor from "../lib/cbor.js";
import type * as lib_etag from "../lib/etag.js";
import type * as lib_seed from "../lib/seed.js";
import type * as programs from "../programs.js";
import type * as programsActions from "../programsActions.js";
import type * as rules from "../rules.js";
import type * as scenes from "../scenes.js";
import type * as sources from "../sources.js";
import type * as telemetry from "../telemetry.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  cards: typeof cards;
  crons: typeof crons;
  devices: typeof devices;
  firmware: typeof firmware;
  http: typeof http;
  "lib/cbor": typeof lib_cbor;
  "lib/etag": typeof lib_etag;
  "lib/seed": typeof lib_seed;
  programs: typeof programs;
  programsActions: typeof programsActions;
  rules: typeof rules;
  scenes: typeof scenes;
  sources: typeof sources;
  telemetry: typeof telemetry;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
