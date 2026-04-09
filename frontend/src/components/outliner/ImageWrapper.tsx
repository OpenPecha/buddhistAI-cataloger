import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ImageZoom from 'react-image-zooom'
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument'
import { useBdrcOtVolume } from '@/features/outliner/bdrc/hook/useBdrcOtVolume'
import { useDocument, useCursor, useSelection } from './contexts'
import {
  List,
  useListRef,
  type RowComponentProps,
} from 'react-window'
import { Link2, Loader2 } from 'lucide-react'

type BdrcPageLike = {
  pname?: string
  cstart?: number
  cend?: number
}

/** Document-level char index vs BDRC page cstart/cend */
function pageIndexForDocumentCharIndex(
  pages: BdrcPageLike[],
  charIndex: number
): number {
  if (!pages.length) return 0

  let containing = -1
  let lastStartBefore = -1

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    const cstart = typeof p?.cstart === 'number' ? p.cstart : null
    const cend = typeof p?.cend === 'number' ? p.cend : null
    if (cstart == null || cend == null) continue
    if (charIndex >= cstart && charIndex <= cend) containing = i
    if (cstart <= charIndex) lastStartBefore = i
  }

  if (containing >= 0) return containing
  if (lastStartBefore >= 0) return lastStartBefore
  return 0
}

const MAIN_IMAGE_SLOT_CLASS =
  'relative flex min-h-0 flex-1 w-full items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-100'

type PageImageRowProps = {
  pages: BdrcPageLike[]
  volId: string | null
  volumePageAlt: (pageNum1Based: number) => string
  noImageLabel: string
  rowViewportHeight: number
  activeIndex: number
}

function PageImageRow({
  ariaAttributes,
  index,
  style,
  pages,
  volId,
  volumePageAlt,
  noImageLabel,
  activeIndex,
}: RowComponentProps<PageImageRowProps>) {
  const pname = pages[index]?.pname
  const imageUrl =
    volId && pname
      ? `https://iiif.bdrc.io/bdr:${volId}::${pname}/full/max/0/default.jpg`
      : null

  const isActive = index === activeIndex

  return (
    <div {...ariaAttributes} style={style} className="box-border">
      <div
        className={[
          'flex h-full min-h-0 w-full flex-col overflow-hidden rounded',
          isActive
            ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-white'
            : '',
        ].join(' ')}
      >
        {imageUrl ? (
          <div className={MAIN_IMAGE_SLOT_CLASS}>
            <ImageZoom
              src={imageUrl}
              alt={volumePageAlt(index + 1)}
              zoom={250}
              fullWidth
              theme={{
                root: [
                  '!m-0 !flex h-full w-full min-h-0 max-h-full max-w-full items-center justify-center',
                  'overflow-hidden rounded bg-transparent',
                ].join(' '),
                image:
                  'relative z-1 mx-auto max-h-full max-w-full object-contain',
              }}
            />
          </div>
        ) : (
          <div className={MAIN_IMAGE_SLOT_CLASS}>
            <span className="text-xs text-gray-500">{noImageLabel}</span>
          </div>
        )}
        <div className="mt-1 shrink-0 text-center text-[11px] tabular-nums text-gray-500">
          {index + 1} / {pages.length}
        </div>
      </div>
    </div>
  )
}

export type VolumeImagePanelCoreProps = {
  /** When false, list does not auto-scroll on sync (e.g. tab hidden). */
  panelActive?: boolean
  /** BDRC volume id (same as document filename in the outliner). */
  volumeFilename: string | null
  /**
   * Document-level character index for BDRC page sync (e.g. caret in outliner,
   * or segment span_start on admin). Null disables auto mapping until sync is on.
   */
  documentCharIndexForImage: number | null
}

/**
 * Volume images + sync UI without Outliner context — use from admin or wrap from {@link VolumeImagePanel}.
 */
export function VolumeImagePanelCore({
  panelActive = true,
  volumeFilename,
  documentCharIndexForImage,
}: VolumeImagePanelCoreProps) {
  const { t } = useTranslation()
  const listRef = useListRef(null)

  const { volume, isLoading, error } = useBdrcOtVolume(volumeFilename)

  const pages = (volume as { pages?: BdrcPageLike[] } | null)?.pages
  const volId = (volume as { vol_id?: string } | null)?.vol_id

  const imageLink = volId?.trim()
    ? `https://library.bdrc.io/view/bdr:${volId}`
    : null

  const pageCount = pages?.length ?? 0

  const autoPageIndex = useMemo(() => {
    if (!Array.isArray(pages) || pages.length === 0) return -1
    if (documentCharIndexForImage == null) return -1
    return pageIndexForDocumentCharIndex(pages, documentCharIndexForImage)
  }, [pages, documentCharIndexForImage])

  const [previewIndex, setPreviewIndex] = useState(0)
  /** When true, the list scrolls to the page that matches the caret / selection in the active segment. */
  const [syncWithEditor, setSyncWithEditor] = useState(false)
  const [listViewportHeight, setListViewportHeight] = useState(480)

  useEffect(() => {
    setPreviewIndex(0)
  }, [volumeFilename])

  useEffect(() => {
    if (pageCount === 0) return
    setPreviewIndex((i) => Math.min(i, pageCount - 1))
  }, [pageCount])

  /** Follow BDRC page from document position only while sync is enabled */
  useEffect(() => {
    if (!syncWithEditor) return
    if (autoPageIndex < 0) return
    setPreviewIndex(autoPageIndex)
    if (!panelActive) return
    listRef.current?.scrollToRow({
      index: autoPageIndex,
      align: 'smart',
      behavior: 'smooth',
    })
  }, [autoPageIndex, syncWithEditor, panelActive, listRef])

  const onRowsRendered = useCallback(
    (visible: { startIndex: number; stopIndex: number }) => {
      setPreviewIndex((prev) => {
        const next = visible.startIndex
        return prev === next ? prev : next
      })
    },
    []
  )

  const onListResize = useCallback(
    (size: { height: number; width: number }) => {
      setListViewportHeight((h) =>
        Math.abs(h - size.height) < 1 ? h : Math.max(size.height, 120)
      )
    },
    []
  )

  const rowHeight = useCallback(
    (_index: number, props: { rowViewportHeight: number }) => {
      const h = props.rowViewportHeight
      return Math.max(h, 120)
    },
    []
  )

  const rowProps = useMemo((): PageImageRowProps | null => {
    if (!pages || !Array.isArray(pages) || pages.length === 0) return null
    return {
      pages,
      volId: volId?.trim() ? volId : null,
      volumePageAlt: (n: number) => t('outliner.images.volumePageAlt', { n }),
      noImageLabel: t('outliner.images.noImage'),
      rowViewportHeight: listViewportHeight,
      activeIndex: previewIndex,
    }
  }, [pages, volId, listViewportHeight, previewIndex, t])

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <button
          type="button"
          aria-pressed={syncWithEditor}
          title={
            syncWithEditor
              ? t('outliner.images.syncOn')
              : t('outliner.images.syncOff')
          }
          className={[
            'inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors',
            syncWithEditor
              ? 'border-blue-500 bg-blue-50 text-blue-800'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
          ].join(' ')}
          onClick={() => setSyncWithEditor((x) => !x)}
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('outliner.images.sync')}
        </button>
        {imageLink ? (
          <a
            target="_blank"
            rel="noreferrer"
            href={imageLink}
            className="text-xs text-blue-600 underline decoration-blue-600/40 underline-offset-2 hover:text-blue-800"
          >
            {t('outliner.images.openBdrcLibrary')}
          </a>
        ) : isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <div className="text-xs text-gray-600">{t('outliner.images.noVolume')}</div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
        {isLoading && <div className="text-xs text-gray-600">{t('outliner.images.loadingVolume')}</div>}
        {!isLoading && error && (
          <div className="text-xs text-red-600">
            {t('outliner.images.loadVolumeFailed', { message: String(error) })}
          </div>
        )}

        {!isLoading && !error && pageCount === 0 && (
          <div className="text-xs text-gray-600">{t('outliner.images.noPages')}</div>
        )}

        {!isLoading && !error && pageCount > 0 && pages && rowProps && (
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-gray-200 bg-gray-50"
            aria-label={t('outliner.images.pagesScrollAria')}
          >
            <List
              key={volumeFilename ?? 'no-volume'}
              listRef={listRef}
              className="min-h-0 w-full scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 [scrollbar-gutter:stable]"
              style={{ height: '100%' }}
              rowCount={pageCount}
              rowHeight={rowHeight}
              rowComponent={PageImageRow}
              rowProps={rowProps}
              overscanCount={1}
              onRowsRendered={onRowsRendered}
              onResize={onListResize}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export type VolumeImagePanelProps = {
  /** When false, list does not auto-scroll on sync (e.g. tab hidden). */
  panelActive?: boolean
}

/** Outliner workspace: resolves volume + caret from context and renders {@link VolumeImagePanelCore}. */
export function VolumeImagePanel({ panelActive = true }: VolumeImagePanelProps) {
  const { document } = useOutlinerDocument()
  const volumeFilename = document?.filename ?? null

  const { segments, activeSegmentId } = useDocument()
  const { cursorPosition } = useCursor()
  const { bubbleMenuState } = useSelection()

  const activeSegment = useMemo(
    () => segments.find((s) => s.id === activeSegmentId) ?? null,
    [segments, activeSegmentId]
  )

  const documentCharIndexForImage = useMemo((): number | null => {
    if (!activeSegmentId || !activeSegment) return null
    const base = activeSegment.span_start ?? 0

    if (
      cursorPosition?.segmentId === activeSegmentId &&
      typeof cursorPosition.offset === 'number'
    ) {
      return base + Math.max(0, cursorPosition.offset)
    }

    if (
      bubbleMenuState?.segmentId === activeSegmentId &&
      typeof bubbleMenuState.selectionStartOffset === 'number'
    ) {
      return base + Math.max(0, bubbleMenuState.selectionStartOffset)
    }

    return null
  }, [
    activeSegment,
    activeSegmentId,
    cursorPosition?.segmentId,
    cursorPosition?.offset,
    bubbleMenuState?.segmentId,
    bubbleMenuState?.selectionStartOffset,
  ])

  return (
    <VolumeImagePanelCore
      panelActive={panelActive}
      volumeFilename={volumeFilename}
      documentCharIndexForImage={documentCharIndexForImage}
    />
  )
}

export default VolumeImagePanel
