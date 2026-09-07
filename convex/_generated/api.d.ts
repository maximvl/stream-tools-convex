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
import type * as authLib from "../authLib.js";
import type * as crons from "../crons.js";
import type * as frontendLogs from "../frontendLogs.js";
import type * as lotoWinners from "../lotoWinners.js";
import type * as maintenance from "../maintenance.js";
import type * as migration from "../migration.js";
import type * as userIdentity from "../userIdentity.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authLib: typeof authLib;
  crons: typeof crons;
  frontendLogs: typeof frontendLogs;
  lotoWinners: typeof lotoWinners;
  maintenance: typeof maintenance;
  migration: typeof migration;
  userIdentity: typeof userIdentity;
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
