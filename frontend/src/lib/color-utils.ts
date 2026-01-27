/**
 * Converts a hex color to HSL format
 * @param hex - Hex color string (e.g., "#1b5cc5" or "1b5cc5")
 * @returns HSL string in format "H S% L%" (e.g., "220 70% 45%")
 */
export function hexToHsl(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '')
  
  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  // Convert to degrees and percentages
  h = Math.round(h * 360)
  s = Math.round(s * 100)
  const lightness = Math.round(l * 100)

  return `${h} ${s}% ${lightness}%`
}

/**
 * Generates color shades from a base color
 * @param baseHex - Base hex color
 * @returns Object with color shades
 */
export function generateColorShades(baseHex: string) {
  const hsl = hexToHsl(baseHex)
  const [h, s, l] = hsl.split(' ').map((val, idx) => {
    if (idx === 0) return parseInt(val)
    return parseFloat(val.replace('%', ''))
  })

  return {
    50: `${h} ${Math.max(0, s - 50)}% ${Math.min(95, l + 40)}%`,
    100: `${h} ${Math.max(0, s - 40)}% ${Math.min(90, l + 30)}%`,
    200: `${h} ${Math.max(0, s - 30)}% ${Math.min(85, l + 20)}%`,
    300: `${h} ${Math.max(0, s - 20)}% ${Math.min(80, l + 10)}%`,
    400: `${h} ${Math.max(0, s - 10)}% ${Math.min(75, l + 5)}%`,
    500: `${h} ${s}% ${l}%`,
    600: `${h} ${Math.min(100, s + 10)}% ${Math.max(20, l - 5)}%`,
    700: `${h} ${Math.min(100, s + 20)}% ${Math.max(15, l - 10)}%`,
    800: `${h} ${Math.min(100, s + 30)}% ${Math.max(10, l - 20)}%`,
    900: `${h} ${Math.min(100, s + 40)}% ${Math.max(5, l - 30)}%`,
    950: `${h} ${Math.min(100, s + 50)}% ${Math.max(0, l - 40)}%`,
  }
}

/**
 * Gets the appropriate foreground color for a given background color
 * @param hex - Hex color string
 * @returns HSL string for foreground color (light or dark based on background lightness)
 */
export function getForegroundColor(hex: string): string {
  const hsl = hexToHsl(hex)
  const lightness = parseFloat(hsl.split(' ')[2].replace('%', ''))
  
  // If background is dark (lightness < 50%), use light foreground
  // Otherwise, use dark foreground
  if (lightness < 50) {
    return '0 0% 98%' // Light foreground for dark backgrounds
  } else {
    return '0 0% 9%' // Dark foreground for light backgrounds
  }
}
