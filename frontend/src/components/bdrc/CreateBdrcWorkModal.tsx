import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createBdrcWork, type CreateBdrcWorkResponse } from '@/api/bdrc'
import { toast } from 'sonner'
import { useUser } from '@/hooks/useUser'
import { BdrcAuthorSelector } from './BdrcAuthorSelector'

export interface CreateBdrcWorkModalProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSuccess: (work: { workId: string; title?: string }) => void
  /** Pre-fill preferred label (e.g. current title search). */
  readonly initialPrefLabel?: string
}

function trimAll(items: { key: number; value: string }[]): string[] {
  return items.map((i) => i.value.trim()).filter(Boolean)
}

function makeItem(key: number, value = ''): { key: number; value: string } {
  return { key, value }
}

/** Author row: bdrc id in `value`, display name in `authorName` for the selector. */
function makeAuthorItem(key: number, value = '', authorName?: string) {
  return { key, value, ...(authorName ? { authorName } : {}) }
}

function ArrayField({
  label,
  items,
  onAdd,
  onRemove,
  onSetValue,
  placeholder,
  idPrefix,
}: Readonly<{
  label: string
  items: readonly { key: number; value: string }[]
  onAdd: () => void
  onRemove: (index: number) => void
  onSetValue: (index: number, value: string) => void
  placeholder: string
  idPrefix: string
}>) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="h-8 gap-1">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={item.key} className="flex gap-2">
            <Input
              id={`${idPrefix}-${item.key}`}
              value={item.value}
              onChange={(e) => onSetValue(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(i)}
              aria-label="Remove"
              className="shrink-0 h-9 w-9"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildInitialForm(
  nextKeyRef: { current: number },
  user: { email?: string; id?: string } | null | undefined
) {
  return {
    pref_label_bo: '',
    alt_label_bo: [makeItem(nextKeyRef.current++)],
    authors: [makeAuthorItem(nextKeyRef.current++)],
    versions: [makeItem(nextKeyRef.current++)],
    modified_by: user?.email ?? user?.id ?? '',
  }
}

export function CreateBdrcWorkModal({
  open,
  onOpenChange,
  onSuccess,
  initialPrefLabel = '',
}: CreateBdrcWorkModalProps) {
  const nextKeyRef = useRef(0)
  const { user } = useUser()
  const [form, setForm] = useState(() => buildInitialForm(nextKeyRef, user))
  const [submitError, setSubmitError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const resetForm = useCallback(() => {
    setForm(buildInitialForm(nextKeyRef, user))
    setSubmitError(null)
  }, [user])

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        pref_label_bo: (initialPrefLabel || prev.pref_label_bo).trim(),
      }))
      setSubmitError(null)
    } else {
      resetForm()
    }
  }, [open, initialPrefLabel, resetForm])

  const mutation = useMutation({
    mutationFn: createBdrcWork,
    onSuccess: (data: CreateBdrcWorkResponse) => {
      const workId = data.id ?? (data as Record<string, unknown>).work_id as string
      const title = data.pref_label_bo ?? (data as Record<string, unknown>).pref_label_bo as string | undefined
      if (!workId) {
        setSubmitError('Created work has no id')
        return
      }
      queryClient.invalidateQueries({ queryKey: ['bdrc-search'] })
      toast.success('Work created')
      onSuccess({ workId, title })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      setSubmitError(error.message || 'Failed to create work')
      toast.error(error.message)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const pref_label_bo = form.pref_label_bo.trim()
    if (!pref_label_bo) {
      setSubmitError('Preferred label (Tibetan) is required')
      return
    }
    const alt_label_bo = trimAll(form.alt_label_bo)
    const authors = trimAll(form.authors)
    const versions = trimAll(form.versions)
    const modified_by = form.modified_by.trim() || undefined

    mutation.mutate({
      pref_label_bo,
      alt_label_bo: alt_label_bo.length ? alt_label_bo : undefined,
      authors: authors.length ? authors : undefined,
      versions: versions.length ? versions : undefined,
      modified_by,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" showCloseButton>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create BDRC work</DialogTitle>
            <DialogDescription>
              Create a new work in BDRC. Preferred label (Tibetan) is required. Other fields are optional.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-work-pref_label_bo">
                Preferred label (Tibetan) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-work-pref_label_bo"
                value={form.pref_label_bo}
                onChange={(e) => setForm((prev) => ({ ...prev, pref_label_bo: e.target.value }))}
                placeholder="e.g. མདོ་སྡེ།"
                required
              />
            </div>

            <ArrayField
              label="Alternate labels (Tibetan)"
              idPrefix="create-work-alt_label_bo"
              items={form.alt_label_bo}
              onAdd={() => setForm((prev) => ({ ...prev, alt_label_bo: [...prev.alt_label_bo, makeItem(nextKeyRef.current++)] }))}
              onRemove={(i) => setForm((prev) => ({ ...prev, alt_label_bo: prev.alt_label_bo.filter((_, idx) => idx !== i) }))}
              onSetValue={(i, value) => setForm((prev) => ({
                ...prev,
                alt_label_bo: prev.alt_label_bo.map((item, idx) => idx === i ? { ...item, value } : item),
              }))}
              placeholder="Alternate label"
            />

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Authors (BDRC person IDs)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                    onClick={() => {
                    if(confirm('Are you sure you want to add an author/commentator ? multiple commentators allowed only for commentaries')){

                      setForm((prev) => ({ ...prev, authors: [...prev.authors, makeAuthorItem(nextKeyRef.current++)] }))
                    }
                  }}
                  className="h-8 gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {form.authors.map((item, i) => (
                  <div key={item.key} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <BdrcAuthorSelector
                        id={`create-work-author-${item.key}`}
                        value={item.value}
                        selectedName={'authorName' in item ? item.authorName : undefined}
                        onChange={(bdrcId, name) =>
                          setForm((prev) => ({
                            ...prev,
                            authors: prev.authors.map((it, idx) =>
                              idx === i
                                ? { ...it, value: bdrcId, authorName: name?.trim() || undefined }
                                : it
                            ),
                          }))
                        }
                        placeholder="Search or create author…"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setForm((prev) => ({ ...prev, authors: prev.authors.filter((_, idx) => idx !== i) }))}
                      aria-label="Remove author"
                      className="shrink-0 h-9 w-9 mt-0.5"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            {submitError && (
              <p className="text-sm text-destructive" role="alert">
                {submitError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create work'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
