import { useMutation, useQueryClient } from '@tanstack/react-query';
import { detectTextEndings, type DetectTextEndingsResponse } from '@/api/outliner';
import { toast } from 'sonner';

interface UseAITextEndingsOptions {
  documentId?: string;
  onSuccess?: (data: DetectTextEndingsResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for AI text ending detection using React Query
 */
export const useAITextEndings = (options?: UseAITextEndingsOptions) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ content, document_id, segment_id, signal }: { content: string; document_id: string; segment_id: string; signal?: AbortSignal }) =>
      detectTextEndings({ content, document_id, segment_id }, signal),
    onSuccess: (data, variables) => {
      // Invalidate document query to refetch updated segments
      if (variables.document_id) {
        queryClient.invalidateQueries({ queryKey: ['outliner-document', variables.document_id] });
      }
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      if (error.name !== 'AbortError') {
        toast.error(`Failed to detect text endings: ${error.message}`);
        options?.onError?.(error);
      }
    },
  });

  return {
    detectTextEndings: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
};
