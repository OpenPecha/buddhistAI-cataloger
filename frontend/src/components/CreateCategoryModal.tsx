

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
import { PlusCircle } from 'lucide-react'
import { createCategory } from "@/api/category"
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function CreateCategoryModal() {
  const [titleEn, setTitleEn] = useState("")
  const [titleBo, setTitleBo] = useState("")
  const [titleZh, setTitleZh] = useState("")
  const [parent, setParent] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const resetForm = () => {
    setTitleEn("")
    setTitleBo("")
    setParent(null)
  }

  const {
    mutate,
    isError,
    isSuccess,
    error,
    reset,
    isPending
  } = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      resetForm(),
      setIsOpen(false),
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    reset()
    mutate({
      application: "webuddhist",
      title: {
        en: titleEn,
        bo: titleBo,
        zh: titleZh,
      },
      parent: parent ? parent : null,
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
            <div className="grid gap-3">
              <Label htmlFor="category-title-en">Title (English)</Label>
              <Input
                id="category-title-en"
                name="title-en"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="Enter English title"
                required
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="category-title-bo">Title (Tibetan)</Label>
              <Input
                id="category-title-bo"
                name="title-bo"
                value={titleBo}
                onChange={(e) => setTitleBo(e.target.value)}
                placeholder="རྩོམ་རིག"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="category-title-zh">Title (Chinese)</Label>
              <Input
                id="category-title-zh"
                name="title-zh"
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                placeholder="Enter Chinese title"
              />
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
                {(error instanceof Error) ? error.message : "Failed to create category"}
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
