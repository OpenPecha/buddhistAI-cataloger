
import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle, XCircle } from 'lucide-react'
import { createCategory } from "@/api/category"
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

const defaultCategoryLanguageList = ["en", "bo", "zh"]

const allLanguageOptions = [
  { code: "en", label: "English" },
  { code: "bo", label: "Tibetan" },
  { code: "zh", label: "Chinese" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  // Add more as needed
]

export function CreateCategoryModal() {
  const [titleList, setTitleList] = useState<{ [key: string]: string }>({})
  const [categoryLanguageList, setCategoryLanguageList] = useState<string[]>(defaultCategoryLanguageList)
  const [isAddLangOpen, setIsAddLangOpen] = useState(false)
  const [newLangToAdd, setNewLangToAdd] = useState<string>("")
  const [parent, setParent] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()

  const resetForm = () => {
    setTitleList({})
    setCategoryLanguageList(defaultCategoryLanguageList)
    setParent(null)
    setIsAddLangOpen(false)
    setNewLangToAdd("")
  }

  const {
    mutate,
    isError,
    isSuccess,
    reset,
    isPending
  } = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      resetForm()
      setIsOpen(false)
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Require all fields in all languages to be filled and not blank
    for (const lang of categoryLanguageList) {
      if (!titleList[lang] || titleList[lang].trim() === "") {
        toast.error(`Title for '${lang.toUpperCase()}' is required`)
        return
      }
    }
    reset()
    // Build title object dynamically
    const titleValues: { [key: string]: string } = {}
    categoryLanguageList.forEach(lang => {
      titleValues[lang] = titleList[lang]
    })
    mutate({
      application: "webuddhist",
      title: titleValues,
      parent: parent ? parent : null,
    })
  }

  // Compute available languages not already added
  const availableLanguages = allLanguageOptions.filter(opt => !categoryLanguageList.includes(opt.code))

  const handleAddLangClick = () => {
    setIsAddLangOpen(true)
  }

  const handleSelectAddLang = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNewLangToAdd(e.target.value)
  }

  const handleConfirmAddLang = () => {
    if (!newLangToAdd || categoryLanguageList.includes(newLangToAdd)) {
      setIsAddLangOpen(false)
      setNewLangToAdd("")
      return
    }
    setCategoryLanguageList([...categoryLanguageList, newLangToAdd])
    setIsAddLangOpen(false)
    setNewLangToAdd("")
  }

  const handleCancelAddLang = () => {
    setIsAddLangOpen(false)
    setNewLangToAdd("")
  }

  const handleRemoveLanguage = (lang: string) => {
    setCategoryLanguageList(categoryLanguageList.filter(l => l !== lang))
    setTitleList(obj => {
      const { [lang]: _, ...rest } = obj
      return rest
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost"><PlusCircle /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Fill in the title fields for the new category.
              The new category will be created at the root unless you specify a parent ID.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 mt-2">
            {categoryLanguageList.map((language) => (
              <div key={language} className="grid gap-2 relative">
                <div className="flex items-center gap-2 justify-between">
                  <Label htmlFor={`category-title-${language}`}>Title ({language.toUpperCase()})</Label>
                  {!defaultCategoryLanguageList.includes(language) && (
                    <button
                      type="button"
                      title={`Remove ${language.toUpperCase()}`}
                      className="text-red-500 p-0 ml-1"
                      style={{ display: "flex", alignItems: "center" }}
                      onClick={() => handleRemoveLanguage(language)}
                    >
                      <XCircle size={18} aria-label={`Remove ${language.toUpperCase()}`} />
                    </button>
                  )}
                </div>
                <Input
                  id={`category-title-${language}`}
                  name={`title-${language}`}
                  value={titleList[language] || ''}
                  onChange={(e) => setTitleList({ ...titleList, [language]: e.target.value })}
                  placeholder={`Enter ${language.toUpperCase()} title`}
                  required
                />
              </div>
            ))}

            <div>
              {!isAddLangOpen && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddLangClick}
                  disabled={availableLanguages.length === 0}
                  className="mt-2"
                >
                  Add Language
                </Button>
              )}
              {isAddLangOpen && (
                <div className="flex gap-2 mt-2 items-center">
                  <select
                    value={newLangToAdd}
                    onChange={handleSelectAddLang}
                    className="border px-2 py-1 rounded"
                  >
                    <option value="">Select language</option>
                    {availableLanguages.map(l => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!newLangToAdd}
                    onClick={handleConfirmAddLang}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancelAddLang}
                  >Cancel</Button>
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <Label htmlFor="category-parent">Parent Category ID (Optional)</Label>
              <Input
                id="category-parent"
                name="parent"
                value={parent || ""}
                onChange={(e) => setParent(e.target.value || null)}
                placeholder="Leave blank for root"
              />
            </div>
            {isError && (
              <div className="text-red-600 text-sm">
                Category already exists
              </div>
            )}
            {isSuccess && (
              <div className="text-green-600 text-sm">
                Category created!
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => { resetForm(); reset() }}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateCategoryModal
