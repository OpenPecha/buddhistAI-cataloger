import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog'
import BDRCSeachWrapper from '../BDRCSeachWrapper'
import { Button } from '@/components/ui/button'
import AuthorsListing from './AuthorsListing'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, PersonStandingIcon } from 'lucide-react'
import {
  useBdrcSearch,
  useBdrcWork,
  bdrcSearchQueryKeyRoot,
  type BdrcSearchResult,
  type BdrcWorkAuthor,
  type BdrcWorkInfo,
} from '@/hooks/useBdrcSearch'
import { mergeBdrcPersons, mergeBdrcWorks } from '@/api/bdrc'
import { useAuth0 } from '@auth0/auth0-react'
import { useUser } from '@/hooks/useUser'
import { toast } from 'sonner'

const EMPTY_AUTHORS: BdrcWorkAuthor[] = []

type DuplicateModalProps = Readonly<{
  work: BdrcWorkInfo | null
  workLoading: boolean
  workError: string | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}>

export function DuplicateModal({
  work,
  workLoading,
  workError,
  isOpen,
  onOpenChange,
}: DuplicateModalProps) {
  const { user: apiUser } = useUser()
  const { user: auth0User } = useAuth0()
  const modifiedBy =
    apiUser?.email?.trim() ||
    auth0User?.email?.trim() ||
    apiUser?.id?.trim() ||
    auth0User?.sub?.trim() ||
    undefined

  if (!work) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>Identify possible duplicates</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {workError && !workLoading && (
            <p className="text-xs text-red-600" role="alert">
              {workError}
            </p>
          )}
         
        </div>
        <BDRCSearch parentWork={work} isOpen={isOpen} modifiedBy={modifiedBy} />
        <BDRCPersonDuplicateSearch
          authors={work.authors ?? EMPTY_AUTHORS}
          isOpen={isOpen}
          modifiedBy={modifiedBy}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function defaultDuplicateSearchQuery(work: BdrcWorkInfo): string {
  const title = work.title?.trim() ?? ''
  if (title) return title
  return work.workId?.trim() ?? ''
}

type BDRCSearchProps = Readonly<{
  parentWork: BdrcWorkInfo
  isOpen: boolean
  modifiedBy?: string
}>

function BDRCSearch({ parentWork, isOpen, modifiedBy }: BDRCSearchProps) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(() => defaultDuplicateSearchQuery(parentWork))
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [mergingWorkId, setMergingWorkId] = useState<string | null>(null)
  const [mergeError, setMergeError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setQuery(defaultDuplicateSearchQuery(parentWork))
    setSelectedWorkId(null)
    setMergeError(null)
    setMergingWorkId(null)
  }, [isOpen, parentWork])

  const { results, isLoading, error } = useBdrcSearch(query, 'Work', 1000, () => {}, true)
  const {
    work: selectedWork,
    isLoading: selectedLoading,
    error: selectedError,
  } = useBdrcWork(selectedWorkId)

  const filteredResults = results.filter(
    (r) => (r.workId ?? '').trim() && r.workId !== parentWork.workId
  )

  const handlePick = (item: BdrcSearchResult) => {
    const id = item.workId?.trim()
    if (!id) return
    setSelectedWorkId(id)
  }

  const handleDuplicate = async (e: MouseEvent<HTMLButtonElement>, item: BdrcSearchResult) => {
    e.preventDefault()
    e.stopPropagation()
    const searched = item.workId?.trim()
    const parent = parentWork.workId?.trim()
    if (!searched || !parent) return
    setMergeError(null)
    setMergingWorkId(searched)
    try {
      await mergeBdrcWorks({
        parent_work_id: parent,
        searched_work_id: searched,
        ...(modifiedBy ? { modified_by: modifiedBy } : {}),
      })
      await queryClient.invalidateQueries({ queryKey: bdrcSearchQueryKeyRoot })
      toast.success('Duplicate merged into this work')
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMergingWorkId(null)
    }
  }

  return (
    <div className="space-y-3 border-t border-gray-200 pt-3">
      <div>
       
        <p className="mt-0.5 text-[11px] text-gray-400">
          Current work:{' '}
          <span className="font-mono text-gray-600">{parentWork.workId}</span>
        </p>
        <div className="relative mt-1">
          <Input
            id="duplicate-bdrc-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…"
            className="w-full pr-9 text-sm"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
        {mergeError && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {mergeError}
          </p>
        )}
      </div>

      {query.trim() && !isLoading && !error && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
          {filteredResults.length === 0 ? (
            <p className="p-3 text-xs text-gray-500">No other works match this search.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredResults.map((item, index) => (
                <li key={item.workId || index}>
                  <div className="flex items-stretch gap-0">
                    <button
                      type="button"
                      onClick={() => handlePick(item)}
                      className="min-w-0 flex-1 px-3 py-2 text-left font-monlam text-sm hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">
                        {item.title?.trim() || item.workId || '—'}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                        <PersonStandingIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>{item.authors?.[0]?.name ?? 'unknown author'}</span>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center border-l border-gray-100 px-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!!mergingWorkId}
                        onClick={(e) => handleDuplicate(e, item)}
                      >
                        {mergingWorkId === item.workId?.trim() ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Duplicate'
                        )}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedWorkId && (
        <div className="rounded-md border border-emerald-200/90 bg-emerald-50/50 p-3 text-sm">
          <div className="text-xs font-medium text-emerald-900/90">Selected work</div>
          {selectedLoading && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Loading…
            </div>
          )}
          {selectedError && !selectedLoading && (
            <p className="mt-2 text-xs text-red-600">{selectedError}</p>
          )}
          {!selectedLoading && selectedWork && (
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-xs text-gray-500">Title</div>
                <BDRCSeachWrapper bdrcId={selectedWork.workId}>
                  <div className="mt-0.5 font-monlam font-medium text-gray-900">
                    {selectedWork.title || '—'}
                  </div>
                </BDRCSeachWrapper>
              </div>
              <div>
                <div className="text-xs text-gray-500">Work ID</div>
                <div className="mt-0.5 font-mono text-xs text-gray-700">{selectedWork.workId}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Authors</div>
                <ul className="mt-1">
                  <AuthorsListing authors={selectedWork.authors ?? []} />
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function firstLinkedAuthorId(authors: BdrcWorkAuthor[]): string {
  const id = authors.find((a) => a.id?.trim())?.id
  return id?.trim() ?? ''
}

function defaultPersonDuplicateQuery(parentPersonId: string, authors: BdrcWorkAuthor[]): string {
  const a = authors.find((x) => (x.id?.trim() ?? '') === parentPersonId)
  const name = a?.name?.trim() ?? ''
  if (name) return name
  return parentPersonId.trim()
}

type BDRCPersonDuplicateSearchProps = Readonly<{
  authors: BdrcWorkAuthor[]
  isOpen: boolean
  modifiedBy?: string
}>

function BDRCPersonDuplicateSearch({ authors, isOpen, modifiedBy }: BDRCPersonDuplicateSearchProps) {
  const queryClient = useQueryClient()
  const authorsWithBdrc = useMemo(
    () => authors.filter((a) => Boolean(a.id?.trim())),
    [authors]
  )

  const [parentPersonId, setParentPersonId] = useState(() => firstLinkedAuthorId(authors))
  const [personQuery, setPersonQuery] = useState(() =>
    defaultPersonDuplicateQuery(firstLinkedAuthorId(authors), authors)
  )
  const [selectedPerson, setSelectedPerson] = useState<BdrcSearchResult | null>(null)
  const [mergingPersonId, setMergingPersonId] = useState<string | null>(null)
  const [personMergeError, setPersonMergeError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const ids = authorsWithBdrc.map((a) => a.id!.trim())
    setParentPersonId((prev) => (prev && ids.includes(prev) ? prev : ids[0] ?? ''))
  }, [isOpen, authorsWithBdrc])

  useEffect(() => {
    if (!isOpen) return
    setSelectedPerson(null)
    setPersonMergeError(null)
    setMergingPersonId(null)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !parentPersonId) return
    setPersonQuery(defaultPersonDuplicateQuery(parentPersonId, authors))
    setSelectedPerson(null)
  }, [isOpen, parentPersonId, authors])

  const {
    results: personResults,
    isLoading: personLoading,
    error: personSearchError,
  } = useBdrcSearch(personQuery, 'Person', 1000, () => {}, true)

  const filteredPersonResults = personResults.filter((r) => {
    const id = (r.bdrc_id ?? '').trim()
    return id && id !== parentPersonId
  })

  const handlePickPerson = (item: BdrcSearchResult) => {
    const id = item.bdrc_id?.trim()
    if (!id) return
    setSelectedPerson(item)
  }

  const handleDuplicatePerson = async (e: MouseEvent<HTMLButtonElement>, item: BdrcSearchResult) => {
    e.preventDefault()
    e.stopPropagation()
    const searched = item.bdrc_id?.trim()
    const parent = parentPersonId.trim()
    if (!searched || !parent) return
    setPersonMergeError(null)
    setMergingPersonId(searched)
    try {
      await mergeBdrcPersons({
        parent_person_id: parent,
        searched_person_id: searched,
        ...(modifiedBy ? { modified_by: modifiedBy } : {}),
      })
      await queryClient.invalidateQueries({ queryKey: bdrcSearchQueryKeyRoot })
      toast.success('Duplicate merged into this author')
    } catch (err) {
      setPersonMergeError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMergingPersonId(null)
    }
  }

  return (
    <div className="space-y-3 border-t border-gray-200 pt-3">
      <div className="text-xs font-medium text-gray-700">Authors </div>
      {authorsWithBdrc.length === 0 ? (
        <p className="text-xs text-gray-500">
          No authors on this work are linked to BDRC person IDs. Link an author first to search and merge
          duplicate persons.
        </p>
      ) : (
        <>
          <div>
            <Label htmlFor="duplicate-canonical-author" className="text-xs text-gray-500">
              Canonical author (merge duplicates into this person)
            </Label>
            <select
              id="duplicate-canonical-author"
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={parentPersonId}
              onChange={(e) => setParentPersonId(e.target.value)}
            >
              {authorsWithBdrc.map((a) => (
                <option key={a.id} value={a.id!.trim()}>
                  {(a.name?.trim() || a.id) ?? a.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="duplicate-bdrc-person-search" className="text-xs text-gray-500">
              Search BDRC by person name
            </Label>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Canonical person:{' '}
              <span className="font-mono text-gray-600">{parentPersonId}</span>
            </p>
            <div className="relative mt-1">
              <Input
                id="duplicate-bdrc-person-search"
                type="text"
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder="Search by name…"
                className="w-full pr-9 text-sm"
              />
              {personLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            {personSearchError && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {personSearchError}
              </p>
            )}
            {personMergeError && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {personMergeError}
              </p>
            )}
          </div>

          {personQuery.trim() && !personLoading && !personSearchError && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
              {filteredPersonResults.length === 0 ? (
                <p className="p-3 text-xs text-gray-500">No other persons match this search.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredPersonResults.map((item, index) => {
                    const pid = item.bdrc_id?.trim() ?? String(index)
                    const label = item.name?.trim() || item.bdrc_id || '—'
                    return (
                      <li key={pid}>
                        <div className="flex items-stretch gap-0">
                          <button
                            type="button"
                            onClick={() => handlePickPerson(item)}
                            className="min-w-0 flex-1 px-3 py-2 text-left font-monlam text-sm hover:bg-gray-50"
                          >
                            <div className="font-medium text-gray-900">{label}</div>
                            <div className="mt-0.5 font-mono text-xs text-gray-500">{item.bdrc_id}</div>
                          </button>
                          <div className="flex shrink-0 items-center border-l border-gray-100 px-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={!!mergingPersonId}
                              onClick={(e) => handleDuplicatePerson(e, item)}
                            >
                              {mergingPersonId === item.bdrc_id?.trim() ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                'Duplicate'
                              )}
                            </Button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {selectedPerson?.bdrc_id?.trim() && (
            <div className="rounded-md border border-emerald-200/90 bg-emerald-50/50 p-3 text-sm">
              <div className="text-xs font-medium text-emerald-900/90">Selected person</div>
              <div className="mt-2 space-y-2">
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <BDRCSeachWrapper bdrcId={selectedPerson.bdrc_id.trim()}>
                    <div className="mt-0.5 font-monlam font-medium text-gray-900">
                      {selectedPerson.name?.trim() || '—'}
                    </div>
                  </BDRCSeachWrapper>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Person ID</div>
                  <div className="mt-0.5 font-mono text-xs text-gray-700">
                    {selectedPerson.bdrc_id.trim()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}