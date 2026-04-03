import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateTitleAuthor, type GenerateTitleAuthorResponse } from '@/api/outliner';
import { toast } from 'sonner';
import type { AISuggestions, TextSegment } from '@/features/outliner/types';
import { findPhraseDocSpan, type PhraseDocSpan } from '@/utils/findPhraseDocSpan';

export interface PersistAIAnnotationsArgs {
  titleValue: string;
  authorValue: string;
  titleSpan: PhraseDocSpan | null;
  authorSpan: PhraseDocSpan | null;
}

interface UseAISuggestionsOptions {
  activeSegment: TextSegment | undefined;
  activeSegmentId: string | null;
  documentId?: string;
  onUpdate: (segmentId: string, field: 'title' | 'author' | 'title_bdrc_id' | 'author_bdrc_id', value: string) => Promise<void>;
  onTitleChange: (value: string) => void;
  onAuthorChange: (value: string) => void;
  onShowTitleDropdown: (show: boolean) => void;
  onShowAuthorDropdown: (show: boolean) => void;
  /** Persist title/author + document spans to the API when AI returns (optional). */
  persistAIAnnotations?: (args: PersistAIAnnotationsArgs) => Promise<void>;
}

/**
 * Hook to manage AI suggestions for title and author detection using React Query
 */
export const useAISuggestions = ({
  activeSegment,
  activeSegmentId,
  documentId,
  onUpdate,
  onTitleChange,
  onAuthorChange,
  onShowTitleDropdown,
  onShowAuthorDropdown,
  persistAIAnnotations,
}: UseAISuggestionsOptions) => {
  const queryClient = useQueryClient();
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null);
  /** Segment IDs we have already started AI detect for (auto runs once per segment until cleared). */
  const attemptedAutoDetectRef = useRef<Set<string>>(new Set());
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const persistAIAnnotationsRef = useRef(persistAIAnnotations);
  persistAIAnnotationsRef.current = persistAIAnnotations;

  const handleAIDetectRef = useRef<() => Promise<void>>(async () => {});

  type AIMutationVars = {
    content: string;
    signal?: AbortSignal;
    segment: TextSegment;
    segmentId: string;
    documentId: string | undefined;
  };

  // Mutation for AI title/author generation
  const mutation = useMutation({
    mutationFn: ({ content, signal }: AIMutationVars) =>
      generateTitleAuthor({ content }, signal),
    onMutate: (variables: AIMutationVars) => {
      attemptedAutoDetectRef.current.add(variables.segmentId);
    },
    onSuccess: async (data: GenerateTitleAuthorResponse, variables: AIMutationVars) => {
      setAiSuggestions(data as AISuggestions);

      const { segment, segmentId, documentId: docId } = variables;
      const persistFn = persistAIAnnotationsRef.current;

      if (!segmentId || !segment.text) {
        if (docId && !persistFn) {
          queryClient.invalidateQueries({ queryKey: ['outliner-document', docId] });
        }
        return;
      }

      const segmentText = segment.text;
      const segStart = segment.span_start ?? 0;

      // Resolved strings we store (extracted preferred, else suggested).
      const titleValue =
        data.title?.trim() || data.suggested_title?.trim() || '';
      const authorValue =
        data.author?.trim() || data.suggested_author?.trim() || '';

      // Document-level spans: search each saved string inside the segment text, then offset by span_start.
      const titleSpan = titleValue
        ? findPhraseDocSpan(segmentText, segStart, titleValue)
        : null;
      const authorSpan = authorValue
        ? findPhraseDocSpan(segmentText, segStart, authorValue)
        : null;

      if (persistFn && (titleValue || authorValue)) {
        try {
          await persistFn({
            titleValue,
            authorValue,
            titleSpan,
            authorSpan,
          });
        } catch {
          return;
        }
      }

      if (titleValue) {
        onTitleChange(titleValue);
      }
      if (authorValue) {
        onAuthorChange(authorValue);
      }

      if (docId && !persistFn) {
        queryClient.invalidateQueries({ queryKey: ['outliner-document', docId] });
      }
    },
    onError: (error: Error) => {
      if (error.name !== 'AbortError') {
        toast.error(`Failed to generate AI suggestions: ${error.message}`);
      }
    },
  });

  // Clear AI suggestions when active segment changes
  useEffect(() => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    mutation.reset();
    setAiSuggestions(null);
  }, [activeSegmentId]);

  useEffect(() => {
    attemptedAutoDetectRef.current.clear();
  }, [documentId]);

  /** Allow auto-detect again after reset (or server) clears both fields on the same segment. */
  const prevSegmentSnapshotRef = useRef<{
    id: string;
    title: string;
    author: string;
  } | null>(null);
  useEffect(() => {
    if (!activeSegment) return;
    const id = activeSegment.id;
    const title = activeSegment.title?.trim() ?? '';
    const author = activeSegment.author?.trim() ?? '';
    const prev = prevSegmentSnapshotRef.current;
    if (prev && prev.id === id) {
      const hadContent = Boolean(prev.title.trim() || prev.author.trim());
      const nowEmpty = !title && !author;
      if (hadContent && nowEmpty) {
        attemptedAutoDetectRef.current.delete(id);
      }
    }
    prevSegmentSnapshotRef.current = { id, title, author };
  }, [activeSegment]);

  const aiEligible = useMemo(() => {
    if (!activeSegment || !activeSegmentId) return false;
    if (activeSegment.status === 'checked') return false;
    if (activeSegment.label === 'TOC') return false;
    const hasTitle = Boolean(activeSegment.title?.trim());
    const hasAuthor = Boolean(activeSegment.author?.trim());
    if (hasTitle || hasAuthor) return false;
    return Boolean(activeSegment.text?.trim());
  }, [activeSegment, activeSegmentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (aiAbortControllerRef.current) {
        aiAbortControllerRef.current.abort();
      }
    };
  }, []);

  const handleAIDetect = useCallback(async () => {
    if (!activeSegmentId || !activeSegment?.text) return;
    if (activeSegment.status === 'checked') return;

    const text = activeSegment.text.trim();
    if (!text) return;

    // Abort any existing request
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    aiAbortControllerRef.current = abortController;

    try {
      await mutation.mutateAsync({
        content: text,
        signal: abortController.signal,
        segment: activeSegment,
        segmentId: activeSegmentId,
        documentId,
      });
    } catch (error) {
      // Error handling is done in mutation onError
      // Only log if it's not an abort error
      if (error instanceof Error && error.name !== 'AbortError') {
        // Error already handled by mutation onError
      }
    } finally {
      if (!abortController.signal.aborted) {
        aiAbortControllerRef.current = null;
      }
    }
  }, [activeSegmentId, activeSegment, mutation, documentId]);

  handleAIDetectRef.current = handleAIDetect;

  // Auto-run detect once per segment when both title and author are empty.
  useEffect(() => {
    if (!aiEligible || !activeSegmentId || !activeSegment) return;
    if (attemptedAutoDetectRef.current.has(activeSegmentId)) return;
    void handleAIDetectRef.current();
  }, [aiEligible, activeSegmentId, activeSegment]);

  const handleAIStop = useCallback(() => {
    if (activeSegmentId && attemptedAutoDetectRef.current.has(activeSegmentId)) {
      attemptedAutoDetectRef.current.delete(activeSegmentId);
    }
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    mutation.reset();
    setAiSuggestions(null);
  }, [mutation, activeSegmentId]);

  const handleAISuggestionUse = useCallback(
    (field: 'title' | 'author', value: string) => {
      if (!activeSegmentId) return;
      onUpdate(activeSegmentId, field, value);
      if (field === 'title') {
        onTitleChange(value);
      } else {
        onAuthorChange(value);
      }
    },
    [activeSegmentId, onUpdate, onTitleChange, onAuthorChange]
  );

  return {
    aiSuggestions,
    aiLoading: mutation.isPending,
    onAIDetect: handleAIDetect,
    onAIStop: handleAIStop,
    onAISuggestionUse: handleAISuggestionUse,
  };
};
