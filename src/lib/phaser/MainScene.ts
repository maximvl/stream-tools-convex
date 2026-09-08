import Phaser from 'phaser'
import {
  computeGridLayout,
  hexCornersTop2_5D,
  hexSideWalls,
  cellPixel,
  type GridLayout,
  MIN_HEX_SIZE,
  MAX_HEX_SIZE,
  GRID_PADDING,
  PERSPECTIVE_Y_SCALE,
  EXTRUSION_FACTOR,
} from './hexGrid'
import type { ChatServer, ChatUser } from '$lib/types'
import { ServerIcons } from '$lib/constants'
import { KICK_MOD_DATA_URL } from '$lib/constants/kickModIcon'

const PROXY = 'https://ext.rte.net.ru:8443'
const proxied = (url: string) =>
  url.startsWith('data:') || url.startsWith(PROXY) ? url : `${PROXY}/${url}`

// Keep legacy export for Svelte props compatibility; hex game doesn't use lives/score anymore
export type GameStats = { score: number; lives: number; level: number }

export type HexPlayer = {
  id: string
  name: string
  color: string
  platform?: ChatServer
  chatUser?: ChatUser
}

const PLAYER_COLORS = [
  '#22d3ee',
  '#facc15',
  '#f87171',
  '#4ade80',
  '#a78bfa',
  '#fb923c',
  '#38bdf8',
  '#f472b6',
  '#34d399',
  '#fbbf24',
  '#60a5fa',
  '#e879f9',
]
const PLAYER_NAMES = [
  'Alex',
  'Mia',
  'John',
  'Sven',
  'Kim',
  'Zoe',
  'Leo',
  'Nina',
  'Max',
  'Luna',
  'Igor',
  'Anna',
  'Sam',
  'Eva',
  'Oleg',
  'Yara',
  'Finn',
  'Ada',
  'Kai',
  'Rex',
  'Nova',
  'Jett',
  'Milo',
  'Ivy',
  'Ash',
  'Rae',
  'Cole',
  'Jade',
  'Tara',
  'Blake',
]

const PLATFORM_CYCLE: ChatServer[] = ['twitch', 'kick', 'vkvideo', 'wtv']
const PLATFORM_HEX_BASE: Record<ChatServer, { r: number; g: number; b: number }> = {
  twitch: { r: 139, g: 92, b: 246 }, // purple #8b5cf6
  kick: { r: 34, g: 197, b: 94 }, // green #22c55e
  vkvideo: { r: 220, g: 38, b: 38 }, // red #dc2626
  wtv: { r: 248, g: 250, b: 252 }, // white #f8fafc — was grey #6b7280
}
const DEFAULT_HEX_BASE = { r: 30, g: 58, b: 34 } // muted battlefield green for no-platform

function platformTopColor(
  platform: ChatServer | undefined,
  depthShade: number,
): { fill: number; stroke: number } {
  const base = (platform && PLATFORM_HEX_BASE[platform]) ?? DEFAULT_HEX_BASE
  const r = Math.round(base.r * (0.55 + depthShade * 0.45))
  const g = Math.round(base.g * (0.55 + depthShade * 0.45))
  const b = Math.round(base.b * (0.55 + depthShade * 0.45))
  const fill = (r << 16) | (g << 8) | b
  // stroke slightly brighter
  const sr = Math.min(255, Math.round(r * 1.35))
  const sg = Math.min(255, Math.round(g * 1.35))
  const sb = Math.min(255, Math.round(b * 1.35))
  const stroke = (sr << 16) | (sg << 8) | sb
  return { fill, stroke }
}

function platformWallColor(
  platform: ChatServer | undefined,
  depthShade: number,
  side: boolean,
): number {
  const base = (platform && PLATFORM_HEX_BASE[platform]) ?? DEFAULT_HEX_BASE
  const factor = side ? 0.32 : 0.22
  const r = Math.round(base.r * factor * depthShade)
  const g = Math.round(base.g * factor * depthShade)
  const b = Math.round(base.b * factor * depthShade)
  // add small base to avoid pure black
  const rr = Math.min(255, r + 10)
  const gg = Math.min(255, g + 12)
  const bb = Math.min(255, b + 10)
  return (rr << 16) | (gg << 8) | bb
}

function getBadgeInfos(user: ChatUser): { url: string; title: string }[] {
  const out: { url: string; title: string }[] = []
  const twitchBadges = user.twitchFields?.badges || []
  for (const b of twitchBadges.slice(0, 1)) {
    if (b.imageUrl) out.push({ url: b.imageUrl, title: b.title })
  }
  const vkRoles = user.vkFields?.roles || []
  if (vkRoles.length > 0) {
    const highest = vkRoles.reduce((a, c) => (c.priority > a.priority ? c : a))
    if (highest.largeUrl) out.push({ url: highest.largeUrl, title: highest.name })
  }
  const vkBadges = user.vkFields?.badges || []
  for (const b of vkBadges.slice(0, 1)) {
    if (b.largeUrl) out.push({ url: b.largeUrl, title: b.name })
  }
  const kickBadges = user.kickFields?.badges || []
  for (const b of kickBadges) {
    if (b.type === 'moderator') {
      // use the actual Svelte component's SVG instead of external URL
      out.push({ url: KICK_MOD_DATA_URL, title: b.name })
    }
  }
  return out.slice(0, 2)
}

function getPrimaryBadge(user: ChatUser | undefined): { url: string; title: string } | null {
  if (!user) return null
  // priority: twitch badge - vk role - vk badge - kick role (moderator) - kick badge - default
  const twitchBadges = user.twitchFields?.badges || []
  if (twitchBadges.length > 0 && twitchBadges[0].imageUrl) {
    return { url: twitchBadges[0].imageUrl, title: twitchBadges[0].title }
  }
  const vkRoles = user.vkFields?.roles || []
  if (vkRoles.length > 0) {
    const highest = vkRoles.reduce((a, c) => (c.priority > a.priority ? c : a))
    if (highest.largeUrl) return { url: highest.largeUrl, title: highest.name }
  }
  const vkBadges = user.vkFields?.badges || []
  if (vkBadges.length > 0 && vkBadges[0].largeUrl) {
    return { url: vkBadges[0].largeUrl, title: vkBadges[0].name }
  }
  const kickFields = user.kickFields?.badges || []
  const kickMod = kickFields.find((b) => b.type === 'moderator')
  if (kickMod) {
    return { url: KICK_MOD_DATA_URL, title: kickMod.name }
  }
  // kick badge (any other kick badge with image)
  const kickBadge = kickFields.find((b) => b.imageUrl)
  if (kickBadge?.imageUrl) {
    return { url: kickBadge.imageUrl, title: kickBadge.name }
  }
  return null
}

function generatePlaceholders(count: number): HexPlayer[] {
  const shuffledNames = [...PLAYER_NAMES].sort(() => Math.random() - 0.5)
  const shuffledColors = [...PLAYER_COLORS].sort(() => Math.random() - 0.5)
  return Array.from({ length: count }, (_, i) => ({
    id: `p-${i}-${Math.random().toString(36).slice(2, 6)}`,
    name: shuffledNames[i % shuffledNames.length] + (i >= shuffledNames.length ? ` ${i + 1}` : ''),
    color: shuffledColors[i % shuffledColors.length],
    platform: PLATFORM_CYCLE[i % PLATFORM_CYCLE.length],
    // mock chatUser for demo badges (1 in 3 gets a random badge)
    chatUser: undefined,
  }))
}

export class MainScene extends Phaser.Scene {
  public onStatsUpdate?: (stats: GameStats) => void
  public onGameOver?: (score: number) => void

  private players: HexPlayer[] = []
  private layout: GridLayout | null = null
  private bgRect!: Phaser.GameObjects.Rectangle
  private bgGraphics!: Phaser.GameObjects.Graphics
  private gridGraphics!: Phaser.GameObjects.Graphics
  private tokenContainers: Phaser.GameObjects.Container[] = []
  private tokenByPlayerId = new Map<string, Phaser.GameObjects.Container>()
  private playerIndexById = new Map<string, number>()
  private aliveIds = new Set<string>()
  private eliminatedCellKeys = new Set<string>()
  private shieldedIds = new Set<string>()
  private lastHexSize: number | null = null
  private resizeHandler?: (gameSize: Phaser.Structs.Size) => void

  // 7-turn elimination
  private readonly TOTAL_TURNS = 7
  private currentTurn = 0
  private isFiring = false
  private isGameOver = false
  private gameStarted = false

  constructor() {
    super('MainScene')
  }

  preload() {
    // allow cross-origin for external badge/platform icons (loto logic)
    this.load.setCORS('anonymous')
    // platform icons for hex badges — same as loto ServerIcon, via proxy to avoid CORS
    for (const [server, url] of Object.entries(ServerIcons) as [ChatServer, string][]) {
      const key = `server-${server}`
      if (!this.textures.exists(key)) {
        this.load.image(key, proxied(url))
      }
    }
  }

  init(data: { onStatsUpdate?: (s: GameStats) => void; onGameOver?: (score: number) => void }) {
    if (data?.onStatsUpdate) this.onStatsUpdate = data.onStatsUpdate
    if (data?.onGameOver) this.onGameOver = data.onGameOver
  }

  public setCallbacks(callbacks: {
    onStatsUpdate?: (s: GameStats) => void
    onGameOver?: (score: number) => void
  }) {
    this.onStatsUpdate = callbacks.onStatsUpdate
    this.onGameOver = callbacks.onGameOver
  }

  create() {
    const { width, height } = this.scale

    this.cameras.main.setBackgroundColor('#0a0a1a')
    this.bgRect = this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a).setDepth(-20)
    this.bgGraphics = this.add.graphics().setDepth(-19)
    this.drawBattlefieldBackdrop(width, height)

    this.gridGraphics = this.add.graphics().setDepth(-5)

    // start empty — players will be added dynamically via chat (+игра) or debug helpers
    this.players = []
    this.resetBattleState()

    this.rebuild()

    // handle RESIZE
    this.resizeHandler = () => this.handleResize()
    this.scale.on('resize', this.resizeHandler)

    // cleanup on shutdown
    this.events.once('shutdown', () => {
      if (this.resizeHandler) this.scale.off('resize', this.resizeHandler)
    })

    // fire animation trigger via event
    this.events.on('fire', this.handleFire, this)
    this.events.once('shutdown', () => this.events.off('fire', this.handleFire, this))
  }

  private handleResize() {
    const { width, height } = this.scale
    this.cameras.main.setViewport(0, 0, width, height)
    if (this.bgRect) {
      this.bgRect.setPosition(width / 2, height / 2).setSize(width, height)
    }
    this.drawBattlefieldBackdrop(width, height)
    this.rebuild()
  }

  private drawBattlefieldBackdrop(width: number, height: number) {
    const g = this.bgGraphics
    if (!g) return
    g.clear()
    // horizon — same ratio reserved for grid so 2.5D stays visible
    const horizonY = height * this.HORIZON_RATIO
    // sky gradient (manual bands)
    const skyTop = 0x1a1a3a
    const skyMid = 0x24304a
    const skyBot = 0x2a3a56
    // top sky
    g.fillStyle(skyTop, 1)
    g.fillRect(0, 0, width, horizonY * 0.55)
    // mid sky with slight atmospheric haze
    g.fillStyle(skyMid, 1)
    g.fillRect(0, horizonY * 0.55, width, horizonY * 0.25)
    g.fillStyle(skyBot, 1)
    g.fillRect(0, horizonY * 0.8, width, horizonY * 0.2 + 24)

    // distant mountains — two pronounced ridgelines, more frequent & taller
    // far range (softer, darker)
    g.fillStyle(0x111e32, 1)
    g.beginPath()
    g.moveTo(0, horizonY + 6)
    {
      const peaks = 10
      for (let i = 0; i <= peaks; i++) {
        const px = (width / peaks) * i
        const isPeak = i % 2 === 0
        const h = isPeak ? Phaser.Math.Between(28, 52) : Phaser.Math.Between(14, 32)
        const jitter = Phaser.Math.Between(-6, 6)
        const py = horizonY + 6 - h + jitter * 0.15
        g.lineTo(px, py)
      }
    }
    g.lineTo(width, horizonY + 6)
    g.closePath()
    g.fillPath()

    // near range — more pronounced, higher contrast, jagged & frequent
    const nearPoints: { x: number; y: number }[] = []
    {
      const peaks = 12
      for (let i = 0; i <= peaks; i++) {
        const px = (width / peaks) * i
        const phase = i % 3
        const baseH =
          phase === 0
            ? Phaser.Math.Between(48, 78)
            : phase === 1
              ? Phaser.Math.Between(32, 56)
              : Phaser.Math.Between(22, 44)
        const py = horizonY + 6 - baseH
        nearPoints.push({ x: px, y: py })
        if (phase === 0 && i > 0 && i < peaks) {
          const midX = px + (width / peaks) * 0.35
          const midY = py + Phaser.Math.Between(10, 18)
          nearPoints.push({ x: midX, y: midY })
        }
      }
    }
    g.fillStyle(0x1a2f4a, 1)
    g.beginPath()
    g.moveTo(0, horizonY + 6)
    for (const p of nearPoints) g.lineTo(p.x, p.y)
    g.lineTo(width, horizonY + 6)
    g.closePath()
    g.fillPath()

    // ridge highlight — stroke same ridgeline for pronounced relief
    g.lineStyle(1.2, 0x3a5a7c, 0.9)
    g.beginPath()
    g.moveTo(nearPoints[0].x, nearPoints[0].y)
    for (let i = 1; i < nearPoints.length; i++) g.lineTo(nearPoints[i].x, nearPoints[i].y)
    g.strokePath()

    // subtle ambient occlusion under ridge
    g.fillStyle(0x0a1628, 0.35)
    g.fillRect(0, horizonY + 2, width, 10)

    // ground plane — trapezoid perspective (widest at bottom)
    const groundTopY = horizonY
    const groundBottomY = height
    // subtle ground base
    g.fillStyle(0x1a2620, 1)
    g.beginPath()
    g.moveTo(width * 0.08, groundTopY)
    g.lineTo(width * 0.92, groundTopY)
    g.lineTo(width, groundBottomY)
    g.lineTo(0, groundBottomY)
    g.closePath()
    g.fillPath()
    // ground gradient bands for depth (darker far, lighter near)
    g.fillStyle(0x223328, 0.9)
    g.fillRect(
      0,
      groundTopY + (groundBottomY - groundTopY) * 0.0,
      width,
      (groundBottomY - groundTopY) * 0.28,
    )
    g.fillStyle(0x2a3d2a, 0.55)
    g.fillRect(
      0,
      groundTopY + (groundBottomY - groundTopY) * 0.28,
      width,
      (groundBottomY - groundTopY) * 0.72,
    )
    // vignette / atmospheric fog near horizon
    g.fillStyle(0x0a0a1a, 0.18)
    g.fillRect(0, groundTopY - 14, width, 28)
  }

  // horizon reserve — reduced to give more ground space while keeping 2.5D effect
  private readonly HORIZON_RATIO = 0.24
  private readonly HORIZON_GAP = 14

  private getHorizonReservedTop(height: number): number {
    return Math.floor(height * this.HORIZON_RATIO) + this.HORIZON_GAP
  }

  private resetBattleState() {
    this.aliveIds = new Set(this.players.map((p) => p.id))
    this.playerIndexById.clear()
    this.players.forEach((p, i) => this.playerIndexById.set(p.id, i))
    this.eliminatedCellKeys.clear()
    this.shieldedIds.clear()
    this.currentTurn = 0
    this.isFiring = false
    this.isGameOver = false
    this.gameStarted = false
  }

  private computeEliminationCount(): number {
    const remaining = this.aliveIds.size
    if (remaining <= 1) return 0
    const remainingTurns = this.TOTAL_TURNS - this.currentTurn
    if (remainingTurns <= 1) return remaining - 1
    // progressive elimination: early turns remove more, later turns fewer
    // weighted share — weight of next turn = remainingTurns, total weight = 1+2+...+remainingTurns
    // e.g. 50 players → 13,11,9,7,5,3,1  (vs flat 7 each) — keeps ~5 before finale
    const totalWeight = (remainingTurns * (remainingTurns + 1)) / 2
    const weightNext = remainingTurns
    const toElim = Math.ceil(((remaining - 1) * weightNext) / totalWeight)
    return Math.max(1, Math.min(toElim, remaining - 1))
  }

  public getNextEliminationCount(): number {
    return this.computeEliminationCount()
  }

  public getShieldedCount(): number {
    return this.shieldedIds.size
  }

  public getDeadCount(): number {
    return this.players.length - this.aliveIds.size
  }

  /** Resurrect up to next elimination count of dead players */
  public resurrect(): number {
    if (this.isFiring || this.isGameOver) return 0
    const dead = this.players.filter((p) => !this.aliveIds.has(p.id))
    if (dead.length === 0) return 0
    const toRevive = Math.min(this.computeEliminationCount(), dead.length)
    if (toRevive <= 0) return 0
    Phaser.Utils.Array.Shuffle(dead)
    const revived = dead.slice(0, toRevive)
    for (const p of revived) {
      this.aliveIds.add(p.id)
      // remove crater for this player's cell
      const idx = this.playerIndexById.get(p.id)
      if (idx !== undefined && this.layout) {
        const cell = this.layout.cells[idx]
        if (cell) this.eliminatedCellKeys.delete(`${cell.q},${cell.r}`)
      }
      // resurrect removes shield if it had one before death (should not have)
      this.shieldedIds.delete(p.id)
    }
    // was game over with 1 alive? resurrect revives, clear gameOver
    if (this.isGameOver && this.aliveIds.size > 1) {
      this.isGameOver = false
      this.hideWinnerBanner()
    }
    this.drawHexes()
    this.drawPlayers()
    this.emitStats()
    this.events.emit('resurrect', { count: revived.length, revived: revived.map((p) => p.id) })
    this.events.emit('stats', { score: this.players.length, lives: 3, level: 1 })
    // green burst on revived hexes
    for (const p of revived) {
      const idx = this.playerIndexById.get(p.id)
      if (idx === undefined || !this.layout) continue
      const pos = cellPixel(this.layout, this.layout.cells[idx])
      const ring = this.add.circle(pos.x, pos.y, 8, 0x22c55e, 0.85).setDepth(pos.y + 30)
      this.tweens.add({
        targets: ring,
        scale: 4.5,
        alpha: 0,
        duration: 480,
        ease: 'Quad.Out',
        onComplete: () => ring.destroy(),
      })
      this.cameras.main.flash(120, 80, 255, 120)
    }
    return revived.length
  }

  /** Shield same amount of alive unshielded players — shield saves from 1 hit */
  public shield(): number {
    if (this.isFiring || this.isGameOver) return 0
    const unshieldedAlive = this.players.filter(
      (p) => this.aliveIds.has(p.id) && !this.shieldedIds.has(p.id),
    )
    if (unshieldedAlive.length === 0) return 0
    const toShield = Math.min(this.computeEliminationCount(), unshieldedAlive.length)
    if (toShield <= 0) return 0
    Phaser.Utils.Array.Shuffle(unshieldedAlive)
    const shielded = unshieldedAlive.slice(0, toShield)
    for (const p of shielded) this.shieldedIds.add(p.id)
    this.drawPlayers()
    this.emitStats()
    this.events.emit('shield', { count: shielded.length, shielded: shielded.map((p) => p.id) })
    this.events.emit('stats', { score: this.players.length, lives: 3, level: 1 })
    // blue pulse on shielded
    for (const p of shielded) {
      const idx = this.playerIndexById.get(p.id)
      if (idx === undefined || !this.layout) continue
      const pos = cellPixel(this.layout, this.layout.cells[idx])
      const ring = this.add.circle(pos.x, pos.y, 10, 0x60a5fa, 0.8).setDepth(pos.y + 30)
      this.tweens.add({
        targets: ring,
        scale: 3.8,
        alpha: 0,
        duration: 520,
        ease: 'Quad.Out',
        onComplete: () => ring.destroy(),
      })
    }
    return shielded.length
  }

  private rebuild() {
    const { width, height } = this.scale

    const reservedTop = this.getHorizonReservedTop(height)
    const availH = Math.max(80, height - reservedTop)
    // recompute layout fitting all players into ground area only
    const layout = computeGridLayout(width, availH, this.players.length, {
      minSize: MIN_HEX_SIZE,
      maxSize: MAX_HEX_SIZE,
      padding: GRID_PADDING,
    })
    // shift layout down so its 0 is ground-top, not screen-top
    layout.originY += reservedTop
    this.layout = layout

    this.drawHexes()
    this.drawPlayers()
    this.emitStats()
  }

  private drawHexes() {
    if (!this.layout) return
    const g = this.gridGraphics
    g.clear()

    // back-to-front for correct 2.5D overlap (far rows first)
    const sorted = [...this.layout.cells].sort((a, b) => a.r - b.r || a.q - b.q)
    const s = this.layout.hexSize

    for (const cell of sorted) {
      const { x, y } = cellPixel(this.layout, cell)
      const key = `${cell.q},${cell.r}`
      const isDead = this.eliminatedCellKeys.has(key)
      // find player occupying this hex (players[i] -> cells[i])
      const cellIdx = this.layout.cells.findIndex((c) => c.q === cell.q && c.r === cell.r)
      const occupant =
        cellIdx >= 0 && cellIdx < this.players.length ? this.players[cellIdx] : undefined
      const platform = occupant?.platform
      const top = hexCornersTop2_5D(x, y, s)
      const walls = hexSideWalls(x, y, s)
      const depthShade = Phaser.Math.Clamp(
        0.55 + (cell.r / Math.max(1, this.layout!.rows - 1)) * 0.45,
        0.55,
        1,
      )

      // side walls — platform tinted, darker, behind top face
      const southWalls = walls.slice(0, 2)
      for (const w of southWalls) {
        const q = w.quad
        const col = isDead
          ? Phaser.Display.Color.GetColor(10, 10, 12)
          : platformWallColor(platform, depthShade, false)
        g.fillStyle(col, 1)
        g.lineStyle(1, isDead ? 0x1a2a3a : platform ? 0x222222 : 0x1a2a3a, isDead ? 0.35 : 0.9)
        g.beginPath()
        g.moveTo(q[0].x, q[0].y)
        g.lineTo(q[1].x, q[1].y)
        g.lineTo(q[2].x, q[2].y)
        g.lineTo(q[3].x, q[3].y)
        g.closePath()
        g.fillPath()
        g.strokePath()
      }
      const sideWalls = walls.slice(2)
      for (const w of sideWalls) {
        const q = w.quad
        const col = isDead
          ? Phaser.Display.Color.GetColor(14, 14, 16)
          : platformWallColor(platform, depthShade, true)
        g.fillStyle(col, 1)
        g.lineStyle(1, isDead ? 0x223344 : 0x222222, isDead ? 0.25 : 0.5)
        g.beginPath()
        g.moveTo(q[0].x, q[0].y)
        g.lineTo(q[1].x, q[1].y)
        g.lineTo(q[2].x, q[2].y)
        g.lineTo(q[3].x, q[3].y)
        g.closePath()
        g.fillPath()
        g.strokePath()
      }

      // top face — platform color with distance shade; dead hexes: scorched/crater
      if (isDead) {
        g.fillStyle(0x1a0f0a, 1)
        g.lineStyle(1.2, 0x3d2416, 0.9)
        g.beginPath()
        g.moveTo(top[0].x, top[0].y)
        for (let i = 1; i < top.length; i++) g.lineTo(top[i].x, top[i].y)
        g.closePath()
        g.fillPath()
        g.strokePath()
        const cx = top.reduce((s, p) => s + p.x, 0) / top.length
        const cy = top.reduce((s, p) => s + p.y, 0) / top.length
        g.fillStyle(0x0d0a08, 1)
        g.fillCircle(cx, cy + s * 0.06, s * 0.38)
        g.fillStyle(0x2a1a0f, 0.85)
        g.fillCircle(cx + s * 0.12, cy - s * 0.08, s * 0.14)
        continue
      }
      const { fill: topColor, stroke: topStroke } = platformTopColor(platform, depthShade)
      g.fillStyle(topColor, 1)
      g.lineStyle(1.5, topStroke, 0.95)
      g.beginPath()
      g.moveTo(top[0].x, top[0].y)
      for (let i = 1; i < top.length; i++) g.lineTo(top[i].x, top[i].y)
      g.closePath()
      g.fillPath()
      g.strokePath()

      // inner highlight (north edge brighter as if sun from top) — keep subtle
      g.lineStyle(1, 0xffffff, 0.08)
      g.beginPath()
      g.moveTo(top[5].x, top[5].y)
      g.lineTo(top[0].x, top[0].y)
      g.lineTo(top[1].x, top[1].y)
      g.strokePath()
    }
  }

  private drawPlayers() {
    if (!this.layout) return

    const size = this.layout.hexSize

    // depth-sort tokens so closer rows overlap farther ones
    const sortedIdx = this.players
      .map((_, i) => i)
      .sort((a, b) => {
        const ca = this.layout!.cells[a]
        const cb = this.layout!.cells[b]
        return ca.r - cb.r || ca.q - cb.q
      })

    // keep previous containers for incremental update
    const prevById = new Map(this.tokenByPlayerId)
    const nextContainers: Phaser.GameObjects.Container[] = []
    const nextById = new Map<string, Phaser.GameObjects.Container>()
    const seenIds = new Set<string>()

    const createToken = (
      p: HexPlayer,
      x: number,
      y: number,
      isAlive: boolean,
      isShielded: boolean,
      withPopIn: boolean,
    ): Phaser.GameObjects.Container => {
      const depth = y + (this.playerIndexById.get(p.id) ?? 0) * 0.01
      const container = this.add.container(x, y).setDepth(depth)
      container.setData('isAlive', isAlive)
      container.setData('isShielded', isShielded)

      const radius = Phaser.Math.Clamp(size * 0.24, 7, 12)
      const lift = size * PERSPECTIVE_Y_SCALE * 0.35 + size * EXTRUSION_FACTOR * 0.5
      const iconY = -lift - Math.max(2, size * 0.08) - 2

      if (isAlive) {
        const shadowW = radius * 1.25
        const shadowH = radius * 0.5
        const shadow = this.add.ellipse(0, 3, shadowW * 2, shadowH * 2, 0x000000, 0.28)
        container.add(shadow)

        const circle = this.add.graphics()
        // solid dark background for badge icon — was random p.color, now fixed
        circle.fillStyle(0x1e293b, 1)
        circle.lineStyle(Math.max(1.2, radius * 0.14), 0x334155, 1)
        circle.fillCircle(0, iconY, radius)
        circle.strokeCircle(0, iconY, radius)
        container.add(circle)

        if (isShielded) {
          const shieldRing = this.add.graphics()
          shieldRing.setData('isShieldRing', true)
          shieldRing.lineStyle(Math.max(2, radius * 0.22), 0x60a5fa, 1)
          shieldRing.strokeCircle(0, iconY, radius + 3)
          // outer glow
          shieldRing.lineStyle(1, 0x93c5fd, 0.55)
          shieldRing.strokeCircle(0, iconY, radius + 5.5)
          container.add(shieldRing)
          const shieldIcon = this.add
            .text(radius + 6, iconY - radius - 4, '🛡️', {
              fontSize: `${Math.round(radius * 0.9)}px`,
            })
            .setOrigin(0.5)
          shieldIcon.setData('isShieldIcon', true)
          container.add(shieldIcon)
        }

        const hl = this.add.graphics()
        hl.fillStyle(0xffffff, 0.22)
        hl.fillCircle(-radius * 0.28, iconY - radius * 0.28, radius * 0.28)
        container.add(hl)

        // 1 icon for user model on hex: priority twitch badge - vk role - vk badge - kick role - kick badge - default initial
        const primaryBadge = p.chatUser ? getPrimaryBadge(p.chatUser) : null
        if (primaryBadge) {
          const badgeSize = radius * 1.55
          const safeKey = `primary-${primaryBadge.title.replace(/[^a-z0-9]/gi, '').slice(0, 12)}-${primaryBadge.url.slice(-12).replace(/[^a-zA-Z0-9]/g, '')}`
          const addBadgeIcon = () => {
            const img = this.add.image(0, iconY, safeKey).setDisplaySize(badgeSize, badgeSize)
            img.setOrigin(0.5)
            // slight inset so badge sits nicely inside circle border
            container.add(img)
          }
          if (this.textures.exists(safeKey)) {
            addBadgeIcon()
          } else {
            this.load.setCORS('anonymous')
            this.load.image(safeKey, proxied(primaryBadge.url))
            this.load.once(`filecomplete-image-${safeKey}`, addBadgeIcon)
            if (!this.load.isLoading()) this.load.start()
          }
        } else {
          const initial = p.name.charAt(0).toUpperCase()
          const fontSize = Math.round(radius * 0.9)
          const label = this.add
            .text(0, iconY + 1, initial, {
              fontSize: `${fontSize}px`,
              color: '#f1f5f9',
              fontFamily: 'system-ui, sans-serif',
              fontStyle: 'bold',
            })
            .setOrigin(0.5)
          container.add(label)
        }
      }

      const nameY = isAlive ? iconY + Phaser.Math.Clamp(size * 0.24, 7, 12) + 8 : 2
      const nameFontSize = Phaser.Math.Clamp(Math.round(size * 0.34), 10, 15)
      const bgPadX = 4
      const bgPadY = 1
      const nameColor = isAlive ? '#ffffff' : '#9aa0a6'
      const nameStroke = isAlive ? '#0a0a1a' : '#1a1f2a'
      const nameStrokeThick = isAlive ? 3.2 : 2.6
      const nameText = this.add
        .text(0, nameY, p.name, {
          fontSize: `${nameFontSize}px`,
          color: nameColor,
          fontFamily: 'system-ui, sans-serif',
          fontStyle: '800',
          stroke: nameStroke,
          strokeThickness: nameStrokeThick,
        } as Phaser.Types.GameObjects.Text.TextStyle)
        .setOrigin(0.5)
      nameText.setAlpha(isAlive ? 1 : 0.72)
      const textW = Math.min(nameText.width + bgPadX * 2, size * 1.75)
      const textH = nameText.height + bgPadY * 2
      const bg = this.add.graphics()
      bg.setData('isNameBg', true)
      bg.fillStyle(0x0a0a1a, isAlive ? 0.78 : 0.5)
      bg.lineStyle(isAlive ? 0 : 0.8, 0x4b5563, isAlive ? 0 : 0.45)
      bg.fillRoundedRect(-textW / 2, nameY - textH / 2, textW, textH, 3.5)
      if (!isAlive) bg.strokeRoundedRect(-textW / 2, nameY - textH / 2, textW, textH, 3.5)
      container.add(bg)
      container.add(nameText)
      if (!isAlive) {
        container.setAlpha(0.88)
        const strike = this.add.graphics()
        strike.setData('isStrike', true)
        strike.lineStyle(1.2, 0x6b7280, 0.55)
        strike.lineBetween(-textW / 2 + 2, nameY, textW / 2 - 2, nameY)
        container.add(strike)
      }

      if (withPopIn) {
        container.setScale(0)
        // keep intended alpha for dead/alive but start from 0 and tween to it
        const targetAlpha = container.alpha
        container.setAlpha(0)
        this.tweens.add({
          targets: container,
          scale: 1,
          alpha: targetAlpha,
          duration: 260,
          ease: 'Back.Out',
        })
      } else {
        // existing tokens: slide to new spot (layout changed or reshuffled)
        // alpha already correct
      }
      return container
    }

    const sizeChanged = this.lastHexSize !== null && Math.abs(this.lastHexSize - size) > 0.7

    sortedIdx.forEach((idx) => {
      const p = this.players[idx]
      const cell = this.layout!.cells[idx]
      if (!cell) return
      const isAlive = this.aliveIds.has(p.id)
      const isShielded = isAlive && this.shieldedIds.has(p.id)
      const { x, y } = cellPixel(this.layout!, cell)
      const existing = prevById.get(p.id)
      let container: Phaser.GameObjects.Container
      const needsRecreate =
        existing &&
        existing.active &&
        (existing.getData('isAlive') !== isAlive || existing.getData('isShielded') !== isShielded)
      if (existing && existing.active && !sizeChanged && !needsRecreate) {
        // reuse: glide to new hex (reshuffle/resize with same size) — no pop-in
        container = existing
        container.setDepth(y + idx * 0.01)
        const prevX = container.x
        const prevY = container.y
        if (Math.abs(prevX - x) > 0.5 || Math.abs(prevY - y) > 0.5) {
          this.tweens.add({
            targets: container,
            x,
            y,
            duration: 320,
            ease: 'Quad.Out',
          })
        } else {
          container.setPosition(x, y)
        }
        nextContainers.push(container)
        nextById.set(p.id, container)
        seenIds.add(p.id)
      } else if (existing && existing.active && (sizeChanged || needsRecreate)) {
        // hex size changed or alive/shield state changed — recreate visuals without pop-in so radius/font stay correct
        existing.destroy(true)
        container = createToken(p, x, y, isAlive, isShielded, false)
        nextContainers.push(container)
        nextById.set(p.id, container)
        seenIds.add(p.id)
      } else {
        // brand new player — pop-in only here
        if (existing && existing.active) existing.destroy(true)
        container = createToken(p, x, y, isAlive, isShielded, true)
        nextContainers.push(container)
        nextById.set(p.id, container)
        seenIds.add(p.id)
      }
    })

    // destroy containers for players that no longer exist (newGame)
    for (const [id, cont] of prevById.entries()) {
      if (!seenIds.has(id)) {
        cont.destroy(true)
      }
    }

    this.tokenContainers = nextContainers
    this.tokenByPlayerId = nextById
    this.lastHexSize = size
  }

  private emitStats() {
    // emit synthetic stats so parent Svelte doesn't break; encode player count
    const stats: GameStats = { score: this.players.length, lives: 3, level: 1 }
    this.onStatsUpdate?.(stats)
    this.events.emit('stats', stats)
  }

  // —— Public API for Svelte / future store ——

  public getPlayers(): HexPlayer[] {
    return [...this.players]
  }

  public setPlayers(players: HexPlayer[]) {
    this.players = [...players]
    this.resetBattleState()
    this.rebuild()
    this.hideWinnerBanner()
  }

  public addPlayers(players: HexPlayer[]) {
    // after first fire, joining is closed — game starts with roster at that moment
    if (this.gameStarted) return
    let added = false
    for (const p of players) {
      if (!this.playerIndexById.has(p.id)) {
        this.playerIndexById.set(p.id, this.players.length)
        this.players.push(p)
        this.aliveIds.add(p.id)
        added = true
      }
    }
    if (added) this.rebuild()
  }

  public isJoinLocked(): boolean {
    return this.gameStarted
  }

  /** New game: reset to empty field and allow new +игра joins */
  public newGame() {
    this.players = []
    this.resetBattleState()
    this.rebuild()
    this.hideWinnerBanner()
  }

  /** Reshuffle: keep same roster, just move players to random hexes */
  public reshuffle() {
    if (this.players.length === 0) return
    if (this.isFiring) return
    Phaser.Utils.Array.Shuffle(this.players)
    // rebuild index map after shuffle
    this.playerIndexById.clear()
    this.players.forEach((p, i) => this.playerIndexById.set(p.id, i))
    // keep craters aligned with dead players' new positions
    if (this.eliminatedCellKeys.size > 0 && this.layout) {
      const newDeadKeys = new Set<string>()
      this.players.forEach((p, idx) => {
        if (!this.aliveIds.has(p.id)) {
          const cell = this.layout!.cells[idx]
          if (cell) newDeadKeys.add(`${cell.q},${cell.r}`)
        }
      })
      // if layout will be recomputed, defer crater rebuild until after rebuild
      // For now clear and let drawHexes recompute from new mapping on next draw
      // Keep old keys for visual continuity until rebuild — rebuild will use updated mapping
      this.eliminatedCellKeys = newDeadKeys
    }
    this.rebuild()
  }

  /** Debug helper: generate random placeholders (not used for reshuffle anymore) */
  public generateDemo(count?: number) {
    const n = count ?? Phaser.Math.Between(50, 100)
    this.players = generatePlaceholders(n)
    this.resetBattleState()
    this.rebuild()
    this.hideWinnerBanner()
  }

  public restartGame() {
    this.newGame()
  }

  // winner banner graphics
  private winnerBanner?: Phaser.GameObjects.Container

  private showWinnerBanner(_winner: HexPlayer) {
    this.hideWinnerBanner()
    // winner banner is now rendered as Svelte DOM overlay (regular <img> without CORS) in +page.svelte
    // keep Phaser side minimal to avoid duplicate and CORS issues
  }

  private hideWinnerBanner() {
    if (this.winnerBanner) {
      this.winnerBanner.destroy(true)
      this.winnerBanner = undefined
    }
  }

  public getCurrentTurn(): number {
    return this.currentTurn
  }
  public getTotalTurns(): number {
    return this.TOTAL_TURNS
  }
  public isEliminating(): boolean {
    return this.isFiring
  }
  public getAliveCount(): number {
    return this.aliveIds.size
  }
  public getGameStarted(): boolean {
    return this.gameStarted
  }

  /** Called by floating Fire button — 7-turn elimination with fire from sky */
  public fire() {
    if (this.isFiring) return
    if (this.aliveIds.size <= 1) {
      this.isGameOver = true
      // ensure joins locked
      if (!this.gameStarted) {
        this.gameStarted = true
        this.events.emit('gamestarted', { count: this.aliveIds.size })
      }
      if (this.aliveIds.size === 1) {
        const winnerId = [...this.aliveIds][0]
        const winner = this.players.find((p) => p.id === winnerId) ?? this.players[0] ?? null
        if (winner) this.showWinnerBanner(winner)
        this.events.emit('gameover', { winner: winner ?? undefined, turn: this.currentTurn })
        this.onGameOver?.(this.aliveIds.size)
      } else if (this.aliveIds.size === 0) {
        // no players — game over without winner
        this.events.emit('gameover', { winner: undefined, turn: this.currentTurn })
        this.onGameOver?.(0)
      }
      this.events.emit('fireEnd', { turn: this.currentTurn })
      this.events.emit('firingEnd')
      return
    }
    if (this.isGameOver) return
    // first fire locks roster — no more +игра joins for this battle
    if (!this.gameStarted) {
      this.gameStarted = true
      this.events.emit('gamestarted', { count: this.aliveIds.size })
    }
    const toElim = this.computeEliminationCount()
    if (toElim <= 0) return
    // pick random alive players to eliminate
    const alive = this.players.filter((p) => this.aliveIds.has(p.id))
    Phaser.Utils.Array.Shuffle(alive)
    const victims = alive.slice(0, toElim)
    this.isFiring = true
    this.currentTurn += 1
    this.events.emit('turn', {
      turn: this.currentTurn,
      total: this.TOTAL_TURNS,
      eliminated: victims.length,
      alive: this.aliveIds.size - victims.length,
    })
    this.animateFireElimination(victims)
    this.events.emit('fire')
  }

  private animateFireElimination(victims: HexPlayer[]) {
    if (!this.layout || victims.length === 0) {
      this.isFiring = false
      this.events.emit('fireEnd', { turn: this.currentTurn })
      this.events.emit('firingEnd')
      return
    }
    // safety fallback: ensure firing resets even if a tween is lost
    const failsafe = this.time.delayedCall(4500, () => {
      if (this.isFiring) {
        this.isFiring = false
        this.events.emit('fireEnd', { turn: this.currentTurn })
        this.events.emit('firingEnd')
      }
    })
    const { height } = this.scale
    let pending = victims.length

    const onVictimImpact = (victim: HexPlayer) => {
      const idx = this.playerIndexById.get(victim.id)
      if (idx === undefined) return
      const cell = this.layout!.cells[idx]
      const pos = cellPixel(this.layout!, cell)
      // shield saves from 1 hit — consume shield, no elimination
      if (this.shieldedIds.has(victim.id)) {
        this.shieldedIds.delete(victim.id)
        const container = this.tokenByPlayerId.get(victim.id)
        // shield break VFX — blue burst + flash
        this.cameras.main.shake(90, 0.004)
        this.cameras.main.flash(90, 100, 160, 255)
        const sRing = this.add.circle(pos.x, pos.y - 6, 12, 0x60a5fa, 0.85).setDepth(pos.y + 30)
        this.tweens.add({
          targets: sRing,
          scale: 3.2,
          alpha: 0,
          duration: 380,
          ease: 'Quad.Out',
          onComplete: () => sRing.destroy(),
        })
        const sRing2 = this.add.circle(pos.x, pos.y - 6, 8, 0x93c5fd, 0.9).setDepth(pos.y + 31)
        this.tweens.add({
          targets: sRing2,
          scale: 4.0,
          alpha: 0,
          duration: 320,
          ease: 'Quad.Out',
          onComplete: () => sRing2.destroy(),
        })
        for (let i = 0; i < 6; i++) {
          const p = this.add.circle(pos.x, pos.y - 10, 2.5, 0xbfdbfe, 1).setDepth(pos.y + 32)
          const ang = (i / 6) * Math.PI * 2
          const dist = Phaser.Math.Between(14, 26)
          this.tweens.add({
            targets: p,
            x: pos.x + Math.cos(ang) * dist,
            y: pos.y + Math.sin(ang) * dist * 0.5 - 10,
            alpha: 0,
            duration: 360 + Math.random() * 120,
            ease: 'Quad.Out',
            onComplete: () => p.destroy(),
          })
        }
        // remove shield visuals from token
        if (container) {
          // destroy shield ring / icon
          for (const obj of [...container.list]) {
            if (obj.getData && (obj.getData('isShieldRing') || obj.getData('isShieldIcon'))) {
              obj.destroy()
            }
          }
          container.setData('isShielded', false)
          // bump animation — survived
          this.tweens.add({
            targets: container,
            scale: 1.1,
            duration: 100,
            yoyo: true,
            ease: 'Quad.Out',
          })
        }
        this.events.emit('shieldBreak', { playerId: victim.id })
        this.emitStats()
        pending -= 1
        if (pending === 0) {
          failsafe.remove(false)
          this.time.delayedCall(520, () => {
            this.isFiring = false
            this.events.emit('fireEnd', { turn: this.currentTurn })
            this.events.emit('firingEnd')
            this.emitStats()
            if (this.aliveIds.size <= 1) {
              this.isGameOver = true
              const winnerId = [...this.aliveIds][0]
              const winner = this.players.find((p) => p.id === winnerId)
              if (winner) this.showWinnerBanner(winner)
              this.events.emit('gameover', { winner, turn: this.currentTurn })
              this.onGameOver?.(this.aliveIds.size)
            }
          })
        }
        return
      }

      const key = `${cell.q},${cell.r}`
      this.eliminatedCellKeys.add(key)
      const container = this.tokenByPlayerId.get(victim.id)
      // explosion at hex center
      this.cameras.main.shake(180, 0.008)
      // ring shockwave
      const ring = this.add.circle(pos.x, pos.y, 8, 0xff4500, 0.9).setDepth(pos.y + 30)
      this.tweens.add({
        targets: ring,
        scale: 4.5,
        alpha: 0,
        duration: 420,
        ease: 'Quad.Out',
        onComplete: () => ring.destroy(),
      })
      const ring2 = this.add.circle(pos.x, pos.y, 6, 0xffa500, 0.7).setDepth(pos.y + 31)
      this.tweens.add({
        targets: ring2,
        scale: 3.2,
        alpha: 0,
        duration: 360,
        ease: 'Quad.Out',
        onComplete: () => ring2.destroy(),
      })
      // particles burst
      for (let i = 0; i < 10; i++) {
        const p = this.add
          .circle(
            pos.x,
            pos.y - 6,
            Phaser.Math.Between(2, 4),
            Phaser.Display.Color.GetColor(255, Phaser.Math.Between(90, 200), 0),
            1,
          )
          .setDepth(pos.y + 32)
        const ang = (i / 10) * Math.PI * 2 + Math.random() * 0.4
        const dist = Phaser.Math.Between(16, 42)
        this.tweens.add({
          targets: p,
          x: pos.x + Math.cos(ang) * dist,
          y: pos.y + Math.sin(ang) * dist * 0.6 - 8,
          alpha: 0,
          scale: 0.15,
          duration: 380 + Math.random() * 160,
          ease: 'Quad.Out',
          onComplete: () => p.destroy(),
        })
      }
      // falling debris / smoke puffs
      for (let i = 0; i < 3; i++) {
        const puff = this.add
          .circle(pos.x + Phaser.Math.Between(-8, 8), pos.y - 10, 6, 0x333333, 0.38)
          .setDepth(pos.y + 33)
        this.tweens.add({
          targets: puff,
          y: puff.y - Phaser.Math.Between(12, 22),
          alpha: 0,
          scale: 2.2,
          duration: 520 + i * 100,
          onComplete: () => puff.destroy(),
        })
      }
      // eliminated: keep name grayed, remove icon entirely
      if (container) {
        this.tweens.add({
          targets: container,
          scale: 1.08,
          duration: 90,
          yoyo: true,
          ease: 'Quad.Out',
          onComplete: () => {
            // hide icon parts (shadow/circle/highlight/badge/initial + their washes/cross)
            for (const obj of [...container.list]) {
              if (
                obj instanceof Phaser.GameObjects.Ellipse ||
                obj instanceof Phaser.GameObjects.Image ||
                (obj instanceof Phaser.GameObjects.Graphics && !obj.getData('isNameBg'))
              ) {
                // keep name bg graphics (marked) but hide icon graphics
                // name bg has isNameBg=true, so skip it
                obj.setVisible(false)
                obj.destroy()
              } else if (obj instanceof Phaser.GameObjects.Text) {
                const txt = obj as Phaser.GameObjects.Text
                if (
                  txt.text.length === 1 &&
                  txt.text.toUpperCase() === victim.name.charAt(0).toUpperCase()
                ) {
                  // initial letter — remove
                  txt.setVisible(false)
                  txt.destroy()
                } else if (txt.text === victim.name) {
                  // keep name but gray it and recenter to hex center
                  txt.setPosition(0, 2)
                  txt.setColor('#9aa0a6')
                  txt.setStroke('#1a1f2a', 2.6)
                  txt.setAlpha(0.82)
                  // ensure bg is centered too — find bg graphics
                  for (const maybeBg of container.list) {
                    if (
                      maybeBg instanceof Phaser.GameObjects.Graphics &&
                      maybeBg.getData('isNameBg')
                    ) {
                      const bgW = txt.width + 8
                      const bgH = txt.height + 2
                      maybeBg.clear()
                      maybeBg.fillStyle(0x0a0a1a, 0.5)
                      maybeBg.lineStyle(0.8, 0x4b5563, 0.45)
                      maybeBg.fillRoundedRect(-bgW / 2, 2 - bgH / 2, bgW, bgH, 3.5)
                      maybeBg.strokeRoundedRect(-bgW / 2, 2 - bgH / 2, bgW, bgH, 3.5)
                      // strikethrough centered
                      if (!container.getData('hasStrike')) {
                        const strike = this.add.graphics()
                        strike.lineStyle(1.2, 0x6b7280, 0.55)
                        strike.lineBetween(-bgW / 2 + 2, 2, bgW / 2 - 2, 2)
                        container.add(strike)
                        container.setData('hasStrike', true)
                      }
                      break
                    }
                  }
                }
              }
            }
            container.setAlpha(0.92)
          },
        })
        this.tweens.add({
          targets: container,
          angle: Phaser.Math.Between(-6, 6),
          duration: 160,
          yoyo: true,
          ease: 'Sine.InOut',
        })
      }
      this.aliveIds.delete(victim.id)
      // keep tokenByPlayerId for grayed display (don't delete) — but ensure future rebuild still works
      // redraw that hex as crater after short delay
      this.time.delayedCall(160, () => this.drawHexes())

      pending -= 1
      if (pending === 0) {
        failsafe.remove(false)
        this.time.delayedCall(520, () => {
          this.isFiring = false
          this.events.emit('fireEnd', { turn: this.currentTurn })
          this.events.emit('firingEnd')
          this.emitStats()
          if (this.aliveIds.size <= 1) {
            this.isGameOver = true
            const winnerId = [...this.aliveIds][0]
            const winner = this.players.find((p) => p.id === winnerId)
            if (winner) this.showWinnerBanner(winner)
            this.events.emit('gameover', { winner, turn: this.currentTurn })
            this.onGameOver?.(this.aliveIds.size)
          }
        })
      }
    }

    victims.forEach((victim, i) => {
      const idx = this.playerIndexById.get(victim.id)
      if (idx === undefined) {
        pending -= 1
        return
      }
      const cell = this.layout!.cells[idx]
      const target = cellPixel(this.layout!, cell)
      const startX = target.x + Phaser.Math.Between(-10, 10)
      const startY = -60 - Math.random() * 80
      // fireball: head + trail
      const fireContainer = this.add.container(startX, startY).setDepth(80 + i)
      const head = this.add.graphics()
      head.fillStyle(0xff6a00, 1)
      head.fillCircle(0, 0, 9)
      head.fillStyle(0xffd23f, 1)
      head.fillCircle(0, -2, 5)
      head.fillStyle(0xffffff, 1)
      head.fillCircle(0, -3, 2.2)
      fireContainer.add(head)
      // trail streak
      const trail = this.add.graphics()
      trail.fillStyle(0xff4500, 0.55)
      trail.fillRect(-2, 4, 4, 18)
      trail.fillStyle(0xff8c00, 0.45)
      trail.fillRect(-1, 10, 2, 14)
      fireContainer.add(trail)
      // glow
      const glow = this.add.circle(0, 0, 14, 0xff6a00, 0.18)
      fireContainer.add(glow)

      const delay = i * 140
      const duration = 520 + Math.random() * 140
      this.tweens.add({
        targets: fireContainer,
        x: target.x,
        y: target.y - 6,
        duration,
        delay,
        ease: 'Quad.In',
        onComplete: () => {
          // impact flash
          this.cameras.main.flash(70, 255, 140, 40)
          fireContainer.destroy(true)
          onVictimImpact(victim)
        },
      })
      // slight wobble / rotation for realism
      this.tweens.add({
        targets: fireContainer,
        angle: Phaser.Math.Between(-12, 12),
        duration: duration * 0.9,
        delay,
        ease: 'Sine.InOut',
      })
    })
  }

  private handleFire() {
    // legacy shim still used by external callers via events — delegate to fire()
    // no direct animation here; fire() already handles
  }

  /** Legacy nudge kept as no-op for old callers */
  public nudge(_dir: 'left' | 'right') {
    // no-op: hex board has no paddle
    this.fire()
  }
}
