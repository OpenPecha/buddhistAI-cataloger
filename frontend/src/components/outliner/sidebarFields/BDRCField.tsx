import React,{ useState, useRef, useEffect, Activity, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
import TitlesListing from './TitlesListing'

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

const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCaptchaCode(length = 6): string {
  const buf = new Uint32Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf)
  } else {
    for (let i = 0; i < length; i += 1) {
      buf[i] = Math.floor(Math.random() * 2 ** 32)
    }
  }
  return Array.from(buf, (n) => CAPTCHA_CHARS[n % CAPTCHA_CHARS.length]).join('')
}

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
  const { t } = useTranslation()
  const { user } = useAuth0()
  const bdrcId = formData?.title?.bdrc_id || segment.title_bdrc_id || ''
  const titleFromProp = formData?.title?.name || ''
  const [searchQuery, setSearchQuery] = useState(titleFromProp)
  const [isBdrcFocused, setIsBdrcFocused] = useState(false)
  const [createWorkModalOpen, setCreateWorkModalOpen] = useState(false)
  const [captchaGateOpen, setCaptchaGateOpen] = useState(false)
  const [captchaStep, setCaptchaStep] = useState<1 | 2>(1)
  const [captchaExpected, setCaptchaExpected] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [workDetailModalOpen, setWorkDetailModalOpen] = useState(false)
  const bdrcInputRef = useRef<HTMLInputElement>(null)
  const captchaFieldRef = useRef<HTMLInputElement>(null)
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

  const openCreateWorkCaptcha = () => {
    setCaptchaStep(1)
    setCaptchaExpected(generateCaptchaCode())
    setCaptchaInput('')
    setCaptchaGateOpen(true)
  }

  useEffect(() => {
    if (!captchaGateOpen) return
    const id = requestAnimationFrame(() => captchaFieldRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [captchaGateOpen, captchaStep])

  const handleCaptchaGateOpenChange = (open: boolean) => {
    setCaptchaGateOpen(open)
    if (!open) {
      setCaptchaStep(1)
      setCaptchaInput('')
      setCaptchaExpected('')
    }
  }

  const handleCaptchaContinue = () => {
    if (captchaInput.trim().toUpperCase() !== captchaExpected) {
      toast.error(t('outliner.bdrc.captchaMismatch'))
      setCaptchaInput('')
      setCaptchaExpected(generateCaptchaCode())
      return
    }
    if (captchaStep === 1) {
      setCaptchaStep(2)
      setCaptchaExpected(generateCaptchaCode())
      setCaptchaInput('')
      toast.success(t('outliner.bdrc.captchaFirstOk'))
      return
    }
    handleCaptchaGateOpenChange(false)
    setCreateWorkModalOpen(true)
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
        t('outliner.bdrc.authorMismatchWarning')
      )
    }
  }, [annotatorAuthorName, bdrcId, workLoading, fetchedWork, onBdrcAuthorBlockingChange, reportBlocking, t])

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
      toast.success(t('outliner.bdrc.workUpdated'))
      await refetch()
      setEditingBdrc(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('outliner.bdrc.workUpdateFailed'))
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
              placeholder={t('outliner.bdrc.searchTitlePlaceholder')}
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
            <div className="flex flex-wrap absolute z-900 w-full  mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {titleResults.map((title, index) => (
                <button
                  key={title.workId || index}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(title)
                  }}
                  className="w-full cursor-pointer px-4 py-2 font-monlam text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-sm font-medium text-gray-900">
                    <TitlesListing bdrc_data={title} isLink={false} />
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <AuthorsListing authors={title.authors ?? []} isLink={false} />
                    {title.origin && title.origin !== "imported" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 mr-1">
                        {t('outliner.bdrc.originPrefix')} {title.origin}
                      </span>
                    )}
                    {title.record_status === "duplicate" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                        {t('outliner.bdrc.duplicateBadge')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsBdrcFocused(false)
                  openCreateWorkCaptcha()
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 border-t border-gray-200 flex items-center gap-2 text-sm text-primary font-medium"
              >
                <Plus className="h-4 w-4 shrink-0" />
                {t('outliner.bdrc.createWork')}
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
              <span className="text-sm">{t('outliner.bdrc.loadingWork')}</span>
            </div>
          )}
          {workError && !workLoading && (
            <p className="text-xs text-red-600">{workError}</p>
          )}
          {!workLoading && displayInfo && !editingBdrc && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
              <TitlesListing bdrc_data={displayInfo} />
                <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
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
                    title={t('outliner.bdrc.editWorkTitle')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={handleClearSelection}
                    title={t('outliner.bdrc.clearSelectionTitle')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
           
            </div>
          )}
          {!workLoading && !displayInfo && !editingBdrc && (
            <div className="text-sm text-gray-500">{t('outliner.bdrc.noWorkInfo')}</div>
          )}
          {!disabled && editingBdrc && (
            <div className="space-y-2 pt-1">
              <div>
                <Label className="text-xs text-gray-500">{t('outliner.bdrc.titleLabel')} </Label>
                <Input
                  value={editPrefLabel}
                  onChange={(e) => setEditPrefLabel(e.target.value)}
                  className="mt-1 font-monlam text-sm"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-500">{t('outliner.bdrc.authorsLabel')}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => {
                      if (
                        window.confirm(
                          t('outliner.bdrc.addAuthorConfirm')
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
                    {t('outliner.bdrc.add')}
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
                          placeholder={t('outliner.bdrc.searchAuthorPlaceholder')}
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
                        aria-label={t('outliner.bdrc.removeAuthorAria')}
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
                  {t('outliner.bdrc.saveToBdrc')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditingBdrc(false)}
                  disabled={savingBdrc}
                >
                  {t('common.cancel')}
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
        {t('outliner.bdrc.identifyDuplicates')}
      </Button>
        </div>
      )}
      <DuplicateModal work={fetchedWork} workLoading={workLoading} workError={workError} isOpen={workDetailModalOpen} onOpenChange={setWorkDetailModalOpen} />
      <Dialog open={captchaGateOpen} onOpenChange={handleCaptchaGateOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('outliner.bdrc.confirmCreateTitle')}</DialogTitle>
            <DialogDescription>
              {t('outliner.bdrc.confirmCreateDescription')}
            </DialogDescription>
            <p className="text-sm font-medium text-foreground" aria-live="polite">
              {t('outliner.bdrc.captchaStep', { step: captchaStep })}
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div
              className="rounded-md border bg-muted px-4 py-3 text-center font-mono text-2xl font-semibold tracking-[0.35em] text-foreground select-none"
              aria-hidden
            >
              {captchaExpected}
            </div>
            <div>
              <Label htmlFor="bdrc-create-captcha" className="text-xs text-muted-foreground">
                Type the code
              </Label>
              <Input
                id="bdrc-create-captcha"
                ref={captchaFieldRef}
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCaptchaContinue()
                  }
                }}
                className="mt-1 font-mono uppercase tracking-widest"
                autoComplete="off"
                spellCheck={false}
                maxLength={captchaExpected.length || 6}
              />
            </div>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={() => {
                setCaptchaExpected(generateCaptchaCode())
                setCaptchaInput('')
                requestAnimationFrame(() => captchaFieldRef.current?.focus())
              }}
            >
              {t('outliner.bdrc.newCode')}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleCaptchaGateOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleCaptchaContinue}>
              {t('common.continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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




