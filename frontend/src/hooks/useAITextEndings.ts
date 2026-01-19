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
    mutationFn: ({ content, signal }: { content: string; signal?: AbortSignal }) =>
      detectTextEndings({ content }, signal),
    onSuccess: (data) => {
      if (options?.documentId) {
        // Invalidate document query to refetch updated segments
        queryClient.invalidateQueries({ queryKey: ['outliner-document', options.documentId] });
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
