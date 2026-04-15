import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {  Merge, AlertCircle, Loader2 } from 'lucide-react'
import type { TextSegment, SegmentLabel } from './types'
import { SegmentTextContent } from './SegmentTextContent'
import { useDocument,useCursor, useActions } from './contexts'
import { SplitMenu } from './SplitMenu'
import { BubbleMenu } from './BubbleMenu'
import { SEGMENT_LABEL_VALUES, segmentLabelI18nKey } from './segment-label'
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ChevronUporDown from './utils/ChevronUporDown'

/** Hoisted: avoid recreating array each render (see js-hoist-regexp / stable references). */
const BONPO_TITLE_PATTERNS = ['་པོབམ', 'ལེའུ', 'བམཔོ', 'བམ་པོ་', 'ལེའུ་', 'བམ པོ'] as const

function rejectionReviewerInitials(name?: string | null): string {
  const n = name?.trim()
  if (!n) return '?'
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0][0]
    const b = parts.at(-1)?.[0]
    if (a && b) return (a + b).toUpperCase()
  }
  return n.slice(0, 2).toUpperCase()
}

interface SegmentItemProps {
  segment: TextSegment
  index: number
}

const SegmentItem: React.FC<SegmentItemProps> = ({
  segment,
  index,
}) => {
  const { t } = useTranslation()

  // Use new contexts
  const { activeSegmentId, segments, segmentLoadingStates, activeSegmentSearchQuery } = useDocument()
  const isSegmentSyncing = segmentLoadingStates.get(segment.id) === true
  const { onCursorChange } = useCursor()
  const {
    onSegmentClick,
    onActivate,
    onInput,
    onKeyDown,
    onAttachParent,
    onMergeWithPrevious,
    expandedSegmentIds,
    toggleSegmentExpanded,
  } = useActions()

  const isChecked = segment.status === 'checked' || segment.status === 'approved'
  const isRejected = segment.status === 'rejected'
  const rejectionReviewerPicture =
    segment.rejection?.reviewer?.picture?.trim() || ''
  const isFirstSegment = index === 0
  const isAttached = isFirstSegment && (segment.is_attached ?? false)
  const isActive = segment.id === activeSegmentId


  const segmentSearchQuery =
    segment.id === activeSegmentId ? activeSegmentSearchQuery : ''

  const isExpanded =
    segments.length === 1 || expandedSegmentIds.includes(segment.id)
  const isCollapsed = !isExpanded
  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleSegmentExpanded(segment.id)
  }
  
  

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
            {isAttached ? t('outliner.segment.attached') : t('outliner.segment.attachParent')}
          </Button>
        </div>
      )}
      
      <div
      id={segment.id}
        data-segment-id={segment.id}
        data-segment-container-id={segment.id}
        onClick={(e) => {
           if (isSegmentSyncing) return
          // Only handle click if not clicking on text content or menus or buttons
          if (
            !(e.target as HTMLElement).closest('.segment-text-content') &&
            !(e.target as HTMLElement).closest('.split-menu') &&
            !(e.target as HTMLElement).closest('.bubble-menu') &&
            !(e.target as HTMLElement).closest('.cancel-split-button') &&
            !(e.target as HTMLElement).closest('.collapse-button') &&
            !(e.target as HTMLElement).closest('.segment-search-bar')
          ) {
            onSegmentClick(segment.id, e)
            if (!isExpanded) toggleSegmentExpanded(segment.id)
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
          isRejected
            ? 'border-red-400 bg-red-50'
            : isActive
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
        }`}
      >
         {isSegmentSyncing && (
          <div
            className="absolute top-0 left-0 z-50 w-full h-full bg-white/50 backdrop-blur-sm flex items-center justify-center"
            aria-live="polite"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
            {t('outliner.segment.syncingFromServer')}
          </div>
        )}
    <div className="segment-label-bar flex flex-wrap items-center gap-2 mb-3 pb-2 border-b border-gray-200">
       <SegmentLabelSelector
          segment={segment}
        />
        </div>

        {isRejected && segment.rejection?.reason?.trim() ? (
          <div
            className="mb-3 flex gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
            onClick={(e) => e.stopPropagation()}
          >
            {segment.rejection?.reviewer || rejectionReviewerPicture ? (
              <div
                className="shrink-0 pt-0.5"
                title={
                  segment.rejection?.reviewer?.name?.trim() ||
                  t('outliner.segment.reviewerRejectionNote')
                }
              >
                {rejectionReviewerPicture ? (
                  <img
                    src={rejectionReviewerPicture}
                    title={segment.rejection?.reviewer?.name?.trim()}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-red-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-red-200 text-xs font-semibold uppercase text-red-900 ring-2 ring-red-200"
                    aria-hidden
                  >
                    {rejectionReviewerInitials(segment.rejection?.reviewer?.name)}
                  </div>
                )}
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-red-800 animate-pulse">
                {t('outliner.segment.reviewerRejectionNote')}
              </span>
              <p className="mt-1 whitespace-pre-wrap font-medium">{segment.rejection.reason}</p>
            </div>
          </div>
        ) : null}
      
        {activeSegmentId === segment.id && index > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMergeWithPrevious(segment.id)
            }}
            className="cancel-split-button cursor-pointer z-100 absolute -top-3 left-1/2 -translate-x-1/2  bg-white border-2 border-red-500 rounded-full p-1.5 shadow-lg hover:bg-red-50 transition-colors"
            title={t('outliner.segment.mergePrevious')}
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
              aria-label={isCollapsed ? t('outliner.segment.expandSegment') : t('outliner.segment.collapseSegment')}
            >
            
              <ChevronUporDown isExpanded={!isCollapsed} />
            </button>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              isRejected
                ? 'bg-red-500 text-white'
                : isChecked 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
            }`}>
              {index + 1}
            </div>
            {isRejected && (
              <span
                className="text-[10px] font-semibold text-red-600"
                title={
                  (segment.rejection?.count ?? 0) > 1
                    ? t('outliner.segment.rejectedMany', { count: segment.rejection?.count ?? 0 })
                    : t('outliner.segment.rejected')
                }
              >
                {(segment.rejection?.count ?? 0) > 1
                  ? `${t('outliner.segment.rejected')} (${segment.rejection?.count ?? 0}x)`
                  : t('outliner.segment.rejected')}
              </span>
            )}
          </div>
          <div className={`flex-1 relative ${isChecked && !isRejected ? 'pointer-events-none' : ''}`}>
          <div className='absolute right-2'>

          <AlertMessage
          segment={segment}
          />
          </div>
            {isCollapsed ? (
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
                aria-label={t('outliner.segment.expandSegment')}
              >
                {segment.text.slice(0,200) +"..."}
              </button>
              
            ) : (
                <SegmentTextContent
                  segmentId={segment.id}
                  text={segment.text}
                  title={segment.title}
                  author={segment.author}
                  segmentSearchQuery={segmentSearchQuery}
                  onCursorChange={(segmentId, element) => onCursorChange(segmentId, element)}
                  onActivate={() => onActivate(segment.id)}
                  onInput={onInput}
                  onKeyDown={onKeyDown}
                />
               
            )}
            {segment.label === 'TEXT' && (
              <TitleAndAuthor
                title={segment.title}
                author={segment.author}
                title_bdrc_id={segment.title_bdrc_id}
                author_bdrc_id={segment.author_bdrc_id}
              />
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


const SegmentLabelSelector = ({
  segment,
}: {
  segment: TextSegment
}) => {
  const { t } = useTranslation()
  const { documentId, updateSegment: updateSegmentMutation } = useOutlinerDocument()

  const handleLabelChange = useCallback(
    async (value: string) => {
      if (!segment.id || !documentId) return
      const label = value === 'none' || value === '' ? undefined : (value as SegmentLabel)
      updateSegmentMutation(segment.id, { label }).catch((err) => {
        console.error('Failed to update segment label:', err)
        toast.error(err instanceof Error ? err.message : t('outliner.segment.failedUpdateLabel'))
      })
    },
    [documentId, segment.id, updateSegmentMutation, t]
  )
  return (
  <>
    <span className="text-xs font-medium text-gray-500 shrink-0">{t('outliner.segment.labelField')}</span>
    <Select
    value={segment.label ?? 'none'}
    onValueChange={handleLabelChange}
      disabled={!documentId  || segment.status==='checked'}
    >
      <SelectTrigger className="h-8 text-xs flex-1 max-w-[180px]" id={`segment-label-${segment.id}`}>
        <SelectValue placeholder={t('outliner.segment.noLabelPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
    
        {SEGMENT_LABEL_VALUES.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {t(segmentLabelI18nKey(opt))}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
   
  </>
  )
}

const AlertMessage = ({ segment }: { segment: TextSegment }) => {
  const { t } = useTranslation()
  const { activeSegmentId, sidebarTitleDraft } = useDocument()

  const textMatchesPattern = (text: string | undefined) =>
    Boolean(text && BONPO_TITLE_PATTERNS.some((pattern) => text.includes(pattern)))

  const savedTitle = segment.title ?? ''
  const draftTitle =
    segment.id === activeSegmentId ? (sidebarTitleDraft ?? '') : ''

  const showAlertMessage =
    textMatchesPattern(savedTitle) || textMatchesPattern(draftTitle)
  const hasAnyTitle = Boolean(savedTitle.trim() || draftTitle.trim())
  if (!hasAnyTitle || !showAlertMessage || segment.label !== 'TEXT') return null
  return (
    <div className="alert-message flex items-center gap-2"> 
      <AlertCircle className="h-4 w-4 animate-bounce text-red-500" />
      <span className=" text-xs font-medium text-gray-500">
         {t('outliner.segment.subsegmentWarning')}
      </span>
    </div>
  )
}

