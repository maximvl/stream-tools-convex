import { internalMutation } from './_generated/server'

// Replaces the hourly Timer in Program.fs:11-16 + Cache.fs:33-36
export const evictExpiredAuthKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('auth_keys')
      .filter((q) => q.lt(q.field('expires_at'), Date.now()))
      .collect()
    for (const row of expired) await ctx.db.delete(row._id)
    return { evicted: expired.length }
  },
})
