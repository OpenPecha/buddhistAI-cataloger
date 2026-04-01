
import { useEffect, useMemo, useState } from 'react'
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument'
import { useBdrcOtVolume } from '@/features/outliner/bdrc/hook/useBdrcOtVolume'
import { useDocument } from './contexts'
import { List, type RowComponentProps, useDynamicRowHeight, useListRef } from 'react-window'

type BdrcPageLike = {
  pname?: string
  cstart?: number
  cend?: number
}

type ImageListItemData = {
  pages: BdrcPageLike[]
  volId: string | null
  imageLink: string | null
  activeIndex: number
  pageCount: number
}

function ImageRow({
  ariaAttributes,
  index,
  style,
  pages,
  volId,
  imageLink,
  activeIndex,
  pageCount,
}: RowComponentProps<ImageListItemData>) {
  const pname = pages[index]?.pname
  const imageUrl =
    volId && pname
      ? `https://iiif.bdrc.io/bdr:${volId}::${pname}/full/max/0/default.jpg`
      : null

  const isActive = index === activeIndex

  return (
    <div {...ariaAttributes} style={style} className="px-3 py-2">
      <div
        className={[
          'rounded border bg-white p-2',
          isActive ? 'border-blue-400' : 'border-gray-200',
        ].join(' ')}
      >
        <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
          <div>
            Page {index + 1} / {pageCount}
          </div>
          {isActive && <div className="text-blue-600">Active</div>}
        </div>

        {imageUrl ? (
          <a target="_blank" rel="noreferrer" href={imageLink ?? undefined}>
            <img
              src={imageUrl}
              alt={`volume page ${index + 1}`}
              loading="lazy"
              className="max-h-[360px] w-auto rounded border border-gray-200"
            />
          </a>
        ) : (
          <div className="text-xs text-gray-600">No image available.</div>
        )}
      </div>
    </div>
  )
}

function ImageWrapper() {
  const [isVisible, setIsVisible] = useState(false)
  const listRef = useListRef(null)

  const { document } = useOutlinerDocument()
  const volumeId = document?.filename ?? null

  const { segments, activeSegmentId } = useDocument()
  const activeSegment = useMemo(
    () => segments.find((s) => s.id === activeSegmentId) ?? null,
    [segments, activeSegmentId]
  )
  const activeSegmentStart = activeSegment?.span_start ?? 0

  const { volume, isLoading, error } = useBdrcOtVolume(volumeId)

  const pages = (volume as { pages?: BdrcPageLike[] } | null)?.pages
  const volId = (volume as { vol_id?: string } | null)?.vol_id

  const autoPageIndex = useMemo(() => {
    if (!Array.isArray(pages) || pages.length === 0) return 0

    const idx = pages.findIndex((p) => {
      const cstart = typeof p?.cstart === 'number' ? p.cstart : null
      const cend = typeof p?.cend === 'number' ? p.cend : null
      if (cstart == null || cend == null) return false
      return activeSegmentStart >= cstart && activeSegmentStart <= cend
    })

    return Math.max(0, idx)
  }, [pages, activeSegmentStart])

  const imageLink = volId?.trim()
    ? `https://library.bdrc.io/view/bdr:${volId}`
    : null

  const pageCount = pages?.length ?? 0

  const itemHeight = useDynamicRowHeight({
    defaultRowHeight: 50
  });
  const rowProps = useMemo<ImageListItemData | null>(() => {
    if (!pages || !Array.isArray(pages) || pages.length === 0) return null
    return {
      pages,
      volId: volId?.trim() ? volId : null,
      imageLink,
      activeIndex: autoPageIndex,
      pageCount: pages.length,
    }
  }, [pages, volId, imageLink, autoPageIndex])

  useEffect(() => {
    if (!isVisible) return
    if (pageCount === 0) return

    listRef.current?.scrollToRow({
      index: autoPageIndex,
      align: 'start',
      behavior: 'instant',
    })
  }, [isVisible, autoPageIndex, pageCount, listRef])

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-xs text-gray-600">
          Page image {activeSegmentId ? '(active segment)' : '(no segment selected)'}
        </div>
        <button
          type="button"
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          onClick={() => setIsVisible((v) => !v)}
        >
          {isVisible ? 'Hide image' : 'Show image'}
        </button>
      </div>

      {isVisible && (
        <div className="px-3 pb-3">
          {isLoading && <div className="text-xs text-gray-600">Loading volume…</div>}
          {!isLoading && error && (
            <div className="text-xs text-red-600">Failed to load volume: {error}</div>
          )}

          {!isLoading && !error && pageCount === 0 && (
            <div className="text-xs text-gray-600">No pages available.</div>
          )}

          {!isLoading && !error && pageCount > 0 && (
            <div
              className="h-[40vh] w-full overflow-hidden rounded border border-gray-200 bg-gray-50"
            >
              {rowProps && (
                <List
                  className="w-full"
                  style={{ height: '100%' }}
                  listRef={listRef}
                  rowCount={pageCount}
                  rowHeight={itemHeight}
                  rowComponent={ImageRow}
                  rowProps={rowProps}
                  overscanCount={3}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ImageWrapper
