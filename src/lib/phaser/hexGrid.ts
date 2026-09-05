// Pointy-top hex grid utilities
// size = distance from center to corner (radius)

export type Axial = { q: number; r: number }

export const SQRT3 = Math.sqrt(3)

// 2.5D side-view tuning — compress Y to simulate camera tilt ~30° above horizon
export const PERSPECTIVE_Y_SCALE = 0.48
// extrusion height in world units (relative to size) — visible side-wall thickness
export const EXTRUSION_FACTOR = 0.28

export function axialToPixel(q: number, r: number, size: number): { x: number; y: number } {
  // pointy-top
  const x = size * SQRT3 * (q + r / 2)
  const y = size * 1.5 * r
  return { x, y }
}

export function hexCorners(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = []
  for (let i = 0; i < 6; i++) {
    // pointy-top: start angle -30deg
    const angleDeg = 60 * i - 30
    const angleRad = (Math.PI / 180) * angleDeg
    corners.push({
      x: cx + size * Math.cos(angleRad),
      y: cy + size * Math.sin(angleRad),
    })
  }
  return corners
}

/** Top face corners squished for 2.5D side view */
export function hexCornersTop2_5D(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const base = hexCorners(cx, cy, size)
  return base.map((p) => ({ x: p.x, y: cy + (p.y - cy) * PERSPECTIVE_Y_SCALE }))
}

/** Bottom edge quads for extruded side walls (south-facing). Returns two quads: edge 1-2 and 2-3 */
export function hexSideWalls(cx: number, cy: number, size: number): { quad: { x: number; y: number }[] }[] {
  const top = hexCornersTop2_5D(cx, cy, size)
  const thickness = size * EXTRUSION_FACTOR
  // corners order 0..5: 0 (-30°), 1(30°), 2(90°), 3(150°), 4(210°), 5(270°/ -90°)
  // South-facing edges are 1->2 and 2->3 (visible from camera at south)
  const walls: { quad: { x: number; y: number }[] }[] = []
  const edges: [number, number][] = [
    [1, 2],
    [2, 3],
  ]
  for (const [a, b] of edges) {
    const ta = top[a]
    const tb = top[b]
    const quad = [
      { x: ta.x, y: ta.y },
      { x: tb.x, y: tb.y },
      { x: tb.x, y: tb.y + thickness },
      { x: ta.x, y: ta.y + thickness },
    ]
    walls.push({ quad })
  }
  // subtle side shading for left/right vertical edges for more volume
  const sideEdges: [number, number][] = [
    [0, 1],
    [3, 4],
  ]
  for (const [a, b] of sideEdges) {
    const ta = top[a]
    const tb = top[b]
    // thinner extrusion for sides
    const sideThickness = thickness * 0.65
    const quad = [
      { x: ta.x, y: ta.y },
      { x: tb.x, y: tb.y },
      { x: tb.x, y: tb.y + sideThickness },
      { x: ta.x, y: ta.y + sideThickness },
    ]
    walls.push({ quad })
  }
  return walls
}

/** Grid layout info after fitting */
export type GridLayout = {
  cols: number
  rows: number
  hexSize: number
  originX: number
  originY: number
  cells: Axial[]
  totalWidth: number
  totalHeight: number
}

export const MIN_HEX_SIZE = 14
export const MAX_HEX_SIZE = 64
export const GRID_PADDING = 16

/** Compute size that fits cols*rows into w x h — accounts for 2.5D vertical compression */
function sizeForGrid(cols: number, rows: number, availW: number, availH: number): number {
  // pointy-top offset: width = (cols + 0.5) * sqrt3 * size
  // visual height = (rows*1.5+0.5)*size*PERSPECTIVE_Y_SCALE + extrusion for front row
  const sx = availW / ((cols + 0.5) * SQRT3)
  const visualRowsHeight = (rows * 1.5 + 0.5) * PERSPECTIVE_Y_SCALE + EXTRUSION_FACTOR
  const sy = availH / visualRowsHeight
  return Math.min(sx, sy)
}

/**
 * Find best grid (cols, rows) to hold `count` cells inside viewport,
 * then compute hexSize that fits all, clamped to [minSize, maxSize].
 * Brute force over rows.
 */
export function computeGridLayout(
  availW: number,
  availH: number,
  count: number,
  opts?: { minSize?: number; maxSize?: number; padding?: number }
): GridLayout {
  const minSize = opts?.minSize ?? MIN_HEX_SIZE
  const maxSize = opts?.maxSize ?? MAX_HEX_SIZE
  const padding = opts?.padding ?? GRID_PADDING

  const w = Math.max(1, availW - padding * 2)
  const h = Math.max(1, availH - padding * 2)

  if (count <= 0) {
    // no players -> empty battlefield (just ground/sky)
    return {
      cols: 0,
      rows: 0,
      hexSize: MIN_HEX_SIZE,
      originX: availW / 2,
      originY: availH / 2,
      cells: [],
      totalWidth: 0,
      totalHeight: 0,
    }
  }

  let best: { cols: number; rows: number; size: number } | null = null

  // search rows 1..count, but limit to reasonable range for performance
  const maxRowsToTry = Math.min(count, 50)
  for (let rows = 1; rows <= maxRowsToTry; rows++) {
    const cols = Math.ceil(count / rows)
    if (cols * rows < count) continue
    // avoid extreme aspect ratios where cols>>rows beyond viewport ratio
    const s = sizeForGrid(cols, rows, w, h)
    const clamped = Math.max(minSize, Math.min(maxSize, s))
    // need to check if at clamped min size it actually fits? if s < minSize, we overflow but still clamp
    // Prefer layouts with larger effective size; tie break on squareness to viewport
    if (!best || clamped > best.size + 0.01) {
      best = { cols, rows, size: clamped }
    } else if (Math.abs(clamped - best.size) < 0.01) {
      // tie-break: choose aspect closer to viewport
      const curAspect = (cols * SQRT3) / (rows * 1.5)
      const bestAspect = (best.cols * SQRT3) / (best.rows * 1.5)
      const viewAspect = w / h
      if (Math.abs(curAspect - viewAspect) < Math.abs(bestAspect - viewAspect)) {
        best = { cols, rows, size: clamped }
      }
    }
  }

  // fallback
  if (!best) {
    const cols = Math.ceil(Math.sqrt(count))
    const rows = Math.ceil(count / cols)
    const s = sizeForGrid(cols, rows, w, h)
    best = { cols, rows, size: Math.max(minSize, Math.min(maxSize, s)) }
  }

  const { cols, rows, size } = best
  // visual sizes (after 2.5D compression) for centering
  const totalWidth = (cols + 0.5) * SQRT3 * size
  const logicalHeight = (rows * 1.5 + 0.5) * size
  const visualHeight = logicalHeight * PERSPECTIVE_Y_SCALE + size * EXTRUSION_FACTOR
  const totalHeight = visualHeight
  const originX = (availW - totalWidth) / 2 + (SQRT3 * size) / 2
  // center visual bbox: top = originY - size*PERSPECTIVE_Y_SCALE (top corner), bottom = originY + (rows-1)*1.5*size*PERSPECTIVE_Y_SCALE + size*PERSPECTIVE_Y_SCALE + extrusion
  const originY = (availH - visualHeight) / 2 + size * PERSPECTIVE_Y_SCALE

  const cells: Axial[] = []
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      if (cells.length >= count) break
      // offset handled via origin + axialToPixel with cube shift?
      // For odd-r offset rendering, we store q,r as grid indices but need to account for stagger in pixel conversion:
      // We'll use axial-like but with row offset folded into axialToPixel
      cells.push({ q, r })
    }
  }

  return { cols, rows, hexSize: size, originX, originY, cells, totalWidth, totalHeight }
}

/** Pixel for cell index given layout — pointy-top odd-r offset, Y compressed for side view */
export function cellPixel(layout: GridLayout, cell: Axial): { x: number; y: number } {
  const { hexSize: size, originX, originY } = layout
  // odd-r: every odd row shifted by half hex width (sqrt3*size/2)
  const offsetX = (cell.r % 2) * (SQRT3 * size * 0.5)
  return {
    x: originX + cell.q * SQRT3 * size + offsetX,
    y: originY + cell.r * 1.5 * size * PERSPECTIVE_Y_SCALE,
  }
}

/** Legacy axial helper kept for reference; not used for offset layout */
export function offsetToPixel(col: number, row: number, size: number, originX: number, originY: number) {
  return {
    x: originX + col * SQRT3 * size + (row % 2) * (SQRT3 * size * 0.5),
    y: originY + row * 1.5 * size,
  }
}
