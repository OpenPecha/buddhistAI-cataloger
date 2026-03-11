import { useState, useRef, Activity } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus } from 'lucide-react'
import { useBdrcSearch } from '@/hooks/useBdrcSearch'
import { CreateBdrcPersonModal } from './CreateBdrcPersonModal'

export interface BdrcAuthorSelectorProps {
  /** Current BDRC person ID. */
  readonly value: string
  /** Called when user selects or creates an author. */
  readonly onChange: (bdrcId: string, name?: string) => void
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

  const displayValue = value || (searchQueryProp === undefined ? localSearch : '')
  const showDropdown = isFocused

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

  const handleCreateSuccess = (person: { bdrc_id: string; name?: string }) => {
    handleSelect(person.bdrc_id, person.name)
    setCreatePersonModalOpen(false)
  }

  const openCreateModal = () => {
    setIsFocused(false)
    setCreatePersonModalOpen(true)
  }

  return (
    <div className="grid gap-1">
      {label && (
        <Label htmlFor={id} className="text-xs text-gray-500">
          {label}
        </Label>
      )}
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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
            {results.map((person, index) => (
              <button
                key={person.bdrc_id ?? index}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(person.bdrc_id ?? '', person.name)
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
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
