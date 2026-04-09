import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { generateTitleAuthor, type GenerateTitleAuthorResponse } from '@/api/outliner';
import { toast } from 'sonner';
import type { AISuggestions, TextSegment } from '@/features/outliner/types';

interface UseAISuggestionsOptions {
  activeSegment: TextSegment | undefined;
  activeSegmentId: string | null;
}

/**
 * Hook to manage AI suggestions for title and author detection using React Query
 */
export const useAISuggestions = ({ activeSegment, activeSegmentId }: UseAISuggestionsOptions) => {
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  type AIMutationVars = { content: string; signal?: AbortSignal };

  // Mutation for AI title/author generation
  const mutation = useMutation({
    mutationFn: ({ content, signal }: AIMutationVars) =>
      generateTitleAuthor({ content }, signal),
    onSuccess: (data: GenerateTitleAuthorResponse) => {
      setAiSuggestions(data as AISuggestions);
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
  }, [activeSegmentId, activeSegment, mutation]);

  const handleAIStop = useCallback(() => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    mutation.reset();
    setAiSuggestions(null);
  }, [mutation, activeSegmentId]);

  return useMemo(
    () => ({
      aiSuggestions,
      aiLoading: mutation.isPending,
      onAIDetect: handleAIDetect,
      onAIStop: handleAIStop,
    }),
    [aiSuggestions, mutation.isPending, handleAIDetect, handleAIStop]
  );
};
