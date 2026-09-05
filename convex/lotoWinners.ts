import { query, mutation, type MutationCtx } from './_generated/server'
import { v } from 'convex/values'
import { superGameStatus } from './schema'

async function requireAuth(
  ctx: MutationCtx,
  streamChannel: string,
  sessionId: string,
): Promise<void> {
  const saved = await ctx.db
    .query('user_auth')
    .withIndex('by_channel_lower', (q) => q.eq('channel_lower', streamChannel.toLowerCase()))
    .unique()
  if (!saved || saved.session_id !== sessionId) throw new Error('Not authenticated for this stream channel')
}

// GET /api/loto_winners (public)
export const list = query({
  args: { stream_channel: v.string() },
  handler: async (ctx, args) => {
    const winners = await ctx.db
      .query('loto_winners')
      .withIndex('by_channel', (q) => q.eq('stream_channel', args.stream_channel))
      .collect()
    return {
      winners: winners
        .sort((a, b) => a.created_at - b.created_at)
        .map((w) => ({
          id: w._id,
          username: w.username,
          super_game_status: w.super_game_status,
          created_at: w.created_at,
          stream_channel: w.stream_channel,
        })),
    }
  },
})

// POST /api/loto_winners (auth, batch)
export const createBatch = mutation({
  args: {
    stream_channel: v.string(),
    session_id: v.string(),
    winners: v.array(v.object({ username: v.string(), super_game_status: superGameStatus })),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.stream_channel, args.session_id)
    const createdAt = Math.floor(Date.now() / 1000)
    const winners = []
    for (const w of args.winners) {
      const id = await ctx.db.insert('loto_winners', {
        username: w.username,
        super_game_status: w.super_game_status,
        created_at: createdAt,
        stream_channel: args.stream_channel,
        channel_lower: args.stream_channel.toLowerCase(),
      })
      winners.push({
        id,
        username: w.username,
        super_game_status: w.super_game_status,
        created_at: createdAt,
        stream_channel: args.stream_channel,
      })
    }
    return { winners }
  },
})

// POST /api/loto_winners/:id (auth against winner's own channel)
export const updateStatus = mutation({
  args: {
    id: v.id('loto_winners'),
    session_id: v.string(),
    super_game_status: superGameStatus,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error('Winner not found')
    await requireAuth(ctx, existing.stream_channel, args.session_id)
    await ctx.db.patch(args.id, { super_game_status: args.super_game_status })
    const updated = await ctx.db.get(args.id)
    if (!updated) throw new Error('Winner not found')
    return {
      id: updated._id,
      username: updated.username,
      super_game_status: updated.super_game_status,
      created_at: updated.created_at,
      stream_channel: updated.stream_channel,
    }
  },
})
