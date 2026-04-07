import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from '@/i18n/config';
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
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const persistAIAnnotationsRef = useRef(persistAIAnnotations);
  persistAIAnnotationsRef.current = persistAIAnnotations;

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
        toast.error(i18n.t('outliner.aiSuggestions.failed', { message: error.message }));
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
    if (activeSegment.label !== 'TEXT') return;

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

  const handleAIStop = useCallback(() => {
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
