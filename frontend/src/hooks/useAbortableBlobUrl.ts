import { useEffect, useRef, useState } from 'react'

export type UseAbortableBlobUrlOptions = {
  /**
   * When false, in-flight fetches are aborted and new ones are not started.
   * An object URL that was already created for the current `src` is kept until
   * `src` changes or the component unmounts.
   */
  fetchEnabled?: boolean
  /** Extra headers for `fetch` (e.g. `Authorization: Bearer` on the outliner image proxy). */
  getFetchHeaders?: () => Promise<HeadersInit | undefined>
}

/**
 * Fetches a URL into a blob object URL and revokes it when `src` changes or on unmount.
 * AbortController cancels the network request when the consuming component unmounts
 * (e.g. react-window row scrolled away) or when `fetchEnabled` becomes false.
 */
export function useAbortableBlobUrl(
  src: string | null,
  options?: UseAbortableBlobUrlOptions
): string | null {
  const fetchEnabled = options?.fetchEnabled !== false
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const prevSrcRef = useRef<string | null>(null)
  /** `src` for which `objectUrl` was last created successfully — avoids refetch when `fetchEnabled` flips (e.g. scroll pause). */
  const blobSrcRef = useRef<string | null>(null)
  const getFetchHeadersRef = useRef(options?.getFetchHeaders)
  getFetchHeadersRef.current = options?.getFetchHeaders

  useEffect(() => {
    if (!src) {
      prevSrcRef.current = null
      blobSrcRef.current = null
      setObjectUrl((u) => {
        if (u) URL.revokeObjectURL(u)
        return null
      })
      return
    }

    const prev = prevSrcRef.current
    if (prev != null && prev !== src) {
      blobSrcRef.current = null
      setObjectUrl((u) => {
        if (u) URL.revokeObjectURL(u)
        return null
      })
    }
    prevSrcRef.current = src
  }, [src])

  useEffect(() => {
    if (!src || !fetchEnabled) return
    if (blobSrcRef.current === src) return

    const ac = new AbortController()
    let cancelled = false
    const getExtra = getFetchHeadersRef.current
    const requestSrc = src

    ;(async () => {
      try {
        const extra = getExtra ? await getExtra() : undefined
        const headers = extra ? new Headers(extra) : undefined
        const res = await fetch(requestSrc, { signal: ac.signal, headers })
        if (cancelled || !res.ok) return
        const blob = await res.blob()
        if (cancelled || ac.signal.aborted) return
        const u = URL.createObjectURL(blob)
        if (cancelled) {
          URL.revokeObjectURL(u)
          return
        }
        if (requestSrc !== prevSrcRef.current) {
          URL.revokeObjectURL(u)
          return
        }
        blobSrcRef.current = requestSrc
        setObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return u
        })
      } catch {
        /* aborted or failed */
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [src, fetchEnabled])

  useEffect(() => {
    return () => {
      blobSrcRef.current = null
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [])

  return objectUrl
}
