import { useCallback, useEffect, useMemo, useState } from 'react'
import ImageZoom from 'react-image-zooom'
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument'
import { useBdrcOtVolume } from '@/features/outliner/bdrc/hook/useBdrcOtVolume'
import { useDocument, useCursor, useSelection } from './contexts'
import { List, type RowComponentProps, useDynamicRowHeight, useListRef } from 'react-window'
import { Loader2 } from 'lucide-react'

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

function thumbUrlForPage(volId: string | null, pname: string | undefined) {
  return volId && pname
    ? `https://iiif.bdrc.io/bdr:${volId}::${pname}/full/225,100/0/default.jpg`
    : null
}

/** Reserved height for main page image so layout doesn’t jump when IIIF loads (matches IIIF 225×100 thumb aspect at ~92px width). */
const THUMB_IMAGE_SLOT_CLASS =
  'relative mx-auto block h-[41px] w-full max-w-[92px] overflow-hidden rounded-sm bg-gray-200'

/** Reserved slot for full page scan preview. */
const MAIN_IMAGE_SLOT_CLASS =
  'relative flex h-[min(52vh,30rem)] w-full items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-100'

type ThumbListItemData = {
  pages: BdrcPageLike[]
  volId: string | null
  selectedIndex: number
  onSelectPage: (index: number) => void
}

function ThumbRow({
  ariaAttributes,
  index,
  style,
  pages,
  volId,
  selectedIndex,
  onSelectPage,
}: RowComponentProps<ThumbListItemData>) {
  const pname = pages[index]?.pname
  const thumb = thumbUrlForPage(volId, pname)
  const isSelected = index === selectedIndex
  const [thumbLoaded, setThumbLoaded] = useState(false)

  useEffect(() => {
    setThumbLoaded(false)
  }, [thumb])

  return (
    <div {...ariaAttributes} style={style} className="px-1.5 py-[3px]">
      <button
        type="button"
        onClick={() => onSelectPage(index)}
        disabled={!thumb}
        title={`Page ${index + 1}`}
        className={[
          'relative box-border w-full overflow-hidden rounded border bg-white p-0.5 text-left transition-shadow',
          isSelected
            ? 'border-blue-500 ring-2 ring-blue-400 ring-offset-1'
            : 'border-gray-200 hover:border-gray-400',
          thumb ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
        ].join(' ')}
      >
        {thumb ? (
          <span className={THUMB_IMAGE_SLOT_CLASS}>
            {!thumbLoaded && (
              <span
                className="absolute inset-0 animate-pulse bg-linear-to-b from-gray-200 to-gray-300"
                aria-hidden
              />
            )}
            <img
              src={thumb}
              alt=""
              loading="lazy"
              onLoad={() => setThumbLoaded(true)}
              className={[
                'relative z-1 h-full w-full object-contain transition-opacity duration-150',
                thumbLoaded ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
            />
          </span>
        ) : (
          <span className={THUMB_IMAGE_SLOT_CLASS}>
            <span className="flex h-full w-full items-center justify-center text-[10px] text-gray-500">
              —
            </span>
          </span>
        )}
        <span className="absolute bottom-0.5 right-0.5 z-30 rounded bg-black/55 px-1 text-[9px] leading-tight text-white">
          {index + 1}
        </span>
      </button>
    </div>
  )
}

type PageImagePreviewProps = {
  pages: BdrcPageLike[]
  volId: string | null
  imageLink: string | null
  previewIndex: number
  pageCount: number
}

function PageImagePreview({
  pages,
  volId,
  imageLink,
  previewIndex,
  pageCount,
}: PageImagePreviewProps) {
  const pname = pages[previewIndex]?.pname
  const imageUrl =
    volId && pname
      ? `https://iiif.bdrc.io/bdr:${volId}::${pname}/full/max/0/default.jpg`
      : null

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto rounded border border-gray-200 bg-white p-3">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-gray-600">
        <div>
          Page {previewIndex + 1} / {pageCount}
        </div>
      
      </div>

      {imageUrl ? (
        <div className="w-full shrink-0">
          <p className="mb-1.5 text-[11px] text-gray-500">
            Click to zoom, move the pointer to pan, click again to reset.
          </p>
          <div className={MAIN_IMAGE_SLOT_CLASS}>
            <ImageZoom
              src={imageUrl}
              alt={`Volume page ${previewIndex + 1}`}
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
        </div>
      ) : (
        <div className={MAIN_IMAGE_SLOT_CLASS}>
          <span className="text-xs text-gray-500">No image available.</span>
        </div>
      )}
    </div>
  )
}

type ImageWrapperProps = {
  imageVisible: boolean
  onImageVisibleChange: (visible: boolean) => void
}

function ImageWrapper({ imageVisible, onImageVisibleChange }: ImageWrapperProps) {
  const thumbListRef = useListRef(null)

  const { document } = useOutlinerDocument()
  const volumeId = document?.filename ?? null

  const { segments, activeSegmentId } = useDocument()
  const { cursorPosition } = useCursor()
  const { bubbleMenuState } = useSelection()

  const activeSegment = useMemo(
    () => segments.find((s) => s.id === activeSegmentId) ?? null,
    [segments, activeSegmentId]
  )

  /** Document char index from click/caret/selection in the active segment — not segment start alone */
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

  const { volume, isLoading, error } = useBdrcOtVolume(volumeId)

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

  useEffect(() => {
    setPreviewIndex(0)
  }, [volumeId])

  useEffect(() => {
    if (pageCount === 0) return
    setPreviewIndex((i) => Math.min(i, pageCount - 1))
  }, [pageCount])

  /** Keep preview + sidebar selection aligned with caret/selection → BDRC page when we can resolve it */
  useEffect(() => {
    if (autoPageIndex < 0) return
    setPreviewIndex(autoPageIndex)
  }, [autoPageIndex])

  const thumbRowHeight = useDynamicRowHeight({
    defaultRowHeight: 58,
    key: 'page-image-thumbs',
  })

  const selectPage = useCallback((index: number) => {
    if (index < 0 || index >= pageCount) return
    setPreviewIndex(index)
  }, [pageCount])

  const thumbRowProps = useMemo<ThumbListItemData | null>(() => {
    if (!pages || !Array.isArray(pages) || pages.length === 0) return null
    return {
      pages,
      volId: volId?.trim() ? volId : null,
      selectedIndex: previewIndex,
      onSelectPage: selectPage,
    }
  }, [pages, volId, previewIndex, selectPage])

  useEffect(() => {
    if (!imageVisible) return
    if (pageCount === 0) return
    thumbListRef.current?.scrollToRow({
      index: previewIndex,
      align: 'smart',
      behavior: 'smooth',
    })
  }, [imageVisible, previewIndex, pageCount, thumbListRef])

  const v = volId?.trim() ? volId : null

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col border-b border-gray-200 bg-white">
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <div className="text-xs text-gray-600">
          Page image {activeSegmentId ? '(active segment)' : '(no segment selected)'}
        </div>
        <div className='flex gap-2 items-center'>

        <button
          type="button"
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          onClick={() => onImageVisibleChange(!imageVisible)}
          >
          {imageVisible ? 'Hide image' : 'Show image'}
        </button>
        {imageLink ? (
          <a
          target="_blank"
          rel="noreferrer"
          href={imageLink}
          className="text-blue-600 text-xs underline decoration-blue-600/40 underline-offset-2 hover:text-blue-800"
          >
            Open in BDRC library
          </a>
        ) : isLoading ? <Loader2 className="w-4 h-4 animate-spin" />: <div className="text-xs text-gray-600">No volume available.</div>}
        </div>
      </div>

      {imageVisible && (
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
          {isLoading && <div className="text-xs text-gray-600">Loading volume…</div>}
          {!isLoading && error && (
            <div className="text-xs text-red-600">Failed to load volume: {error}</div>
          )}

          {!isLoading && !error && pageCount === 0 && (
            <div className="text-xs text-gray-600">No pages available.</div>
          )}

          {!isLoading && !error && pageCount > 0 && pages && (
            <div className="flex min-h-0 flex-1 gap-2 overflow-hidden">
              <aside
                className="flex w-[104px] shrink-0 flex-col overflow-hidden rounded border border-gray-200 bg-gray-100"
                aria-label="Page thumbnails"
              >
                <div className="min-h-0 flex-1 overflow-hidden">
                  {thumbRowProps && (
                    <List
                      className="w-full"
                      style={{ height: '100%' }}
                      listRef={thumbListRef}
                      rowCount={pageCount}
                      rowHeight={thumbRowHeight}
                      rowComponent={ThumbRow}
                      rowProps={thumbRowProps}
                      overscanCount={5}
                    />
                  )}
                </div>
              </aside>
              <PageImagePreview
                pages={pages}
                volId={v}
                imageLink={imageLink}
                previewIndex={previewIndex}
                pageCount={pageCount}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ImageWrapper
