import { useState, useEffect, useRef, useCallback } from 'react';
import { useBdrcSearch } from '@/hooks/useBdrcSearch';
import type { TextSegment } from '@/components/outliner';

interface UseSegmentAnnotationsOptions {
  activeSegment: TextSegment | undefined;
  activeSegmentId: string | null;
  onUpdate: (segmentId: string, field: 'title' | 'author' | 'title_bdrc_id' | 'author_bdrc_id', value: string) => Promise<void>;
}

/**
 * Hook to manage segment annotations (title/author) with BDRC search
 */
export const useSegmentAnnotations = ({
  activeSegment,
  activeSegmentId,
  onUpdate,
}: UseSegmentAnnotationsOptions) => {
  // Title state
  const [titleSearch, setTitleSearch] = useState('');
  const [titleSearchQuery, setTitleSearchQuery] = useState('');
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const isSelectingTitle = useRef(false);

  // Author state
  const [authorSearch, setAuthorSearch] = useState('');
  const [authorSearchQuery, setAuthorSearchQuery] = useState('');
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const authorInputRef = useRef<HTMLInputElement | null>(null);
  const isSelectingAuthor = useRef(false);

  // BDRC search hooks
  const { results: titleResults, isLoading: titleLoading } = useBdrcSearch(
    titleSearchQuery,
    'Instance',
    1000,
    () => {
      titleInputRef.current?.focus();
    }
  );

  const { results: authorResults, isLoading: authorLoading } = useBdrcSearch(
    authorSearchQuery,
    'Person',
    1000,
    () => {
      authorInputRef.current?.focus();
    }
  );

  // Sync with active segment
  useEffect(() => {
    if (activeSegment) {
      setTitleSearch(activeSegment.title || '');
      setAuthorSearch(activeSegment.author || '');
      setTitleSearchQuery(activeSegment.title || '');
      setAuthorSearchQuery(activeSegment.author || '');
    } else {
      setTitleSearch('');
      setAuthorSearch('');
      setTitleSearchQuery('');
      setAuthorSearchQuery('');
    }
  }, [activeSegmentId]);

  // Focus effects
  useEffect(() => {
    if (
      !titleLoading &&
      titleSearch.trim().length > 0 &&
      titleResults.length > 0 &&
      showTitleDropdown
    ) {
      titleInputRef.current?.focus();
    }
  }, [titleLoading, titleResults.length, titleSearch, showTitleDropdown]);

  useEffect(() => {
    if (
      !authorLoading &&
      authorSearch.trim().length > 0 &&
      authorResults.length > 0 &&
      showAuthorDropdown
    ) {
      authorInputRef.current?.focus();
    }
  }, [authorLoading, authorResults.length, authorSearch, showAuthorDropdown]);

  // Handlers
  const handleTitleChange = useCallback(
    (value: string) => {
      setTitleSearch(value);
      if (!isSelectingTitle.current) {
        setTitleSearchQuery(value);
      }
      setShowTitleDropdown(value.length > 0);
      if (activeSegmentId) {
        onUpdate(activeSegmentId, 'title', value);
        if (!value && activeSegment?.title_bdrc_id) {
          onUpdate(activeSegmentId, 'title_bdrc_id', '');
        }
      }
    },
    [activeSegmentId, activeSegment, onUpdate]
  );

  const handleAuthorChange = useCallback(
    (value: string) => {
      setAuthorSearch(value);
      if (!isSelectingAuthor.current) {
        setAuthorSearchQuery(value);
      }
      setShowAuthorDropdown(value.length > 0);
      if (activeSegmentId) {
        onUpdate(activeSegmentId, 'author', value);
        if (!value && activeSegment?.author_bdrc_id) {
          onUpdate(activeSegmentId, 'author_bdrc_id', '');
        }
      }
    },
    [activeSegmentId, activeSegment, onUpdate]
  );

  const handleTitleSelect = useCallback(
    (title: { workId?: string; instanceId?: string; title?: string }) => {
      if (!activeSegmentId || !title.workId) return;
      isSelectingTitle.current = true;
      onUpdate(activeSegmentId, 'title_bdrc_id', title.workId);
      setShowTitleDropdown(false);
      setTimeout(() => {
        isSelectingTitle.current = false;
      }, 100);
    },
    [activeSegmentId, onUpdate]
  );

  const handleAuthorSelect = useCallback(
    (author: { bdrc_id?: string; name?: string }) => {
      if (!activeSegmentId || !author.bdrc_id) return;
      isSelectingAuthor.current = true;
      onUpdate(activeSegmentId, 'author_bdrc_id', author.bdrc_id);
      setShowAuthorDropdown(false);
      setTimeout(() => {
        isSelectingAuthor.current = false;
      }, 100);
    },
    [activeSegmentId, onUpdate]
  );

  const handleTitleBdrcIdClear = useCallback(() => {
    if (activeSegmentId) {
      onUpdate(activeSegmentId, 'title_bdrc_id', '');
    }
  }, [activeSegmentId, onUpdate]);

  const handleAuthorBdrcIdClear = useCallback(() => {
    if (activeSegmentId) {
      onUpdate(activeSegmentId, 'author_bdrc_id', '');
    }
  }, [activeSegmentId, onUpdate]);

  return {
    // Title
    titleSearch,
    titleResults,
    titleLoading,
    showTitleDropdown,
    titleInputRef,
    onTitleChange: handleTitleChange,
    onTitleFocus: () => setShowTitleDropdown(titleSearch.length > 0),
    onTitleSelect: handleTitleSelect,
    onTitleBdrcIdClear: handleTitleBdrcIdClear,

    // Author
    authorSearch,
    authorResults,
    authorLoading,
    showAuthorDropdown,
    authorInputRef,
    onAuthorChange: handleAuthorChange,
    onAuthorFocus: () => setShowAuthorDropdown(authorSearch.length > 0),
    onAuthorSelect: handleAuthorSelect,
    onAuthorBdrcIdClear: handleAuthorBdrcIdClear,
  };
};
