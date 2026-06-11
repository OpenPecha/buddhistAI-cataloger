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
  /** When the body uses a nested scroll layer (e.g. reviewer highlight div behind a textarea), use this instead of `scrollIntoView` on `#segmentId` (which scrolls the wrong ancestor). */
  scrollBodyMatchIntoView,
  /** When set, top/bottom buttons scroll the inner body (textarea + highlight layer) instead of the segment card. */
  scrollBodyToEdge,
  bgColor,
  onBgColorChange,
}: {
  segmentId: string;
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  /** Called after scrolling to a match (e.g. sync a mirrored textarea scroll in admin). */
  onAfterScrollToMatch?: () => void;
  /** When true, first/prev/next/last match controls are disabled (e.g. segment body collapsed). */
  disableMatchNavigation?: boolean;
  scrollBodyMatchIntoView?: (matchIndex: number) => void;
  scrollBodyToEdge?: (edge: 'top' | 'bottom') => void;
  bgColor?: string;
  onBgColorChange?: (color: string) => void;
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
      if (scrollBodyMatchIntoView) {
        scrollBodyMatchIntoView(index);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            onAfterScrollToMatch?.();
          });
        });
        return;
      }
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
    [segmentId, onAfterScrollToMatch, scrollBodyMatchIntoView]
  );

  useEffect(() => {
    activeMatchIndexRef.current = 0;
    setActiveMatchIndex(0);
  }, [query, matchCount]);

  const navDisabled = Boolean(disableMatchNavigation) || matchCount === 0;

  const goToFirst = useCallback(() => {
    if (navDisabled || matchCount === 0) return;
    setActiveMatchIndex(0);
    scrollToMatchIndex(0);
  }, [navDisabled, matchCount, scrollToMatchIndex]);

  const goToPrev = useCallback(() => {
    if (navDisabled || matchCount === 0) return;
    const next = Math.max(0, activeMatchIndexRef.current - 1);
    setActiveMatchIndex(next);
    scrollToMatchIndex(next);
  }, [navDisabled, matchCount, scrollToMatchIndex]);

  const goToNext = useCallback(() => {
    if (navDisabled || matchCount === 0) return;
    const next = Math.min(matchCount - 1, activeMatchIndexRef.current + 1);
    setActiveMatchIndex(next);
    scrollToMatchIndex(next);
  }, [navDisabled, matchCount, scrollToMatchIndex]);

  const goToLast = useCallback(() => {
    if (navDisabled || matchCount === 0) return;
    const last = matchCount - 1;
    setActiveMatchIndex(last);
    scrollToMatchIndex(last);
  }, [navDisabled, matchCount, scrollToMatchIndex]);

  const goToTop = () => {
    if (scrollBodyToEdge) {
      scrollBodyToEdge('top');
    } else {
      scrollSegmentToTop();
    }
  };
  const goToBottom = () => {
    if (scrollBodyToEdge) {
      scrollBodyToEdge('bottom');
    } else {
      scrollSegmentToBottom();
    }
  };

  return (
    <div className="segment-search-bar flex flex-1 flex-col gap-2 rounded-md border bg-muted/20 p-1 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex w-full items-center gap-2 sm:min-w-56 sm:flex-1">
        <Input
          className="h-8 min-w-0 flex-1 bg-background text-xs"
          placeholder={t('outliner.segment.searchPlaceholder')}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (navDisabled) return;
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              e.stopPropagation();
              goToPrev();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              e.stopPropagation();
              goToNext();
            }
          }}
          aria-label={t('outliner.segment.searchInSegment')}
        />
        {query.trim().length > 0 && (
          <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
            {matchCount === 0 ? '0/0' : `${activeMatchIndex + 1}/${matchCount}`}
          </span>
        )}
        {onBgColorChange && (
          <input
            type="color"
            value={bgColor ?? '#ffffff'}
            onChange={(e) => onBgColorChange(e.target.value)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded-md border bg-background p-0.5"
            title={t('outliner.segment.textBgColor')}
            aria-label={t('outliner.segment.textBgColor')}
          />
        )}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
        <div className="flex items-center rounded-md border bg-background p-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={navDisabled}
          onClick={goToFirst}
          title={t('outliner.segment.firstMatch')}
          aria-label={t('outliner.segment.firstMatch')}
        >
          <ChevronFirst className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={navDisabled}
          onClick={goToPrev}
          title={t('outliner.segment.prevMatch')}
          aria-label={t('outliner.segment.prevMatch')}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={navDisabled}
          onClick={goToNext}
          title={t('outliner.segment.nextMatch')}
          aria-label={t('outliner.segment.nextMatch')}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={navDisabled}
          onClick={goToLast}
          title={t('outliner.segment.lastMatch')}
          aria-label={t('outliner.segment.lastMatch')}
        >
          <ChevronLast className="h-4 w-4" />
        </Button>
        </div>
        <div className="flex items-center rounded-md border bg-background p-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={goToTop}
          title={t('outliner.segment.scrollToTop')}
          aria-label={t('outliner.segment.scrollToTop')}
        >
          <ArrowUpToLine className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={goToBottom}
          title={t('outliner.segment.scrollToBottom')}
          aria-label={t('outliner.segment.scrollToBottom')}
        >
          <ArrowDownToLine className="h-4 w-4" />
        </Button>
        </div>
      </div>

    </div>
  );
});

SegmentSearchBar.displayName = 'SegmentSearchBar';
