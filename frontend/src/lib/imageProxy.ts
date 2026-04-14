import { API_URL } from '@/config/api'

function isBdrcIiifHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'iiif.bdrc.io' || h.endsWith('.iiif.bdrc.io')
}

/**
 * Same-origin URL that loads the image through the cataloger backend for BDRC IIIF only.
 * Other HTTPS URLs are returned unchanged (e.g. profile avatars load directly).
 */
export function proxiedImageUrl(
  originalUrl: string | null | undefined
): string | null {
  if (originalUrl == null) return null
  const u = originalUrl.trim()
  if (!u) return null
  if (u.startsWith('data:') || u.startsWith('blob:')) return u
  if (u.startsWith('/')) return u

  let href: string
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'https:') return u
    if (!isBdrcIiifHost(parsed.hostname)) return u
    href = parsed.href
  } catch {
    return u
  }

  return `${API_URL}/outliner/proxy/image?url=${encodeURIComponent(href)}`
}
