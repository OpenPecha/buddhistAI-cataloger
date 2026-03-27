import React,{ useState, useRef, useEffect, Activity, useCallback } from 'react'
import { CreateBdrcWorkModal } from '@/components/bdrc/CreateBdrcWorkModal'
import {
  BDRC_AUTHOR_DIFFICULT_TO_IDENTIFY,
  BdrcAuthorSelector,
} from '@/components/bdrc/BdrcAuthorSelector'
import { Loader2, PersonStandingIcon, Plus, Pencil, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import {
  useBdrcSearch,
  useBdrcWork,
  type BdrcSearchResult,
  type BdrcWorkInfo,
} from '@/hooks/useBdrcSearch'
import type { TextSegment } from '../types'
import type { Author, FormDataType, Title } from '../AnnotationSidebar'
import { ListBDRCMatches } from './ListBDRCMatches'
import { updateBdrcWork } from '@/api/bdrc'
import { toast } from 'sonner'
import { useAuth0 } from '@auth0/auth0-react'
import BDRCSeachWrapper from '../BDRCSeachWrapper'
import { DuplicateModal } from './DuplicateComponent'
import AuthorsListing from './AuthorsListing'

function bdrcWorkHasAuthor(work: BdrcWorkInfo | null): boolean {
  if (!work?.authors?.length) return false
  return work.authors.some(
    (a) =>
      (a.id != null && String(a.id).trim() !== '') ||
      (a.name != null &&
        a.name.trim() !== '' &&
        a.name.trim().toLowerCase() !== 'unknown author')
  )
}

type AuthorEditRow = { key: number; value: string; searchHint?: string; displayName?: string }

function buildAuthorEditRows(
  nextKey: () => number,
  fetchedWork: BdrcWorkInfo | null,
  segmentAuthorText: string
): AuthorEditRow[] {
  const rows: AuthorEditRow[] = []
  if (fetchedWork?.authors?.length) {
    for (const a of fetchedWork.authors) {
      const id = a.id?.trim() ?? ''
      const nm = a.name?.trim() ?? ''
      rows.push({
        key: nextKey(),
        value: id,
        searchHint: !id && nm ? nm : undefined,
        displayName: id && nm ? nm : undefined,
      })
    }
  }
  if (rows.length === 0) {
    rows.push({
      key: nextKey(),
      value: '',
      searchHint: segmentAuthorText || undefined,
    })
  }
  return rows
}

interface BDRCFieldProps {
  formData: FormDataType
  segment: TextSegment
  onUpdate: (field: 'title' | 'author', value: Title | Author) => void
  resetForm?: () => void
  disabled?: boolean
  /** BDRC volume id (document filename) for OTAPI match suggestions */
  volumeId?: string | null
  /** Annotator author name — used to require BDRC work author when both are relevant */
  annotatorAuthorName?: string
  /** When true, segment Save should be disabled (annotator author set but BDRC work has no author) */
  onBdrcAuthorBlockingChange?: (blocked: boolean, message: string | null) => void
}

function BDRCField({
  formData,
  segment,
  onUpdate,
  disabled = false,
  volumeId,
  annotatorAuthorName = '',
  onBdrcAuthorBlockingChange,
}: Readonly<BDRCFieldProps>) {
  const { user } = useAuth0()
  const bdrcId = formData?.title?.bdrc_id || segment.title_bdrc_id || ''
  const titleFromProp = formData?.title?.name || ''
  const [searchQuery, setSearchQuery] = useState(titleFromProp)
  const [isBdrcFocused, setIsBdrcFocused] = useState(false)
  const [createWorkModalOpen, setCreateWorkModalOpen] = useState(false)
  const [workDetailModalOpen, setWorkDetailModalOpen] = useState(false)
  const bdrcInputRef = useRef<HTMLInputElement>(null)
  const authorRowKeyRef = useRef(0)
  const nextAuthorRowKey = () => {
    authorRowKeyRef.current += 1
    return authorRowKeyRef.current
  }

  const [editingBdrc, setEditingBdrc] = useState(false)
  const [editPrefLabel, setEditPrefLabel] = useState('')
  const [editAuthorRows, setEditAuthorRows] = useState<AuthorEditRow[]>([])
  const [savingBdrc, setSavingBdrc] = useState(false)

  const { work: fetchedWork, isLoading: workLoading, isFetching: workFetching, error: workError, refetch } =
    useBdrcWork(bdrcId || null)
  const { results: titleResults, isLoading: titleLoading } = useBdrcSearch(
    searchQuery,
    'Work',
    1000,
    () => bdrcInputRef.current?.focus(),
    isBdrcFocused && !bdrcId
  )

  const handleSelect = (item: BdrcSearchResult) => {
    onUpdate('title', { name: item.title || searchQuery || '', bdrc_id: item.workId || '' })
    setIsBdrcFocused(false)
  }

  const handleCreateWorkSuccess = (work: { workId: string; title?: string }) => {
    handleSelect({ workId: work.workId, title: work.title } as BdrcSearchResult)
    setCreateWorkModalOpen(false)
  }

  const handleClearSelection = () => {
    onUpdate('title', { name: '', bdrc_id: '' })
    setSearchQuery('')
    setEditingBdrc(false)
  }

  useEffect(() => {
    setEditingBdrc(false)
    setSearchQuery(formData?.title?.name || '')
  }, [segment?.id])

  const reportBlocking = useCallback(
    (blocked: boolean, message: string | null) => {
      onBdrcAuthorBlockingChange?.(blocked, message)
    },
    [onBdrcAuthorBlockingChange]
  )

  useEffect(() => {
    if (!onBdrcAuthorBlockingChange) return
    const annotatorFilled = annotatorAuthorName.trim().length > 0
    const hasBdrc = Boolean(bdrcId.trim())
    if (!hasBdrc || !annotatorFilled) {
      reportBlocking(false, null)
      return
    }
    if (workLoading) {
      reportBlocking(false, null)
      return
    }
    if (!fetchedWork) {
      reportBlocking(false, null)
      return
    }
    if (bdrcWorkHasAuthor(fetchedWork)) {
      reportBlocking(false, null)
    } else {
      reportBlocking(
        true,
        '⚠️This segment has an author, but the matched BDRC work has no author. Edit the BDRC work and add author(s), then save.'
      )
    }
  }, [annotatorAuthorName, bdrcId, workLoading, fetchedWork, onBdrcAuthorBlockingChange, reportBlocking])

  const displayInfo =
    (fetchedWork
      ? { 
          workId: fetchedWork.workId,
          title: fetchedWork.title,
          authors: fetchedWork.authors,
        }
      : null)
  const openEdit = () => {
    const segmentAuthorText = (formData.author.name || segment.author || '').trim()
    setEditPrefLabel(fetchedWork ? fetchedWork.title : searchQuery)
    setEditAuthorRows(buildAuthorEditRows(nextAuthorRowKey, fetchedWork ?? null, segmentAuthorText))
    setEditingBdrc(true)
  }

  const handleSaveBdrc = async () => {
    if (!bdrcId.trim()) return
    setSavingBdrc(true)
    try {
      const authors = editAuthorRows.map((r) => r.value.trim()).filter(Boolean)
      const modifiedBy = user?.email ?? user?.sub ?? undefined
      await updateBdrcWork(bdrcId, {
        pref_label_bo: editPrefLabel.trim() || undefined,
        authors: authors.length ? authors : undefined,
        ...(modifiedBy ? { modified_by: modifiedBy } : {}),
      })
      toast.success('BDRC work updated')
      await refetch()
      setEditingBdrc(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update BDRC work')
    } finally {
      setSavingBdrc(false)
    }
  }

  

  return (
    <div>
      {!bdrcId && (
        <div className="relative mt-2">
          <div className="relative">
            <Input
              ref={bdrcInputRef}
              id="title-bdrc-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => !disabled && setIsBdrcFocused(true)}
              onBlur={() => setIsBdrcFocused(false)}
              placeholder="Type title to search BDRC..."
              className="w-full pr-8 text-sm font-monlam"
              disabled={disabled}
            />
            {titleLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          <Activity mode={!disabled && isBdrcFocused ? 'visible' : 'hidden'}>
            <div className="flex-col absolute z-900 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
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
                    {title.authors?.[0]?.name ?? 'unknown author'} &nbsp;
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
      )}
 
      {bdrcId && (
        <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          {workLoading && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span className="text-sm">Loading work…</span>
            </div>
          )}
          {workError && !workLoading && (
            <p className="text-xs text-red-600">{workError}</p>
          )}
          {!workLoading && displayInfo && !editingBdrc && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <BDRCSeachWrapper bdrcId={displayInfo.workId}>
                <div className="font-medium text-gray-900">{displayInfo.title || '—'}</div>
                </BDRCSeachWrapper>
                <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <PersonStandingIcon className="w-3.5 h-3.5 shrink-0" />
                  <AuthorsListing authors={displayInfo.authors} />
                  
                  
                </div>
              </div>
              {!disabled && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={openEdit}
                    title="Edit BDRC work"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={handleClearSelection}
                    title="Clear BDRC selection"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
           
            </div>
          )}
          {!workLoading && !displayInfo && !editingBdrc && (
            <div className="text-sm text-gray-500">No work info</div>
          )}
          {!disabled && editingBdrc && (
            <div className="space-y-2 pt-1">
              <div>
                <Label className="text-xs text-gray-500">Title </Label>
                <Input
                  value={editPrefLabel}
                  onChange={(e) => setEditPrefLabel(e.target.value)}
                  className="mt-1 font-monlam text-sm"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-500">Authors</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => {
                      if (
                        confirm(
                          'Add another author? Multiple commentators are only allowed for commentaries.'
                        )
                      ) {
                        setEditAuthorRows((prev) => [
                          ...prev,
                          { key: nextAuthorRowKey(), value: '', displayName: undefined },
                        ])
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  {editAuthorRows.map((row, i) => (
                    <div key={row.key} className="flex gap-2 items-start">
                      <div className="flex-1 min-w-0">
                        <BdrcAuthorSelector
                          id={`bdrc-edit-author-${row.key}`}
                          value={row.value}
                          selectedName={row.displayName}
                          onChange={(bdrcId, name) => {
                            setEditAuthorRows((prev) =>
                              prev.map((it, idx) => {
                                if (idx !== i) return it
                                const next: AuthorEditRow = {
                                  ...it,
                                  value: bdrcId,
                                  searchHint: undefined,
                                }
                                if (bdrcId === BDRC_AUTHOR_DIFFICULT_TO_IDENTIFY) {
                                  next.displayName = undefined
                                } else if (name?.trim()) {
                                  next.displayName = name.trim()
                                } else if (!bdrcId) {
                                  next.displayName = undefined
                                }
                                return next
                              })
                            )
                          }}
                          searchQuery={
                            !row.value && row.searchHint
                              ? row.searchHint
                              : undefined
                          }
                          placeholder="Search or create author…"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setEditAuthorRows((prev) => {
                            const next = prev.filter((_, idx) => idx !== i)
                            if (next.length === 0) {
                              return [{ key: nextAuthorRowKey(), value: '', displayName: undefined }]
                            }
                            return next
                          })
                        }
                        aria-label="Remove author"
                        className="shrink-0 h-9 w-9 mt-0.5"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" size="xs" onClick={handleSaveBdrc} disabled={savingBdrc}>
                  {savingBdrc ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save to BDRC
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditingBdrc(false)}
                  disabled={savingBdrc}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
            <Button
        type="button"
        variant="link"
        size="sm"
        title={
          bdrcId.trim()
            ? 'View details of the matched BDRC work'
            : 'Match a BDRC work first to view its details'
        }
        className="h-8 px-2 font-mono text-xs mt-2"
        disabled={disabled || !bdrcId.trim()}
        onClick={() => setWorkDetailModalOpen(true)}
      >
        Identify possible duplicates
      </Button>
        </div>
      )}
      <DuplicateModal work={fetchedWork} workLoading={workLoading} workError={workError} isOpen={workDetailModalOpen} onOpenChange={setWorkDetailModalOpen} />
      <CreateBdrcWorkModal
        open={createWorkModalOpen}
        onOpenChange={setCreateWorkModalOpen}
        onSuccess={handleCreateWorkSuccess}
        initialPrefLabel={searchQuery}
      />
    </div>
  )
}

export default BDRCField




