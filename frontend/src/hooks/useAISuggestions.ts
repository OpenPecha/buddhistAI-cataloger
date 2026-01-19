import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateTitleAuthor, type GenerateTitleAuthorResponse } from '@/api/outliner';
import { toast } from 'sonner';
import type { AISuggestions, TextSegment } from '@/components/outliner';

interface UseAISuggestionsOptions {
  activeSegment: TextSegment | undefined;
  activeSegmentId: string | null;
  documentId?: string;
  onUpdate: (segmentId: string, field: 'title' | 'author' | 'title_bdrc_id' | 'author_bdrc_id', value: string) => Promise<void>;
  onTitleChange: (value: string) => void;
  onAuthorChange: (value: string) => void;
  onShowTitleDropdown: (show: boolean) => void;
  onShowAuthorDropdown: (show: boolean) => void;
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
}: UseAISuggestionsOptions) => {
  const queryClient = useQueryClient();
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  // Mutation for AI title/author generation
  const mutation = useMutation({
    mutationFn: ({ content, signal }: { content: string; signal?: AbortSignal }) =>
      generateTitleAuthor({ content }, signal),
    onSuccess: (data: GenerateTitleAuthorResponse) => {
      setAiSuggestions(data as AISuggestions);

      // Update segment with detected/extracted values
      if (activeSegmentId) {
        if (data.title) {
          onUpdate(activeSegmentId, 'title', data.title);
          onTitleChange(data.title);
        } else if (data.suggested_title) {
          onUpdate(activeSegmentId, 'title', data.suggested_title);
          onTitleChange(data.suggested_title);
        }

        if (data.author) {
          onUpdate(activeSegmentId, 'author', data.author);
          onAuthorChange(data.author);
        } else if (data.suggested_author) {
          onUpdate(activeSegmentId, 'author', data.suggested_author);
          onAuthorChange(data.suggested_author);
        }
      }

      // Invalidate document query if we have a documentId
      if (documentId) {
        queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] });
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
      await mutation.mutateAsync({ content: text, signal: abortController.signal });
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
  }, [mutation]);

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
