import { useState, useRef, Activity } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, UserX } from 'lucide-react'
import { useBdrcSearch } from '@/hooks/useBdrcSearch'
import { CreateBdrcPersonModal } from './CreateBdrcPersonModal'

/** Sentinel value for author bdrc_id when author is difficult to identify. */
export const BDRC_AUTHOR_DIFFICULT_TO_IDENTIFY = 'difficult_to_identify'

export interface BdrcAuthorSelectorProps {
  /** Current BDRC person ID. */
  readonly value: string
  /** Called when user selects or creates an author. */
  readonly onChange: (bdrcId: string, name?: string) => void
  /**
   * When set with a non-empty value, the input shows this name instead of the id.
   * The id is shown separately as a small “ID: …” label.
   */
  readonly selectedName?: string | null
  /** Optional. When provided (e.g. author name from parent), search uses this instead of local input. */
  readonly searchQuery?: string
  readonly placeholder?: string
  readonly id?: string
  readonly label?: string
}

/**
 * Shared author selector: BDRC person search dropdown + "Create new author".
 * Use in AuthorField (with searchQuery = author name) and in CreateBdrcWorkModal (one per author row).
 */
export function BdrcAuthorSelector({
  value,
  onChange,
  selectedName,
  searchQuery: searchQueryProp,
  placeholder = 'Search or select BDRC author…',
  id = 'bdrc-author-selector',
  label,
}: BdrcAuthorSelectorProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [localSearch, setLocalSearch] = useState('')
  const [createPersonModalOpen, setCreatePersonModalOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const searchQuery = searchQueryProp !== undefined ? searchQueryProp : localSearch
  const { results, isLoading } = useBdrcSearch(
    searchQuery,
    'Person',
    400,
    () => inputRef.current?.focus(),
    isFocused
  )

  const nameForField =
    selectedName != null && String(selectedName).trim() !== '' ? String(selectedName).trim() : null

  const displayValue =
    value === BDRC_AUTHOR_DIFFICULT_TO_IDENTIFY
      ? 'Difficult to identify'
      : isFocused
        ? searchQueryProp !== undefined
          ? searchQueryProp
          : localSearch
        : nameForField && value
          ? nameForField
          : value || (searchQueryProp === undefined ? localSearch : '')

  const showDropdown = isFocused
  /** Show id as a separate line only when the field shows the name (not the raw id). */
  const showIdLabel =
    Boolean(value) &&
    value !== BDRC_AUTHOR_DIFFICULT_TO_IDENTIFY &&
    Boolean(nameForField)

  const handleSelect = (bdrc_id: string, name?: string) => {
    onChange(bdrc_id, name)
    setLocalSearch('')
    setIsFocused(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (searchQueryProp !== undefined) {
      onChange(v, undefined)
    } else {
      setLocalSearch(v)
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
    if (searchQueryProp === undefined) {
      setLocalSearch('')
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    if (searchQueryProp === undefined) {
      setLocalSearch('')
    }
  }

  const handleCreateSuccess = (person: { bdrc_id: string; name?: string }) => {
    handleSelect(person.bdrc_id, person.name)
    setCreatePersonModalOpen(false)
  }

  const openCreateModal = () => {
    setIsFocused(false)
    setCreatePersonModalOpen(true)
  }

  return (
    <div className="grid gap-1 ">
      {label && (
        <Label htmlFor={id} className="text-xs text-gray-500">
          {label}
        </Label>
      )}
      {showIdLabel && (
        <div className="text-[10px] text-muted-foreground font-mono leading-tight" aria-hidden>
          ID: {value}
        </div>
      )}
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full pr-8 text-sm"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        )}
        <Activity mode={showDropdown ? 'visible' : 'hidden'}>
          <div className="absolute z-[900] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {results.length === 0 && !isLoading && searchQuery.trim() && (
              <div className="px-4 py-2 text-sm text-muted-foreground border-b border-gray-100">
                No results. Create a new author below.
              </div>
            )}
              <span className={`text-xs pl-2 ${results.length === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                found: {results.length}
              </span>
            {results.map((person, index) => (
              <button
                key={person.bdrc_id ?? index}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(person.bdrc_id ?? '', person.name)
                }}
                className="w-full font-monlam px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900">{person.name ?? person.bdrc_id}</div>
                {person.bdrc_id && (
                  <div className="text-xs text-gray-500">ID: {person.bdrc_id}</div>
                )}
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(BDRC_AUTHOR_DIFFICULT_TO_IDENTIFY, 'Difficult to identify')
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 border-t border-gray-200 flex items-center gap-2 text-sm text-muted-foreground"
            >
              <UserX className="h-4 w-4 shrink-0" />
              Difficult to identify
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                openCreateModal()
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 border-t border-gray-200 flex items-center gap-2 text-sm text-primary font-medium"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Create new author
            </button>
          </div>
        </Activity>
      </div>

      <CreateBdrcPersonModal
        open={createPersonModalOpen}
        onOpenChange={setCreatePersonModalOpen}
        onSuccess={handleCreateSuccess}
        initialPrefLabel={searchQuery.trim() || undefined}
      />
    </div>
  )
}
