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
  }, [activeSegmentId, activeSegment]);

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
      // Don't update database automatically - only update local state
      // Database update will happen when save button is clicked
    },
    []
  );

  const handleAuthorChange = useCallback(
    (value: string) => {
      setAuthorSearch(value);
      if (!isSelectingAuthor.current) {
        setAuthorSearchQuery(value);
      }
      setShowAuthorDropdown(value.length > 0);
      // Don't update database automatically - only update local state
      // Database update will happen when save button is clicked
    },
    []
  );

  const handleTitleSelect = useCallback(
    (title: { workId?: string; instanceId?: string; title?: string }) => {
      if (!activeSegmentId || !title.workId) return;
      isSelectingTitle.current = true;
      // Update bdrc_id optimistically - this triggers database update
      onUpdate(activeSegmentId, 'title_bdrc_id', title.workId);
      // Optionally update title text if provided, but don't trigger separate update
      if (title.title) {
        setTitleSearch(title.title);
        setTitleSearchQuery(title.title);
      }
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
      // Update bdrc_id optimistically - this triggers database update
      onUpdate(activeSegmentId, 'author_bdrc_id', author.bdrc_id);
      // Optionally update author text if provided, but don't trigger separate update
      if (author.name) {
        setAuthorSearch(author.name);
        setAuthorSearchQuery(author.name);
      }
      setShowAuthorDropdown(false);
      setTimeout(() => {
        isSelectingAuthor.current = false;
      }, 100);
    },
    [activeSegmentId, onUpdate]
  );

  const handleTitleBdrcIdClear = useCallback(() => {
    if (activeSegmentId) {
      // Clear BDRC ID immediately (this is a metadata change)
      onUpdate(activeSegmentId, 'title_bdrc_id', '');
      // Clear title text locally (will be saved when save button is clicked)
      setTitleSearch('');
      setTitleSearchQuery('');
    }
  }, [activeSegmentId, onUpdate]);

  const handleAuthorBdrcIdClear = useCallback(() => {
    if (activeSegmentId) {
      // Clear BDRC ID immediately (this is a metadata change)
      onUpdate(activeSegmentId, 'author_bdrc_id', '');
      // Clear author text locally (will be saved when save button is clicked)
      setAuthorSearch('');
      setAuthorSearchQuery('');
    }
  }, [activeSegmentId, onUpdate]);

  // Method to set field value without triggering database update (for bubble menu)
  const setTitleValueWithoutUpdate = useCallback((value: string) => {
    setTitleSearch(value);
    setTitleSearchQuery(value);
    setShowTitleDropdown(value.length > 0);
  }, []);

  const setAuthorValueWithoutUpdate = useCallback((value: string) => {
    setAuthorSearch(value);
    setAuthorSearchQuery(value);
    setShowAuthorDropdown(value.length > 0);
  }, []);

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
    setTitleValueWithoutUpdate,

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
    setAuthorValueWithoutUpdate,
  };
};
