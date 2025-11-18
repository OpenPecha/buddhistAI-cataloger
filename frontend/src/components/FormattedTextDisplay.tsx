import React, { memo, useEffect, useState, useRef } from 'react';
import { SEGMENT_CHAR_LIMIT } from '@/utils/contentValidation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

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
  const [currentErrorIndex, setCurrentErrorIndex] = useState<number>(0);
  const errorRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  
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
  
  // Get sorted array of invalid segment indices for navigation
  const invalidIndices = invalidSegments.map(seg => seg.index).sort((a, b) => a - b);
  
  // Reset current error index when invalid segments change
  useEffect(() => {
    if (invalidIndices.length > 0 && currentErrorIndex >= invalidIndices.length) {
      setCurrentErrorIndex(0);
    }
  }, [invalidIndices.length, currentErrorIndex]);
  
  // Scroll to error function
  const scrollToError = (index: number) => {
    const errorIndex = invalidIndices[index];
    const errorElement = errorRefs.current[errorIndex];
    
    if (errorElement && containerRef.current) {
      const container = containerRef.current;
      const elementTop = errorElement.offsetTop;
      const elementHeight = errorElement.offsetHeight;
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      
      // Calculate scroll position to center the error element
      const scrollTo = elementTop - containerTop - (containerHeight / 2) + (elementHeight / 2);
      
      container.scrollTo({
        top: container.scrollTop + scrollTo,
        behavior: 'smooth'
      });
      
      // Highlight the error briefly
      errorElement.classList.add('ring-2', 'ring-red-500');
      setTimeout(() => {
        errorElement.classList.remove('ring-2', 'ring-red-500');
      }, 1000);
    }
  };
  
  // Navigate to next error
  const handleNextError = () => {
    if (invalidIndices.length === 0) return;
    const nextIndex = (currentErrorIndex + 1) % invalidIndices.length;
    setCurrentErrorIndex(nextIndex);
    scrollToError(nextIndex);
  };
  
  // Navigate to previous error
  const handlePreviousError = () => {
    if (invalidIndices.length === 0) return;
    const prevIndex = (currentErrorIndex - 1 + invalidIndices.length) % invalidIndices.length;
    setCurrentErrorIndex(prevIndex);
    scrollToError(prevIndex);
  };
  if (contentLines.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>No content to display</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-[80dvh] overflow-y-auto">
      {/* Summary of invalid segments */}
      {invalidCount > 0 && (
        <div className="sticky top-0 z-10 bg-red-50 border-b-2 border-red-300 px-4 py-3 mb-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-red-800">
              {t('editor.segmentLimitExceeded', { count: invalidCount, limit: SEGMENT_CHAR_LIMIT })}
            </p>
            {invalidIndices.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousError}
                  disabled={invalidIndices.length === 0}
                  className="h-7 px-3 text-xs"
                >
                  {t('common.previous')}
                </Button>
                <span className="text-xs text-red-700 font-medium">
                  {currentErrorIndex + 1} / {invalidIndices.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextError}
                  disabled={invalidIndices.length === 0}
                  className="h-7 px-3 text-xs"
                >
                  {t('common.next')}
                </Button>
              </div>
            )}
          </div>
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
            ref={(el) => {
              if (isInvalid) {
                errorRefs.current[index] = el;
              }
            }}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={isInvalid ? 0 : undefined}
            role={isInvalid ? 'button' : undefined}
            className={`py-3 px-4 border-b font-['noto'] last:border-0 text-base leading-relaxed transition-all ${
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

