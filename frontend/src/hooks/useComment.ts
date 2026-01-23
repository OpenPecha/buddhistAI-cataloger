import { useQuery } from '@tanstack/react-query';
import { getSegmentComments, type Comment } from '@/api/outliner';

interface UseCommentOptions {
  enabled?: boolean;
}

/**
 * Hook for fetching comments for a specific segment
 * Comments are fetched separately from the document/segment list
 */
export const useComment = (segmentId: string | null | undefined, options?: UseCommentOptions) => {
  const { enabled = true } = options || {};

  const {
    data: comments = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Comment[]>({
    queryKey: ['segment-comments', segmentId],
    queryFn: () => getSegmentComments(segmentId!),
    enabled: enabled && !!segmentId,
    staleTime: 0, // Always refetch to get latest comments
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  return {
    comments,
    isLoading,
    error,
    refetch,
  };
};
