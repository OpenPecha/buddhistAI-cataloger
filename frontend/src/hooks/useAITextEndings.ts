import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runAiOutline, type AiOutlineResponse } from '@/api/outliner';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

interface UseAITextEndingsOptions {
  documentId?: string;
  onSuccess?: (data: AiOutlineResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for AI document outline (TOC-based segmentation via /outliner/ai-outline).
 */
export const useAITextEndings = (options?: UseAITextEndingsOptions) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ document_id, signal }: { document_id: string; signal?: AbortSignal }) =>
      runAiOutline(document_id, signal),
    onSuccess: (data, variables) => {
      if (variables.document_id) {
        queryClient.invalidateQueries({ queryKey: ['outliner-document', variables.document_id] });
      }
      toast.success(
        data.segments?.length
          ? i18n.t('outliner.aiOutline.segmentsCreated', { count: data.segments.length })
          : i18n.t('outliner.aiOutline.complete'),
      );
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      if (error.name !== 'AbortError') {
        toast.error(i18n.t('outliner.aiOutline.failed', { message: error.message }));
        options?.onError?.(error);
      }
    },
  });

  return {
    /** Runs TOC detection on the full document and replaces all segments. */
    runAiOutline: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
};
