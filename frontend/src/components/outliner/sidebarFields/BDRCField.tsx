import { useState, useRef, useEffect, Activity } from 'react'
import { CreateBdrcWorkModal } from '@/components/bdrc/CreateBdrcWorkModal'
import { Loader2, PersonStandingIcon, Plus } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useBdrcSearch, useBdrcWork, type BdrcSearchResult } from '@/hooks/useBdrcSearch'
import type { TextSegment } from '../types'
import type { Author, FormDataType, Title } from '../AnnotationSidebar'

interface BDRCFieldProps {
  formData: FormDataType
  segment: TextSegment
  onUpdate: (field: 'title' | 'author', value: Title | Author) => void
  resetForm?: () => void
  disabled?: boolean
}

function BDRCField({ formData, segment, onUpdate, disabled = false }: Readonly<BDRCFieldProps>) {
  const bdrcId = formData?.title?.bdrc_id || segment.title_bdrc_id || ''
  const titleSearch = formData?.title?.name || ''
  const [isBdrcFocused, setIsBdrcFocused] = useState(false)
  const [createWorkModalOpen, setCreateWorkModalOpen] = useState(false)
  const [selectedWorkInfo, setSelectedWorkInfo] = useState<{ title: string; author: string } | null>(null)
  const bdrcInputRef = useRef<HTMLInputElement>(null)

  const { work: fetchedWork, isLoading: workLoading } = useBdrcWork(bdrcId || null)
  const { results: titleResults, isLoading: titleLoading } = useBdrcSearch(
    titleSearch,
    'Work',
    1000,
    () => bdrcInputRef.current?.focus(),
    isBdrcFocused
  )

  const handleSelect = (item: BdrcSearchResult) => {
    const author = item.contributors?.[0]?.agentName ?? 'unknown author'
    onUpdate('title', { name: titleSearch || item.title || '', bdrc_id: item.workId || '' })
    setSelectedWorkInfo({ title: item.title ?? '', author })
    setIsBdrcFocused(false)
  }

  const handleCreateWorkSuccess = (work: { workId: string; title?: string }) => {
    handleSelect({ workId: work.workId, title: work.title } as BdrcSearchResult)
    setCreateWorkModalOpen(false)
  }

  const handleBdrcIdChange = (value: string) => {
    onUpdate('title', { name: titleSearch, bdrc_id: value })
    if (!value) setSelectedWorkInfo(null)
  }

  useEffect(() => {
    setSelectedWorkInfo(null)
  }, [segment?.id])

  const displayInfo =
    selectedWorkInfo ??
    (fetchedWork ? { title: fetchedWork.title, author: fetchedWork.author } : null)

  return (
    <div>
      <div className="relative mt-2">
        <Label htmlFor="title-bdrc-id" className="mb-1 text-xs text-gray-500">
        BDRC match
        </Label>

        <div className="relative">
          <Input
            ref={bdrcInputRef}
            id="title-bdrc-id"
            value={bdrcId}
            onChange={(e) => handleBdrcIdChange(e.target.value)}
            onFocus={() => !disabled && setIsBdrcFocused(true)}
            onBlur={() => setIsBdrcFocused(false)}
            placeholder="Focus to search BDRC..."
            className="w-full pr-8 text-sm"
            disabled={disabled}
          />
          {titleLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>

        <Activity mode={!disabled && isBdrcFocused ? 'visible' : 'hidden'}>
          <div className="absolute z-900 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {isBdrcFocused && (
              <span className={`text-xs pl-2 ${titleResults.length === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                found: {titleResults.length}
              </span>
            )}
            {titleResults.map((title, index) => (
              <button
                key={title.workId || index}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(title)
                }}
                className="w-full px-4 py-2 font-monlam text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900">{title.title}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <PersonStandingIcon className="w-4 h-4" />
                  {(title as BdrcSearchResult).contributors?.[0]?.agentName ?? 'unknown author'} &nbsp;
                  {title.workId && <span>ID: {title.workId}</span>}
                </div>
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                setIsBdrcFocused(false)
                setCreateWorkModalOpen(true)
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 border-t border-gray-200 flex items-center gap-2 text-sm text-primary font-medium"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Create work
            </button>
          </div>
        </Activity>
      </div>

      {bdrcId && (
        <div className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
          {workLoading && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span className="text-sm">Loading work…</span>
            </div>
          )}
          {!workLoading && displayInfo && (
            <>
              <div className="font-medium text-gray-900">{displayInfo.title || '—'}</div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <PersonStandingIcon className="w-3.5 h-3.5 shrink-0" />
                {displayInfo.author || '—'}
              </div>
            </>
          )}
          {!workLoading && !displayInfo && (
            <div className="text-sm text-gray-500">No work info</div>
          )}
        </div>
      )}

      <CreateBdrcWorkModal
        open={createWorkModalOpen}
        onOpenChange={setCreateWorkModalOpen}
        onSuccess={handleCreateWorkSuccess}
        initialPrefLabel={titleSearch}
      />
    </div>
  )
}

export default BDRCField
