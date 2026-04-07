import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { TextSegment } from '../types'
import { usePossibleMatch } from '../hooks/usePossibleMatch'
import AuthorsListing from './AuthorsListing'

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
  const { t } = useTranslation()
  const { suggestions, loading, error } = usePossibleMatch(
    segment,
    volumeId,
    disabled
  )

  if (!segment || disabled) {
    return null
  }

  if (!volumeId?.trim()) {
    return (
      <p className="mt-2 text-xs text-amber-800/90">
        {t('outliner.listBdrcMatches.setVolumeHint')}
      </p>
    )
  }
  return (
    <div className="mt-2">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          {t('outliner.listBdrcMatches.matching')}
        </div>
      )}
      {error && !loading && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && suggestions.length === 0 && (
        <p className="text-xs text-gray-500">{t('outliner.listBdrcMatches.noSuggestions')}</p>
      )}
      {!loading && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2  flex-col">
          <span className="text-xs text-gray-500">{t('outliner.listBdrcMatches.suggestionsLabel')}</span>
          {suggestions.map((s) => {
            const label = (s.name?.trim() || s.id).slice(0, 80)
            const titleTip = [s.name, s.id].filter(Boolean).join(' — ')
            return (
              <button
                key={s.id}
                type="button"
                title={titleTip}
                onClick={() => onSelectWorkId(s.id)}
                className="flex flex-col w-min max-w-full min-w-0 gap-2 rounded-xl border border-emerald-200/90 cursor-pointer  px-2.5 py-1 text-xs font-monlam text-emerald-950 shadow-sm transition hover:bg-emerald-100 hover:border-emerald-300"
              >
                <span className="truncate">{label}</span>
                <AuthorsListing authors={s.authors ?? []} />
               </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
