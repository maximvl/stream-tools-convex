import { internalMutation } from './_generated/server'
import { LOTO_TTL_MS } from './lotoLib'

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

// Loto tickets are temporary: drop tickets older than the TTL. Game rows
// are kept forever — the frontend auto-rotates to a fresh game once the
// active one goes stale and empty, so a new game never sees old tickets.
export const evictExpiredLotoTickets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - LOTO_TTL_MS
    const oldTickets = await ctx.db
      .query('loto_tickets')
      .withIndex('by_created', (q) => q.lt('created_at', cutoff))
      .collect()
    for (const row of oldTickets) await ctx.db.delete(row._id)
    return { evictedTickets: oldTickets.length }
  },
})
