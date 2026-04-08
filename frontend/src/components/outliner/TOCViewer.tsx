import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocument } from './contexts'
import { useOutlinerDocumentAiTocEntries } from '@/hooks/useOutlinerDocumentAiTocEntries'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AiTocEntryItem } from '@/api/outliner'
import { VolumeImagePanel } from './ImageWrapper'

function AiTocPageTitleList({
  items,
  ariaLabel,
  emptyMessage,
}: Readonly<{
  items: readonly AiTocEntryItem[]
  ariaLabel: string
  emptyMessage: string
}>) {
  if (items.length === 0) {
    return (
      <p className="px-3 py-4 text-sm text-slate-500 text-center">{emptyMessage}</p>
    )
  }
  return (
    <ul
      className="px-3 py-2 space-y-2 text-sm text-slate-800 font-monlam leading-snug"
      aria-label={ariaLabel}
    >
      {items.map((row, i) => (
        <li
          key={`${row.page_no}-${i}-${row.title}`}
          className="flex gap-2 border-b border-slate-200/60 pb-2 last:border-b-0 last:pb-0"
        >
          <span
            className="text-xs text-slate-500 font-mono tabular-nums shrink-0 min-w-[2.25rem] text-right pt-0.5"
            title={String(row.page_no)}
          >
            {row.page_no}
          </span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word">{row.title}</span>
        </li>
      ))}
    </ul>
  )
}

type SidePanelTab = 'images' | 'toc'
type TocSourceTab = 'document' | 'ai'

export default function TocViewer() {
  const { t } = useTranslation()
  const { segments } = useDocument()
  const { data: aiTocPayload, isLoading: isLoadingAiToc } = useOutlinerDocumentAiTocEntries()

  const [sideTab, setSideTab] = useState<SidePanelTab>('images')

  const tocSegments = useMemo(
    () => segments.filter((segment) => segment.label === 'TOC'),
    [segments]
  )
  const hasTocSegment = tocSegments.length > 0
  const aiTocEntries: AiTocEntryItem[] = aiTocPayload?.entries ?? []

  const textSegmentCount = useMemo(
    () => segments.filter((s) => s.label === 'TEXT').length,
    [segments]
  )

  const tocMismatch =
    aiTocEntries.length > 0 && aiTocEntries.length !== textSegmentCount

  const [tocSourceTab, setTocSourceTab] = useState<TocSourceTab>('document')

  useEffect(() => {
    if (!hasTocSegment && sideTab === 'toc') {
      setSideTab('images')
    }
  }, [hasTocSegment, sideTab])

  useEffect(() => {
    if (sideTab !== 'toc') return
    if (tocSourceTab !== 'document') return
    if (tocSegments.length === 0 && aiTocEntries.length > 0) {
      setTocSourceTab('ai')
    }
  }, [tocSegments.length, aiTocEntries.length, tocSourceTab, sideTab])

  const subtitle = tocMismatch ? (
    <span className="block text-[18px] font-monlam mt-1 text-red-400 animate-pulse" >
      {t('outliner.tocPanel.mismatch', {
        textCount: textSegmentCount,
        aiCount: aiTocEntries.length,
        lng: 'bo'
      })}
    </span>
  ) : null

  return (
    <section
      className="flex flex-col flex-1 min-h-0 h-full bg-white border-l border-gray-200 font-monlam-2"
      aria-label={t('outliner.tocPanel.sideAria')}
    >
      <Tabs
        value={sideTab}
        onValueChange={(v) => setSideTab(v as SidePanelTab)}
        className="flex flex-1 min-h-0 flex-col gap-0"
      >
        <header className="shrink-0 border-b border-gray-200 bg-white px-3 py-2">
          <TabsList className="grid h-9 w-full grid-cols-2">
            <TabsTrigger value="images" className="text-xs">
              {t('outliner.tocPanel.tabImages')}
            </TabsTrigger>
            <TabsTrigger
              value="toc"
              className="text-xs"
              disabled={!hasTocSegment}
              title={
                hasTocSegment
                  ? undefined
                  : t('outliner.tocPanel.tabTocDisabledTitle')
              }
            >
              {t('outliner.tocPanel.tabToc')}
            </TabsTrigger>
          </TabsList>
        </header>

        <TabsContent
          value="images"
          forceMount
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <VolumeImagePanel panelActive={sideTab === 'images'} />
        </TabsContent>

        <TabsContent
          value="toc"
          className="mt-0 flex min-h-0 overflow-auto flex-1 flex-col px-3 pb-3 pt-2"
        >
          {subtitle ? <div className="mb-2">{subtitle}</div> : null}
          {isLoadingAiToc ? (
            <p className="px-3 py-4 text-sm text-slate-500 text-center">
              {t('common.loading')}
            </p>
          ) : (
            <AiTocPageTitleList
              items={aiTocEntries}
              ariaLabel={t('outliner.tocPanel.ariaAiEntries')}
              emptyMessage={t('outliner.tocPanel.emptyAiEntries')}
            />
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}
