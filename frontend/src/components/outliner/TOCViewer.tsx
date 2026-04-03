import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ListOrdered } from 'lucide-react'
import { useDocument } from './contexts'
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument'
import type { TextSegment } from './types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '../ui/label'
import { Input } from '../ui/input'

function linesFromSegmentText(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0)
}

function TocNumberedList({
  lines,
  ariaLabel,
  emptyMessage,
}: Readonly<{
  lines: readonly string[]
  ariaLabel: string
  emptyMessage: string
}>) {
  if (lines.length === 0) {
    return (
      <p className="px-3 py-4 text-sm text-slate-500 text-center">{emptyMessage}</p>
    )
  }
  return (
    <ul
      className="px-3 py-2 space-y-2 text-sm text-slate-800 font-monlam leading-snug"
      aria-label={ariaLabel}
    >
      {lines.map((line, i) => (
        <li
          key={`${i}-${line}`}
          className="flex gap-2 border-b border-slate-200/60 pb-2 last:border-b-0 last:pb-0"
        >
          <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0 w-5 text-right pt-0.5">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word">{line}</span>
        </li>
      ))}
    </ul>
  )
}

function TocPanelShell({
  subtitle,
  children,
}: Readonly<{
  subtitle?: ReactNode
  children: ReactNode
}>) {
  return (
    <div className="flex flex-col flex-1 min-h-0  border border-slate-200 bg-slate-50/90 overflow-hidden shadow-sm">
      <div className="text-xs text-center text-slate-500 mt-0.5 normal-case font-normal tracking-normal">
        {subtitle}
          </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 [scrollbar-gutter:stable]">
        {children}
      </div>
    </div>
  )
}

function DocumentTocBody({ tocSegments }: Readonly<{ tocSegments: TextSegment[] }>) {
  if (tocSegments.length === 0) {
    return (
      <TocNumberedList
        lines={[]}
        ariaLabel="Document table of contents"
        emptyMessage="No TOC segment. Set a segment's type to TOC in the workspace to show its text here."
      />
    )
  }

  if (tocSegments.length === 1) {
    const lines = linesFromSegmentText(tocSegments[0].text)
    return (
      <TocNumberedList
        lines={lines}
        ariaLabel="Document table of contents lines"
        emptyMessage="No non-empty lines in this TOC segment yet."
      />
    )
  }

  return (
    <div className="px-3 py-2 space-y-4">
      {tocSegments.map((segment, idx) => {
        const lines = linesFromSegmentText(segment.text)
        return (
          <div key={segment.id}>
            <p className="text-[11px] font-medium text-slate-600 mb-2">
              TOC segment {idx + 1}
            </p>
            <TocNumberedList
              lines={lines}
              ariaLabel={`Document table of contents, part ${idx + 1}`}
              emptyMessage="No non-empty lines in this segment."
            />
          </div>
        )
      })}
    </div>
  )
}

type TocViewTab = 'document' | 'ai'

export default function TocViewer() {
  const { segments } = useDocument()
  const { document } = useOutlinerDocument()
  const [showAIToc,setShowAIToc]=useState(true)


  const tocSegments = useMemo(
    () => segments.filter((segment) => segment.label === 'TOC'),
    [segments]
  )
  const aiTocEntries = useMemo(
    () => document?.ai_toc_entries ?? [],
    [document?.ai_toc_entries]
  )

  const textSegmentCount = useMemo(
    () => segments.filter((s) => s.label === 'TEXT').length,
    [segments]
  )

  const tocMismatch =
    aiTocEntries.length > 0 && aiTocEntries.length !== textSegmentCount

  const [tocViewTab, setTocViewTab] = useState<TocViewTab>('document')

  useEffect(() => {
    if (tocViewTab !== 'document') return
    if (tocSegments.length === 0 && aiTocEntries.length > 0) {
      setTocViewTab('ai')
    }
  }, [tocSegments.length, aiTocEntries.length, tocViewTab])

  const subtitle=tocMismatch ? (
    <span className="block text-xs mt-1 text-slate-600">
  Number of TEXT segments{' '}
  <span className="text-red-500 font-medium">{textSegmentCount}</span> does not match
  AI TOC entries ({aiTocEntries.length}). Please fix it.
</span>
) : null

  return (
    <section
      className="flex flex-col flex-1 min-h-0 h-full bg-white border-l border-gray-200 font-monlam-2"
      aria-label="Table of contents viewer"
    >
      <header className="shrink-0 border-b border-gray-200 px-4 py-2.5 bg-white">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-between w-full">
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Table of contents
            </h2>
            <span className='flex items-center gap-2 text-xs'>

            <Label htmlFor="showAIToc">Show AI generated</Label>
            <Input id="showAIToc" className='h-4 w-4' type="checkbox" checked={showAIToc} onChange={(e) => setShowAIToc(e.target.checked)} />
            </span>
          </div>
        </div>
      </header>
      
       
     {showAIToc ?
     
     <TocPanelShell subtitle={subtitle}>
            <DocumentTocBody tocSegments={tocSegments} />
          </TocPanelShell>
:
<TocPanelShell
           
            subtitle={subtitle}
            >
            <TocNumberedList
              lines={aiTocEntries}
              ariaLabel="AI-extracted table of contents entries"
              emptyMessage="No AI-extracted entries yet. Run TOC detection on a TOC segment in the workspace."
              />
          </TocPanelShell>
}
    </section>
)
}
