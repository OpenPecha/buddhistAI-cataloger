import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ListOrdered } from 'lucide-react'
import { useDocument } from './contexts'
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument'
import type { TextSegment } from './types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  title,
  subtitle,
  children,
}: Readonly<{
  title: string
  subtitle?: ReactNode
  children: ReactNode
}>) {
  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-lg border border-slate-200 bg-slate-50/90 overflow-hidden shadow-sm">
      <div className="px-3 py-2 border-b border-slate-200/90 bg-slate-100/80 shrink-0">
        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <ListOrdered className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
          {title}
        </div>
        {subtitle ? (
          <div className="text-[11px] text-slate-500 mt-0.5 normal-case font-normal tracking-normal">
            {subtitle}
          </div>
        ) : null}
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

  let subtitle = 'Document TOC and AI extraction side by side.'
  if (tocSegments.length > 0) {
    const plural = tocSegments.length === 1 ? '' : 's'
    subtitle = `${tocSegments.length} TOC segment${plural} in the document.`
  } else if (aiTocEntries.length > 0) {
    subtitle = 'AI entries available; add a TOC segment to compare with the document.'
  }

  return (
    <section
      className="flex flex-col flex-1 min-h-0 h-full bg-white border-l border-gray-200 font-monlam-2"
      aria-label="Table of contents viewer"
    >
      <header className="shrink-0 border-b border-gray-200 px-4 py-2.5 bg-white">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <div>
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Table of contents
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5 font-normal normal-case tracking-normal">
              {subtitle}
            </p>
          </div>
        </div>
      </header>

      <Tabs
        value={tocViewTab}
        onValueChange={(v) => setTocViewTab(v as TocViewTab)}
        className="flex flex-col flex-1 min-h-0 gap-0"
      >
        <TabsList className="w-full shrink-0 border-b border-gray-200 rounded-none h-9 p-0 bg-transparent flex">
          <TabsTrigger value="document" className="flex-1 rounded-none data-[state=active]:shadow-none">
            Document
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 rounded-none data-[state=active]:shadow-none">
            AI suggested
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="document"
          className="flex-1 min-h-0 overflow-hidden flex flex-col mt-0 px-3 pb-3 pt-2"
        >
          <TocPanelShell title="Document table of contents">
            <DocumentTocBody tocSegments={tocSegments} />
          </TocPanelShell>
        </TabsContent>

        <TabsContent
          value="ai"
          className="flex-1 min-h-0 overflow-hidden flex flex-col mt-0 px-3 pb-3 pt-2"
        >
          <TocPanelShell
            title="AI table of contents"
            subtitle={
              tocMismatch ? (
                <span className="block text-xs mt-1 text-slate-600">
                  Number of TEXT segments{' '}
                  <span className="text-red-500 font-medium">{textSegmentCount}</span> does not match
                  AI TOC entries ({aiTocEntries.length}). Please fix it.
                </span>
              ) : null
            }
          >
            <TocNumberedList
              lines={aiTocEntries}
              ariaLabel="AI-extracted table of contents entries"
              emptyMessage="No AI-extracted entries yet. Run TOC detection on a TOC segment in the workspace."
            />
          </TocPanelShell>
        </TabsContent>
      </Tabs>
    </section>
  )
}
