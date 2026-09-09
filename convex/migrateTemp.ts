// TEMP-MIGRATION: public entrypoint for the one-time user_auth/auth_keys
// backfill, so it can be triggered via `convex run` or the dashboard Run
// button without hand-editing data. It just delegates to the internal
// migration. DELETE this file together with the schema loosening in
// convex/schema.ts once prod data is converted and the final deploy passes.
import { mutation, type MutationCtx } from './_generated/server'
import { internal } from './_generated/api'

type AuthBackfillResult = {
  migratedUsers: number
  deletedUsers: number
  skippedUsers: number
  migratedKeys: number
  deletedKeys: number
  skippedKeys: number
}

export const runAuthBackfill = mutation({
  args: {},
  handler: async (ctx: MutationCtx): Promise<AuthBackfillResult> => {
    return await ctx.runMutation(internal.migration.migrateAuthToUserSlugPlatform, {})
  },
})
