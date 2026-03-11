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
import { createBdrcPerson, type CreateBdrcPersonResponse } from '@/api/bdrc'
import { toast } from 'sonner'
import { useUser } from '@/hooks/useUser'
import type { User } from '@auth0/auth0-react'

export interface CreateBdrcPersonModalProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSuccess: (person: { bdrc_id: string; name?: string }) => void
  /** Pre-fill preferred label (e.g. current author name). */
  readonly initialPrefLabel?: string
}

function makeItem(key: number, value = ''): { key: number; value: string } {
  return { key, value }
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

function trimAll(items: { key: number; value: string }[]): string[] {
  return items.map((i) => i.value.trim()).filter(Boolean)
}

function buildInitialForm(nextKeyRef: { current: number }, user: User | null | undefined) {
  return {
    pref_label_bo: '',
    alt_label_bo: [makeItem(nextKeyRef.current++)],
    dates: '',
    modified_by: user?.email ?? user?.id ?? '',
  }
}

export function CreateBdrcPersonModal({
  open,
  onOpenChange,
  onSuccess,
  initialPrefLabel = '',
}: CreateBdrcPersonModalProps) {
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
    mutationFn: createBdrcPerson,
    onSuccess: (data: CreateBdrcPersonResponse) => {
      const bdrc_id = data.id ?? (data as Record<string, unknown>).person_id as string
      const name = data.pref_label_bo ?? (data as Record<string, unknown>).pref_label_bo as string | undefined
      if (!bdrc_id) {
        setSubmitError('Created person has no id')
        return
      }
      queryClient.invalidateQueries({ queryKey: ['bdrc-search'] })
      toast.success('Author created')
      onSuccess({ bdrc_id, name })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      setSubmitError(error.message || 'Failed to create author')
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
    const dates = form.dates.trim() || undefined
    const modified_by = form.modified_by.trim() || undefined

    mutation.mutate({
      pref_label_bo,
      alt_label_bo: alt_label_bo.length ? alt_label_bo : undefined,
      dates,
      modified_by,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" showCloseButton>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create BDRC author</DialogTitle>
            <DialogDescription>
              Create a new person/author in BDRC. Preferred label (Tibetan) is required. Other fields are optional.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-person-pref_label_bo">
                Preferred label (Tibetan) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-person-pref_label_bo"
                value={form.pref_label_bo}
                onChange={(e) => setForm((prev) => ({ ...prev, pref_label_bo: e.target.value }))}
                placeholder="e.g. མི་ལ་རས་པ།"
                required
              />
            </div>

            <ArrayField
              label="Alternate labels (Tibetan)"
              idPrefix="create-person-alt_label_bo"
              items={form.alt_label_bo}
              onAdd={() => setForm((prev) => ({ ...prev, alt_label_bo: [...prev.alt_label_bo, makeItem(nextKeyRef.current++)] }))}
              onRemove={(i) => setForm((prev) => ({ ...prev, alt_label_bo: prev.alt_label_bo.filter((_, idx) => idx !== i) }))}
              onSetValue={(i, value) => setForm((prev) => ({
                ...prev,
                alt_label_bo: prev.alt_label_bo.map((item, idx) => idx === i ? { ...item, value } : item),
              }))}
              placeholder="Alternate label"
            />

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
                'Create author'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
