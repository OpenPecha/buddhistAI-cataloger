import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const SegmentSearchBar = memo(function SegmentSearchBar({
  segmentId,
  query,
  onQueryChange,
  matchCount,
  onAfterScrollToMatch,
  disableMatchNavigation,
}: {
  segmentId: string;
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  /** Called after scrolling to a match (e.g. sync a mirrored textarea scroll in admin). */
  onAfterScrollToMatch?: () => void;
  /** When true, first/prev/next/last match controls are disabled (e.g. segment body collapsed). */
  disableMatchNavigation?: boolean;
}) {
  const { t } = useTranslation();
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const activeMatchIndexRef = useRef(0);
  useEffect(() => {
    activeMatchIndexRef.current = activeMatchIndex;
  }, [activeMatchIndex]);

  const scrollSegmentToTop = useCallback(() => {
    document.getElementById(segmentId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [segmentId]);

  const scrollSegmentToBottom = useCallback(() => {
    document.getElementById(segmentId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [segmentId]);

  const scrollToMatchIndex = useCallback(
    (index: number) => {
      const root = document.getElementById(segmentId);
      const hits = root?.querySelectorAll('.highlighter');
      const n = hits?.length ?? 0;
      if (n === 0) return;
      const safeIndex = Math.min(Math.max(0, index), n - 1);
      hits?.[safeIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onAfterScrollToMatch?.();
        });
      });
    },
    [segmentId, onAfterScrollToMatch]
  );

  useEffect(() => {
    activeMatchIndexRef.current = 0;
    setActiveMatchIndex(0);
  }, [query, matchCount]);

  const searched = query.trim().length > 0 && matchCount > 0;
  const navDisabled = Boolean(disableMatchNavigation) || matchCount === 0;

  const goToTop = () => {
    scrollSegmentToTop();
  };
  const goToBottom = () => {
    scrollSegmentToBottom();
  };



  

  return (
    <div className="segment-search-bar flex-1 flex flex-wrap items-center gap-1 rounded-md py-1">
      <Input
        className="h-8 min-w-0 flex-1 text-xs sm:max-w-[14rem]"
        placeholder={t('outliner.segment.searchPlaceholder')}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (navDisabled) return;
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        aria-label={t('outliner.segment.searchInSegment')}
      />
      {query.trim().length > 0 && (
        <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap px-0.5">
          {matchCount === 0 ? '0/0' : `${activeMatchIndex + 1}/${matchCount}`}
        </span>
      )}
    
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={goToTop}
        title={t('outliner.segment.scrollToTop')}
        aria-label={
           t('outliner.segment.scrollToTop') 
        }
      >
        <ArrowUpToLine className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={goToBottom}
        title={t('outliner.segment.scrollToBottom')}
        aria-label={
           t('outliner.segment.scrollToBottom') 
        }
      >
        <ArrowDownToLine className="h-4 w-4" />
      </Button>

    </div>
  );
});

SegmentSearchBar.displayName = 'SegmentSearchBar';
