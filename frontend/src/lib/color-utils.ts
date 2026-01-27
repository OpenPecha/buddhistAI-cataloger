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
 * Converts HSL to hex color
 * @param hsl - HSL string in format "H S% L%" (e.g., "220 70% 45%")
 * @returns Hex color string (e.g., "#1b5cc5")
 */
export function hslToHex(hsl: string): string {
  const [h, s, l] = hsl.split(' ').map((val, idx) => {
    if (idx === 0) return parseInt(val) / 360
    return parseFloat(val.replace('%', '')) / 100
  })

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (h * 6 < 1) {
    r = c
    g = x
    b = 0
  } else if (h * 6 < 2) {
    r = x
    g = c
    b = 0
  } else if (h * 6 < 3) {
    r = 0
    g = c
    b = x
  } else if (h * 6 < 4) {
    r = 0
    g = x
    b = c
  } else if (h * 6 < 5) {
    r = x
    g = 0
    b = c
  } else {
    r = c
    g = 0
    b = x
  }

  r = Math.round((r + m) * 255)
  g = Math.round((g + m) * 255)
  b = Math.round((b + m) * 255)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Generates hex color shades from a base color
 * @param baseHex - Base hex color
 * @returns Object with hex color shades
 */
export function generateHexColorShades(baseHex: string) {
  const hslShades = generateColorShades(baseHex)
  return {
    50: hslToHex(hslShades[50]),
    100: hslToHex(hslShades[100]),
    200: hslToHex(hslShades[200]),
    300: hslToHex(hslShades[300]),
    400: hslToHex(hslShades[400]),
    500: hslToHex(hslShades[500]),
    600: hslToHex(hslShades[600]),
    700: hslToHex(hslShades[700]),
    800: hslToHex(hslShades[800]),
    900: hslToHex(hslShades[900]),
    950: hslToHex(hslShades[950]),
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
