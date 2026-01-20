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
  resetSegments as apiResetSegments,
  bulkSegmentOperations as apiBulkSegmentOperations,
  createSegmentsBulk as apiCreateSegmentsBulk,
  outlinerSegmentToTextSegment,
  type OutlinerDocument,
  type SegmentUpdateRequest,
  type SegmentCreateRequest,
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
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
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

  // Mutation for splitting segment - optimistic updates with rollback on error
  const splitSegmentMutation = useMutation({
    mutationFn: ({ segmentId, splitPosition }: { segmentId: string; splitPosition: number }) =>
      apiSplitSegment(segmentId, splitPosition, documentId || undefined),
    onMutate: async ({ segmentId, splitPosition }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['outliner-document', documentId] });

      // Snapshot the previous value for rollback
      const previousDocument = queryClient.getQueryData<OutlinerDocument>([
        'outliner-document',
        documentId,
      ]);

      if (!previousDocument?.segments) {
        return { previousDocument: previousDocument || null };
      }

      // Find the segment to split
      const segmentToSplit = previousDocument.segments.find((seg) => seg.id === segmentId);
      if (!segmentToSplit) {
        return { previousDocument };
      }

      // Calculate split text
      const textBefore = segmentToSplit.text.substring(0, splitPosition).trim();
      const textAfter = segmentToSplit.text.substring(splitPosition).trim();

      // Don't proceed if split would create empty segments
      if (!textBefore || !textAfter) {
        return { previousDocument };
      }

      // Create optimistic segments
      const firstSegment = {
        ...segmentToSplit,
        text: textBefore,
        span_end: segmentToSplit.span_start + textBefore.length,
      };

      // Generate temporary ID for second segment (will be replaced by server response)
      const tempSecondSegmentId = `temp-${Date.now()}`;
      const secondSegment = {
        id: tempSecondSegmentId,
        text: textAfter,
        segment_index: segmentToSplit.segment_index + 1,
        span_start: firstSegment.span_end,
        span_end: firstSegment.span_end + textAfter.length,
        title: null,
        author: null,
        title_bdrc_id: null,
        author_bdrc_id: null,
        parent_segment_id: segmentToSplit.parent_segment_id,
        is_annotated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update segments array: replace the split segment with two new segments
      const segmentIndex = previousDocument.segments.findIndex((seg) => seg.id === segmentId);
      const newSegments = [...previousDocument.segments];
      
      // Replace the original segment with first part, insert second part after it
      newSegments.splice(segmentIndex, 1, firstSegment, secondSegment);
      
      // Update segment indices for following segments
      for (let i = segmentIndex + 2; i < newSegments.length; i++) {
        newSegments[i] = {
          ...newSegments[i],
          segment_index: newSegments[i].segment_index + 1,
        };
      }

      // Optimistically update the query cache
      const optimisticDocument: OutlinerDocument = {
        ...previousDocument,
        segments: newSegments,
        total_segments: previousDocument.total_segments + 1,
      };

      queryClient.setQueryData<OutlinerDocument>(
        ['outliner-document', documentId],
        optimisticDocument
      );

      // Set loading state for the segment being split
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(segmentId, true);
        return newMap;
      });

      return { previousDocument };
    },
    onError: (error: Error, variables, context) => {
      // Rollback to previous document state
      if (context?.previousDocument) {
        queryClient.setQueryData<OutlinerDocument>(
          ['outliner-document', documentId],
          context.previousDocument
        );
      }

      // Remove loading state on error
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
      
      // Refetch to ensure consistency with server state (in case server made different changes)
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

  // Reset segments handler - optimistic updates
  const resetSegmentsMutation = useMutation({
    mutationFn: () => apiResetSegments(documentId!),
    onMutate: async () => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['outliner-document', documentId] });

      // Snapshot the previous value for rollback
      const previousDocument = queryClient.getQueryData<OutlinerDocument>([
        'outliner-document',
        documentId,
      ]);

      if (!previousDocument) {
        return { previousDocument: null };
      }

      // Optimistically clear all segments
      const optimisticDocument: OutlinerDocument = {
        ...previousDocument,
        segments: [],
        total_segments: 0,
        annotated_segments: 0,
        progress_percentage: 0,
      };

      queryClient.setQueryData<OutlinerDocument>(
        ['outliner-document', documentId],
        optimisticDocument
      );

      return { previousDocument };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback to previous document state
      if (context?.previousDocument) {
        queryClient.setQueryData<OutlinerDocument>(
          ['outliner-document', documentId],
          context.previousDocument
        );
      }
      toast.error(`Failed to reset segments: ${error.message}`);
    },
    onSuccess: () => {
      // Refetch to ensure consistency with server state
      queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] });
      toast.success('Segments reset successfully');
    },
  });

  const handleResetSegments = useCallback(async () => {
    if (!documentId) return;
    setIsSaving(true);
    try {
      await resetSegmentsMutation.mutateAsync();
    } finally {
      setIsSaving(false);
    }
  }, [documentId, resetSegmentsMutation]);

  // Create segments bulk handler - optimistic updates
  const createSegmentsBulkMutation = useMutation({
    mutationFn: (segments: SegmentCreateRequest[]) =>
      apiCreateSegmentsBulk(documentId!, segments),
    onMutate: async (segments) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['outliner-document', documentId] });

      // Snapshot the previous value for rollback
      const previousDocument = queryClient.getQueryData<OutlinerDocument>([
        'outliner-document',
        documentId,
      ]);

      if (!previousDocument) {
        return { previousDocument: null };
      }

      // Create optimistic segments with temporary IDs
      const timestamp = Date.now();
      const optimisticSegments = segments.map((seg, index) => ({
        id: `temp-${timestamp}-${index}`,
        text: seg.text || previousDocument.content.substring(seg.span_start, seg.span_end),
        segment_index: seg.segment_index,
        span_start: seg.span_start,
        span_end: seg.span_end,
        title: seg.title || null,
        author: seg.author || null,
        title_bdrc_id: seg.title_bdrc_id || null,
        author_bdrc_id: seg.author_bdrc_id || null,
        parent_segment_id: seg.parent_segment_id || null,
        is_annotated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Optimistically update the document with new segments
      const optimisticDocument: OutlinerDocument = {
        ...previousDocument,
        segments: optimisticSegments,
        total_segments: optimisticSegments.length,
        annotated_segments: 0,
        progress_percentage: 0,
      };

      queryClient.setQueryData<OutlinerDocument>(
        ['outliner-document', documentId],
        optimisticDocument
      );

      return { previousDocument };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback to previous document state
      if (context?.previousDocument) {
        queryClient.setQueryData<OutlinerDocument>(
          ['outliner-document', documentId],
          context.previousDocument
        );
      }
      toast.error(`Failed to create segments: ${error.message}`);
    },
    onSuccess: (data) => {
      // Refetch to ensure consistency with server state (server IDs will replace temp IDs)
      queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] });
      toast.success(`Created ${data.length} segment${data.length > 1 ? 's' : ''} successfully`);
    },
  });

  const handleCreateSegmentsBulk = useCallback(
    async (segments: SegmentCreateRequest[]) => {
      if (!documentId) return;
      setIsSaving(true);
      try {
        return await createSegmentsBulkMutation.mutateAsync(segments);
      } finally {
        setIsSaving(false);
      }
    },
    [documentId, createSegmentsBulkMutation]
  );

  // Bulk segment operations handler
  const bulkSegmentOperationsMutation = useMutation({
    mutationFn: (operations: Parameters<typeof apiBulkSegmentOperations>[1]) =>
      apiBulkSegmentOperations(documentId!, operations),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] });
      const createdCount = variables.create?.length || 0;
      const updatedCount = variables.update?.length || 0;
      const deletedCount = variables.delete?.length || 0;
      
      if (createdCount > 0 || updatedCount > 0 || deletedCount > 0) {
        const actions = [];
        if (createdCount > 0) actions.push(`${createdCount} created`);
        if (updatedCount > 0) actions.push(`${updatedCount} updated`);
        if (deletedCount > 0) actions.push(`${deletedCount} deleted`);
        toast.success(`Segments ${actions.join(', ')} successfully`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to perform bulk operations: ${error.message}`);
    },
  });

  const handleBulkSegmentOperations = useCallback(
    async (operations: Parameters<typeof apiBulkSegmentOperations>[1]) => {
      if (!documentId) return;
      setIsSaving(true);
      try {
        await bulkSegmentOperationsMutation.mutateAsync(operations);
      } finally {
        setIsSaving(false);
      }
    },
    [documentId, bulkSegmentOperationsMutation]
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
    resetSegments: handleResetSegments,
    createSegmentsBulk: handleCreateSegmentsBulk,
    bulkSegmentOperations: handleBulkSegmentOperations,
    refetchDocument: refetch,
  };
};
