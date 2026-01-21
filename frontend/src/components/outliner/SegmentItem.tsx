import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2, Check } from 'lucide-react';
import type { TextSegment, CursorPosition } from './types';
import { SegmentTextContent } from './SegmentTextContent';
import { useOutliner } from './OutlinerContext';

interface SegmentConfig {
  index: number;
  isActive: boolean;
  isFirstSegment: boolean;
  isAttached: boolean;
}

interface SegmentItemProps {
  segment: TextSegment;
  segmentConfig: SegmentConfig;
  cursorPosition: CursorPosition | null;
}

export const SegmentItem: React.FC<SegmentItemProps> = ({
  segment,
  segmentConfig,
  cursorPosition,
}) => {
  const {
    index,
    isActive,
    isFirstSegment,
    isAttached,
  } = segmentConfig;

  const {
    onSegmentClick,
    onCursorChange,
    onActivate,
    onInput,
    onKeyDown,
    onAttachParent,
    onMergeWithPrevious,
    segmentLoadingStates,
  } = useOutliner();
  
  const isLoading = segmentLoadingStates?.get(segment.id) ?? false;
  const isChecked = segment.status === 'checked';
  
  
  return (
    <div>
      {/* Attach Parent Button - only for first segment */}
      {isFirstSegment && (
          <Button
            type="button"
            variant={isAttached ? 'default' : 'outline'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAttachParent();
            }}
            className={`text-xs my-3 ${
              isAttached
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {isAttached ? '✓ Attached' : 'Attach Parent'}
          </Button>
          
      )}

      <div
        data-segment-id={segment.id}
        data-segment-container-id={segment.id}
        onClick={(e) => {
          // Only handle click if not clicking on text content or split menu or cancel button
          if (
            !(e.target as HTMLElement).closest('.segment-text-content') &&
            !(e.target as HTMLElement).closest('.split-menu') &&
            !(e.target as HTMLElement).closest('.cancel-split-button')
          ) {
            onSegmentClick(segment.id, e);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSegmentClick(segment.id);
          }
        }}
        role="button"
        tabIndex={0}
        className={`
          mb-4 p-4 rounded-lg border-2 cursor-pointer transition-all relative
          ${
            isActive
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
          }
        `}
      >
        {/* Loading Spinner - positioned on the right side */}
        {isLoading && (
          <div className="absolute top-4 right-4 z-10">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          </div>
        )}
        
        {/* Cancel Split Button - positioned at top-middle border */}
        {/* Only show if there's a previous segment to merge with */}
        {cursorPosition && cursorPosition.segmentId === segment.id && index > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMergeWithPrevious(segment.id);
            }}
            className="cancel-split-button cursor-pointer z-100 absolute -top-3 left-1/2 -translate-x-1/2  bg-white border-2 border-red-500 rounded-full p-1.5 shadow-lg hover:bg-red-50 transition-colors"
            title="Merge with previous segment"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        )}
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              isChecked 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {index + 1}
            </div>
          </div>
          <div className="flex-1 relative">
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
            {(segment.title ||
              segment.author ||
              segment.title_bdrc_id ||
              segment.author_bdrc_id) && (
              <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
                {segment.title && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-100 text-yellow-800 text-xs font-medium">
                    📄 {segment.title}
                    {segment.title_bdrc_id && (
                      <span className="ml-1 text-green-600">({segment.title_bdrc_id})</span>
                    )}
                  </span>
                )}
                {segment.author && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-800 text-xs font-medium">
                    👤 {segment.author}
                    {segment.author_bdrc_id && (
                      <span className="ml-1 text-green-600">({segment.author_bdrc_id})</span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
