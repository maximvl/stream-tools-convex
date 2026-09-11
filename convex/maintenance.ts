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

const LOTO_TTL_MS = 24 * 60 * 60 * 1000

// Loto tickets are temporary: drop tickets older than 24h, then drop games
// older than 24h (with any remaining tickets) so a new game never sees them.
export const evictExpiredLotoTickets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - LOTO_TTL_MS
    const oldTickets = await ctx.db
      .query('loto_tickets')
      .withIndex('by_created', (q) => q.lt('created_at', cutoff))
      .collect()
    for (const row of oldTickets) await ctx.db.delete(row._id)
    const oldGames = await ctx.db
      .query('loto_games')
      .filter((q) => q.lt(q.field('created_at'), cutoff))
      .collect()
    let gameTickets = 0
    for (const game of oldGames) {
      const tickets = await ctx.db
        .query('loto_tickets')
        .withIndex('by_game', (q) => q.eq('game_id', game._id))
        .collect()
      for (const t of tickets) await ctx.db.delete(t._id)
      gameTickets += tickets.length
      await ctx.db.delete(game._id)
    }
    return { evictedTickets: oldTickets.length + gameTickets, evictedGames: oldGames.length }
  },
})
