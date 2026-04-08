import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getOutlinerDocumentAiTocEntries } from '@/api/outliner';

export const outlinerDocumentAiTocQueryKey = (documentId: string | undefined) =>
  ['outliner-document-ai-toc', documentId] as const;

/**
 * Fetches AI outline TOC lines for the current outliner document (lazy, separate from the main document payload).
 */
export function useOutlinerDocumentAiTocEntries() {
  const { documentId } = useParams<{ documentId: string }>();

  return useQuery({
    queryKey: outlinerDocumentAiTocQueryKey(documentId),
    queryFn: () => {
      if (!documentId) {
        throw new Error('documentId is required');
      }
      return getOutlinerDocumentAiTocEntries(documentId);
    },
    enabled: !!documentId,
  });
}
