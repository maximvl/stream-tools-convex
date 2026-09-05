export function isBrightColor(hex: string): boolean {
  const c = hex.replace('#', '')
  const rgb = parseInt(
    c.length === 3
      ? c
          .split('')
          .map((x) => x + x)
          .join('')
      : c,
    16,
  )
  const r = (rgb >> 16) & 0xff
  const g = (rgb >> 8) & 0xff
  const b = (rgb >> 0) & 0xff

  // YIQ perceived brightness (faster than WCAG, slightly less accurate)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128
}


export function isBrightColorOld(hexColor: string): boolean {
  const [r, g, b] = hexToRgb(hexColor)

  // Convert RGB to the 0-1 range
  let rNorm = r / 255
  let gNorm = g / 255
  let bNorm = b / 255

  // Apply gamma correction
  rNorm = rNorm <= 0.03928 ? rNorm / 12.92 : Math.pow((rNorm + 0.055) / 1.055, 2.4)
  gNorm = gNorm <= 0.03928 ? gNorm / 12.92 : Math.pow((gNorm + 0.055) / 1.055, 2.4)
  bNorm = bNorm <= 0.03928 ? bNorm / 12.92 : Math.pow((bNorm + 0.055) / 1.055, 2.4)

  // Calculate luminance
  const luminance = 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm

  return luminance > 0.2
}

// @ts-expect-error window is global
window.isBright = isBrightColorOld

function hexToRgb(hex: string): [number, number, number] {
  // Remove the '#' if present
  hex = hex.replace(/^#/, '')

  // Parse the string and convert to decimal values
  const bigint = parseInt(hex, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255

  return [r, g, b]
}