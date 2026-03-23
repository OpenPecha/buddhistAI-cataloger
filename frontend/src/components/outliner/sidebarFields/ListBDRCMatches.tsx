import { useEffect, useState } from 'react'
import { Loader2, User } from 'lucide-react'
import { findMatchingBdrcWork, type BdrcMatchingSuggestion } from '@/api/bdrc'
import type { TextSegment } from '../types'

interface ListBDRCMatchesProps {
  segment: TextSegment | undefined
  /** BDRC volume id — same as document filename when ingested from a volume */
  volumeId: string | undefined
  onSelectWorkId: (workId: string) => void
  disabled?: boolean
}

/**
 * OTAPI matching suggestions shown under the BDRC match input; each chip sets title.bdrc_id on click.
 */
export function ListBDRCMatches({
  segment,
  volumeId,
  onSelectWorkId,
  disabled = false,
}: Readonly<ListBDRCMatchesProps>) {
  const [suggestions, setSuggestions] = useState<BdrcMatchingSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!segment || disabled) {
      setSuggestions([])
      setError(null)
      setLoading(false)
      return
    }

    const vid = volumeId?.trim()
    if (!vid) {
      setSuggestions([])
      setError(null)
      setLoading(false)
      return
    }

    const text = segment.text ?? ''
    const cstart = segment.span_start ?? 0
    const cend = segment.span_end ?? text.length

    const ac = new AbortController()
    setLoading(true)
    setError(null)

    findMatchingBdrcWork({
      text_bo: text,
      volume_id: vid,
      cstart,
      cend,
    })
      .then((rows) => {
        if (!ac.signal.aborted) {
          setSuggestions(rows)
        }
      })
      .catch((err: unknown) => {
        if (!ac.signal.aborted) {
          setSuggestions([])
          setError(err instanceof Error ? err.message : 'Failed to load suggestions')
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) {
          setLoading(false)
        }
      })

    return () => ac.abort()
  }, [segment, volumeId, disabled])

  if (!segment || disabled) {
    return null
  }

  if (!volumeId?.trim()) {
    return (
      <p className="mt-2 text-xs text-amber-800/90">
        Set the document filename to the BDRC volume id (e.g. V1CZ39) to see suggestions.
      </p>
    )
  }
  return (
    <div className="mt-2">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          Matching…
        </div>
      )}
      {error && !loading && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && suggestions.length === 0 && (
        <p className="text-xs text-gray-500">No suggestions for this segment.</p>
      )}
      {!loading && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2  flex-col">
          <span className="text-xs text-gray-500">suggestions:</span>
          {suggestions.map((s) => {
            const label = (s.name?.trim() || s.id).slice(0, 80)
            const titleTip = [s.name, s.id].filter(Boolean).join(' — ')
            const authors = s?.authors?.map((a) => a.pref_label_bo).join(', ')
            return (
              <button
                key={s.id}
                type="button"
                title={titleTip}
                onClick={() => onSelectWorkId(s.id)}
                className="flex flex-col w-min max-w-full min-w-0 gap-2 rounded-xl border border-emerald-200/90 cursor-pointer  px-2.5 py-1 text-xs font-monlam text-emerald-950 shadow-sm transition hover:bg-emerald-100 hover:border-emerald-300"
              >
                <span className="truncate">{label}</span>
                <span className="flex items-center gap-1 text-xs text-gray-500"><User className="w-3.5 h-3.5" />{authors}</span>
               
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
