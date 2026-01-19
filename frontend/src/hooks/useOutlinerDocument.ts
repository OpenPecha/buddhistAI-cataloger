import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOutlinerDocument,
  uploadOutlinerDocument,
  createOutlinerDocument,
  updateSegment,
  updateSegmentsBulk,
  splitSegment as apiSplitSegment,
  mergeSegments as apiMergeSegments,
  updateOutlinerDocumentContent,
  outlinerSegmentToTextSegment,
  type OutlinerDocument,
  type SegmentUpdateRequest,
} from '@/api/outliner';
import type { TextSegment } from '@/components/outliner';
import { toast } from 'sonner';

interface UseOutlinerDocumentOptions {
  onDocumentLoaded?: (document: OutlinerDocument) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for managing outliner document state and operations
 * Handles loading, saving, and syncing with backend
 */
export const useOutlinerDocument = (options?: UseOutlinerDocumentOptions) => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Track loading state per segment ID
  const [segmentLoadingStates, setSegmentLoadingStates] = useState<Map<string, boolean>>(new Map());

  // Query for loading document
  const {
    data: document,
    isLoading: isLoadingQuery,
    error: loadError,
    refetch,
  } = useQuery<OutlinerDocument>({
    queryKey: ['outliner-document', documentId],
    queryFn: () => getOutlinerDocument(documentId!, true),
    enabled: !!documentId,
    staleTime: 0, // Always refetch to get latest data
  });

  // Mutation for uploading document
  const uploadMutation = useMutation({
    mutationFn: ({ file, user_id }: { file: File; user_id?: string }) =>
      uploadOutlinerDocument(file, user_id),
    onSuccess: (data) => {
      toast.success('Document uploaded successfully');
      navigate(`/outliner/${data.id}`);
      queryClient.invalidateQueries({ queryKey: ['outliner-document'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload document: ${error.message}`);
      options?.onError?.(error);
    },
  });

  // Mutation for creating document from content
  const createMutation = useMutation({
    mutationFn: (data: { content: string; filename?: string; user_id?: string }) =>
      createOutlinerDocument(data),
    onSuccess: (data) => {
      toast.success('Document created successfully');
      navigate(`/outliner/${data.id}`);
      queryClient.invalidateQueries({ queryKey: ['outliner-document'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create document: ${error.message}`);
      options?.onError?.(error);
    },
  });

  // Mutation for updating segment - no optimistic updates, only update on success
  const updateSegmentMutation = useMutation({
    mutationFn: ({ segmentId, updates }: { segmentId: string; updates: SegmentUpdateRequest }) =>
      updateSegment(segmentId, updates),
    onMutate: async ({ segmentId }) => {
      // Set loading state for this segment
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(segmentId, true);
        return newMap;
      });
    },
    onError: (error: Error, variables) => {
      // Remove loading state on error - don't update UI
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(variables.segmentId);
        return newMap;
      });
      toast.error(`Failed to update segment: ${error.message}`);
      // On error, don't update UI - keep existing state
    },
    onSuccess: (_data, variables) => {
      // Remove loading state on success
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(variables.segmentId);
        return newMap;
      });
      // Only update UI on success by invalidating and refetching
      queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] });
    },
  });

  // Mutation for bulk segment updates - track loading for all affected segments
  const bulkUpdateSegmentsMutation = useMutation({
    mutationFn: ({
      segments,
      segmentIds,
    }: {
      segments: SegmentUpdateRequest[];
      segmentIds: string[];
    }) => updateSegmentsBulk({ segments, segment_ids: segmentIds }),
    onMutate: async ({ segmentIds }) => {
      // Set loading state for all segments being updated
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        segmentIds.forEach((id) => newMap.set(id, true));
        return newMap;
      });
    },
    onSuccess: (_data, variables) => {
      // Remove loading state for all segments on success
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        variables.segmentIds.forEach((id) => newMap.delete(id));
        return newMap;
      });
      // Only update UI on success
      queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] });
    },
    onError: (error: Error, variables) => {
      // Remove loading state on error - don't update UI
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        variables.segmentIds.forEach((id) => newMap.delete(id));
        return newMap;
      });
      toast.error(`Failed to update segments: ${error.message}`);
    },
  });

  // Mutation for splitting segment - no optimistic updates, only update on success
  const splitSegmentMutation = useMutation({
    mutationFn: ({ segmentId, splitPosition }: { segmentId: string; splitPosition: number }) =>
      apiSplitSegment(segmentId, splitPosition, documentId || undefined),
    onMutate: async ({ segmentId }) => {
      // Set loading state for the segment being split
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(segmentId, true);
        return newMap;
      });
    },
    onError: (error: Error, variables) => {
      // Remove loading state on error - don't update UI
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(variables.segmentId);
        return newMap;
      });
      toast.error(`Failed to split segment: ${error.message}`);
    },
    onSuccess: (_data, variables) => {
      // Remove loading state on success
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(variables.segmentId);
        return newMap;
      });
      // Only update UI on success
      queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] });
      toast.success('Segment split successfully');
    },
  });

  // Mutation for merging segments - track loading for all segments being merged
  const mergeSegmentsMutation = useMutation({
    mutationFn: (segmentIds: string[]) => apiMergeSegments(segmentIds),
    onMutate: async (segmentIds) => {
      // Set loading state for all segments being merged
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        segmentIds.forEach((id) => newMap.set(id, true));
        return newMap;
      });
    },
    onSuccess: (_data, segmentIds) => {
      // Remove loading state for all segments on success
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        segmentIds.forEach((id) => newMap.delete(id));
        return newMap;
      });
      // Only update UI on success
      queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] });
      toast.success('Segments merged successfully');
    },
    onError: (error: Error, segmentIds) => {
      // Remove loading state on error - don't update UI
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        segmentIds.forEach((id) => newMap.delete(id));
        return newMap;
      });
      toast.error(`Failed to merge segments: ${error.message}`);
    },
  });

  // Mutation for updating document content
  const updateContentMutation = useMutation({
    mutationFn: (content: string) => updateOutlinerDocumentContent(documentId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update document content: ${error.message}`);
    },
  });

  // Convert segments to TextSegment format
  const segments: TextSegment[] = document?.segments
    ? document.segments.map(outlinerSegmentToTextSegment)
    : [];

  // Load document effect
  useEffect(() => {
    if (document && options?.onDocumentLoaded) {
      options.onDocumentLoaded(document);
    }
  }, [document, options]);

  // Error effect
  useEffect(() => {
    if (loadError && options?.onError) {
      options.onError(loadError as Error);
    }
  }, [loadError, options]);

  // Upload file handler
  const handleUploadFile = useCallback(
    async (file: File, user_id?: string) => {
      setIsLoadingDocument(true);
      try {
        await uploadMutation.mutateAsync({ file, user_id });
      } finally {
        setIsLoadingDocument(false);
      }
    },
    [uploadMutation]
  );

  // Create document from content handler
  const handleCreateDocument = useCallback(
    async (content: string, filename?: string, user_id?: string) => {
      setIsLoadingDocument(true);
      try {
        await createMutation.mutateAsync({ content, filename, user_id });
      } finally {
        setIsLoadingDocument(false);
      }
    },
    [createMutation]
  );

  // Update segment handler
  const handleUpdateSegment = useCallback(
    async (segmentId: string, updates: SegmentUpdateRequest) => {
      setIsSaving(true);
      try {
        await updateSegmentMutation.mutateAsync({ segmentId, updates });
      } finally {
        setIsSaving(false);
      }
    },
    [updateSegmentMutation]
  );

  // Bulk update segments handler
  const handleBulkUpdateSegments = useCallback(
    async (updates: { segmentId: string; updates: SegmentUpdateRequest }[]) => {
      setIsSaving(true);
      try {
        const segments = updates.map((u) => u.updates);
        const segmentIds = updates.map((u) => u.segmentId);
        await bulkUpdateSegmentsMutation.mutateAsync({ segments, segmentIds });
      } finally {
        setIsSaving(false);
      }
    },
    [bulkUpdateSegmentsMutation]
  );

  // Split segment handler
  const handleSplitSegment = useCallback(
    async (segmentId: string, splitPosition: number) => {
      setIsSaving(true);
      try {
        await splitSegmentMutation.mutateAsync({ segmentId, splitPosition });
      } finally {
        setIsSaving(false);
      }
    },
    [splitSegmentMutation]
  );

  // Merge segments handler
  const handleMergeSegments = useCallback(
    async (segmentIds: string[]) => {
      setIsSaving(true);
      try {
        await mergeSegmentsMutation.mutateAsync(segmentIds);
      } finally {
        setIsSaving(false);
      }
    },
    [mergeSegmentsMutation]
  );

  // Update document content handler
  const handleUpdateContent = useCallback(
    async (content: string) => {
      setIsSaving(true);
      try {
        await updateContentMutation.mutateAsync(content);
      } finally {
        setIsSaving(false);
      }
    },
    [updateContentMutation]
  );

  return {
    // Document data
    document,
    documentId,
    textContent: document?.content || '',
    segments,
    isLoading: isLoadingQuery || isLoadingDocument,
    isSaving,
    error: loadError,
    segmentLoadingStates: segmentLoadingStates || new Map(), // Map of segmentId -> loading boolean

    // Actions
    uploadFile: handleUploadFile,
    createDocument: handleCreateDocument,
    updateSegment: handleUpdateSegment,
    bulkUpdateSegments: handleBulkUpdateSegments,
    splitSegment: handleSplitSegment,
    mergeSegments: handleMergeSegments,
    updateContent: handleUpdateContent,
    refetchDocument: refetch,
  };
};
