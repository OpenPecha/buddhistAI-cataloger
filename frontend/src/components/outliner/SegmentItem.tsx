import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronDown, ChevronRight, Merge } from 'lucide-react'
import type { TextSegment } from './types'
import { SegmentTextContent } from './SegmentTextContent'
import { useDocument, useSelection, useCursor, useActions } from './contexts'
import { SplitMenu } from './SplitMenu'
import { BubbleMenu } from './BubbleMenu'
import Emitter from '@/events'



interface SegmentItemProps {
  segment: TextSegment
  index: number
}

const SegmentItem: React.FC<SegmentItemProps> = ({
  segment,
  index,
}) => {


  // Use new contexts
  const { activeSegmentId, segmentLoadingStates } = useDocument()
  const { cursorPosition, onCursorChange } = useCursor()
  const {
    onSegmentClick,
    onActivate,
    onInput,
    onKeyDown,
    onAttachParent,
    onMergeWithPrevious,
    onSplitSegment,
  } = useActions()
  
  const isLoading = segmentLoadingStates?.get(segment.id) ?? false
  const isChecked = segment.status === 'checked'
  const isFirstSegment = index === 0
  const isAttached = isFirstSegment && (segment.is_attached ?? false)
  const isActive = segment.id === activeSegmentId

  const [isCollapsed, setIsCollapsed] = useState(segment.id !== activeSegmentId)
  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsCollapsed(!isCollapsed)
  }

  useEffect(() => {
    const handleSegmentsExpand = (expand: boolean) => {
      if (segment.id !== activeSegmentId) {
        setIsCollapsed(expand)
      }
    }

    Emitter.on('segments:expand', handleSegmentsExpand)
    return () => {
      Emitter.off('segments:expand', handleSegmentsExpand)
    }
  }, [segment.id, activeSegmentId])
  
  
  

  return (
    <div className="relative">
      {/* Attach Parent Button and Collapse All Button - only for first segment */}
      {isFirstSegment && (
        <div className="flex items-center justify-between gap-2 my-3">
          <Button
            type="button"
            variant={isAttached ? 'default' : 'outline'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onAttachParent()
            }}
            className={`text-xs ${
              isAttached
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {isAttached ? '✓ Attached' : 'Attach Parent'}
          </Button>
        </div>
      )}

      <div
      id={segment.id}
        data-segment-id={segment.id}
        data-segment-container-id={segment.id}
        onClick={(e) => {
          // Only handle click if not clicking on text content or menus or buttons
          if (
            !(e.target as HTMLElement).closest('.segment-text-content') &&
            !(e.target as HTMLElement).closest('.split-menu') &&
            !(e.target as HTMLElement).closest('.bubble-menu') &&
            !(e.target as HTMLElement).closest('.cancel-split-button') &&
            !(e.target as HTMLElement).closest('.collapse-button')
          ) {
            onSegmentClick(segment.id, e)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSegmentClick(segment.id)
          }
        }}
        role="button"
        tabIndex={0}
        className={`mb-4 p-4 rounded-lg border-2 cursor-pointer transition-all relative ${
          isChecked ? 'opacity-50' : 'opacity-100'
        } ${
          isActive
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
        }`}
      >
        {/* Loading Spinner - positioned on the right side */}
        {isLoading && (
          <div className="absolute top-4 right-4 z-10">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          </div>
        )}
        
        
      
        {activeSegmentId === segment.id && index > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMergeWithPrevious(segment.id)
            }}
            className="cancel-split-button cursor-pointer z-100 absolute -top-3 left-1/2 -translate-x-1/2  bg-white border-2 border-red-500 rounded-full p-1.5 shadow-lg hover:bg-red-50 transition-colors"
            title="Merge with previous segment"
          >
            <Merge className="w-4 h-4 text-red-600" />
          </button>
        )}
        <div className="flex items-start gap-3">
          <div className="shrink-0 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={toggleCollapse}
              className="p-1 hover:bg-gray-200 rounded transition-colors collapse-button"
              aria-label={isCollapsed ? 'Expand segment' : 'Collapse segment'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              )}
            </button>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              isChecked 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {index + 1}
            </div>
          </div>
          <div className={`flex-1 relative ${isChecked ? 'pointer-events-none' : ''}`}>
            {isCollapsed ? (
              <>
              <button
                type="button"
                className="text-gray-600  font-monlam cursor-pointer text-lg py-2 text-left w-full rounded px-2 -mx-2 transition-colors max-h-[100px] overflow-hidden whitespace-pre-wrap break-words [display:-webkit-box] [WebkitBoxOrient:vertical] [WebkitLineClamp:4]"
                onClick={(e) => {
                  e.stopPropagation()
                  onActivate(segment.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onActivate(segment.id)
                  }
                }}
                tabIndex={0}
                aria-label="Expand segment"
              >
                {segment.text.slice(0,200) +"..."}
              </button>
                <TitleAndAuthor
                title={segment.title}
                author={segment.author}
                title_bdrc_id={segment.title_bdrc_id}
                author_bdrc_id={segment.author_bdrc_id}
              />
              </>
            ) : (
              <>
                <SegmentTextContent
                  segmentId={segment.id}
                  text={segment.text}
                  title={segment.title}
                  author={segment.author}
                  onCursorChange={(segmentId, element) => onCursorChange(segmentId, element)}
                  onActivate={() => onActivate(segment.id)}
                  onInput={onInput}
                  onKeyDown={onKeyDown}
                />
                <TitleAndAuthor
                  title={segment.title}
                  author={segment.author}
                  title_bdrc_id={segment.title_bdrc_id}
                  author_bdrc_id={segment.author_bdrc_id}
                />
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Split Menu - positioned relative to segment container */}
        <SplitMenu
          segmentId={segment.id}
        />

      {/* Bubble Menu - positioned relative to segment container */}
        <BubbleMenu
          segmentId={segment.id}
          
        />
    </div>
  )
}

export const SegmentItemMemo = React.memo(SegmentItem)


type TitleAndAuthorProps = {
  title?: string
  author?: string
  title_bdrc_id?: string
  author_bdrc_id?: string
}

const TitleAndAuthor = ({
  title,
  author,
  title_bdrc_id,
  author_bdrc_id,
}: TitleAndAuthorProps) => {
  if (!title && !author && !title_bdrc_id && !author_bdrc_id) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
      {title && (
        <span className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-100 text-yellow-800 text-xs font-medium">
          📄 {title}
          {title_bdrc_id && (
            <span className="ml-1 text-green-600">({title_bdrc_id})</span>
          )}
        </span>
      )}
      {author && (
        <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-800 text-xs font-medium">
          👤 {author}
          {author_bdrc_id && (
            <span className="ml-1 text-green-600">({author_bdrc_id})</span>
          )}
        </span>
      )}
    </div>
  )
}


