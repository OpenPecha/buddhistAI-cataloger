import React, { memo } from 'react';
import { SEGMENT_CHAR_LIMIT } from '@/utils/contentValidation';
import { useTranslation } from 'react-i18next';

interface SegmentValidation {
  index: number;
  length: number;
}

interface FormattedTextDisplayProps {
  content?: string;
  lines?: string[];
  invalidSegments?: SegmentValidation[];
  invalidCount?: number;
  onInvalidSegmentClick?: (segmentIndex: number) => void;
}

/**
 * Reusable component to display text content with line breaks
 * Accepts either:
 * - content: raw string that will be processed (removes empty lines)
 * - lines: pre-processed array of lines
 * - invalidSegments: Array of segment indices that exceed character limit
 * - invalidCount: Total count of invalid segments
 */
const FormattedTextDisplay: React.FC<FormattedTextDisplayProps> = ({ 
  content, 
  lines, 
  invalidSegments = [],
  invalidCount = 0,
  onInvalidSegmentClick
}) => {
  const { t } = useTranslation();
  
  // Process content to split into lines (same logic as annotation calculator)
  const getFormattedLines = () => {
    // If lines are provided directly, use them
    if (lines && lines.length > 0) {
      return lines;
    }
    
    if (!content) return [];
    
    // Split by newlines
    const contentLines = content.split('\n');
    
    // Remove trailing empty lines
    while (contentLines.length > 0 && contentLines.at(-1)?.trim() === '') {
      contentLines.pop();
    }
    
    // Filter out empty lines (length === 0)
    const filteredLines = contentLines.filter(line => line.length > 0);
    
    return filteredLines;
  };
  
  const contentLines = getFormattedLines();
  
  // Create a Set for quick lookup of invalid segment indices
  const invalidSegmentSet = new Set(invalidSegments.map(seg => seg.index));
  if (contentLines.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>No content to display</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Summary of invalid segments */}
      {invalidCount > 0 && (
        <div className="sticky top-0 z-10 bg-red-50 border-b-2 border-red-300 px-4 py-3 mb-2">
          <p className="text-sm font-medium text-red-800">
            {t('editor.segmentLimitExceeded', { count: invalidCount, limit: SEGMENT_CHAR_LIMIT })}
          </p>
        </div>
      )}
      
      {contentLines.map((line, index) => {
        const isInvalid = invalidSegmentSet.has(index);
        const invalidSegment = invalidSegments.find(seg => seg.index === index);
        
        const handleClick = () => {
          if (isInvalid && onInvalidSegmentClick) {
            onInvalidSegmentClick(index);
          }
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (isInvalid && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleClick();
          }
        };

        return (
          <div 
            key={`line-${index}`}
            data-segment-index={index}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={isInvalid ? 0 : undefined}
            role={isInvalid ? 'button' : undefined}
            className={`py-3 px-4 border-b last:border-0 text-base leading-relaxed transition-all ${
              isInvalid 
                ? 'bg-red-50 border-red-300 border-l-4 border-l-red-500 cursor-pointer hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2' 
                : 'border-gray-200 text-gray-900'
            }`}
          >
            {line || <span className="text-gray-400 italic">(empty line)</span>}
            {isInvalid && invalidSegment && (
              <div className="mt-2 text-sm text-red-700 font-medium">
                {t('editor.segmentExceedsLimit', { 
                  length: invalidSegment.length-SEGMENT_CHAR_LIMIT
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default memo(FormattedTextDisplay);

