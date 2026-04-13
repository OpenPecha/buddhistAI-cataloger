import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOutlinerDocument,
  createOutlinerDocument,
  updateSegment,
  updateSegmentsBulk,
  splitSegment as apiSplitSegment,
  mergeSegments as apiMergeSegments,
  updateOutlinerDocumentContent,
  resetSegments as apiResetSegments,
  bulkSegmentOperations as apiBulkSegmentOperations,
  createSegmentsBulk as apiCreateSegmentsBulk,
  type OutlinerDocument,
  type SegmentUpdateRequest,
  type SegmentCreateRequest,
  addSegmentComment,
  type CommentCreateRequest,
} from '@/api/outliner';
import { segmentBodyFromDocument } from '@/lib/outlinerSegmentText';
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
    isRefetching: isRefetchingQuery,
    refetch,
  } = useQuery<OutlinerDocument>({
    queryKey: ['outliner-document', documentId],
    queryFn: () => getOutlinerDocument(documentId!, true, { workspace: true }),
    enabled: !!documentId,
    staleTime: 0, // Always refetch to get latest data
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
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

      // Calculate split text from document content + spans (same as server)
      // IMPORTANT: Do not trim/strip. Preserve whitespace/newlines exactly.
      const body = segmentBodyFromDocument(
        previousDocument.content,
        segmentToSplit.span_start,
        segmentToSplit.span_end
      );
      const textBefore = body.substring(0, splitPosition);
      const textAfter = body.substring(splitPosition);

      // Don't proceed if split would create empty segments
      if (splitPosition <= 0 || splitPosition >= body.length) {
        return { previousDocument };
      }

      // Create optimistic segments
      const firstSegment = {
        ...segmentToSplit,
        text: textBefore,
        span_end: segmentToSplit.span_start + splitPosition,
      };

      // Generate temporary ID for second segment (will be replaced by server response)
      const tempSecondSegmentId = `temp-${Date.now()}`;
      const secondSegment = {
        id: tempSecondSegmentId,
        text: textAfter,
        segment_index: segmentToSplit.segment_index + 1,
        span_start: firstSegment.span_end,
        span_end: segmentToSplit.span_end,
        title: null,
        author: null,
        title_bdrc_id: null,
        author_bdrc_id: null,
        parent_segment_id: segmentToSplit.parent_segment_id,
        is_annotated: false,
        comments: [],
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

      // New segment uses a temp id until refetch; show syncing on that row until server data loads
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(tempSecondSegmentId, true);
        return newMap;
      });

      return { previousDocument, tempSecondSegmentId };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback to previous document state
      if (context?.previousDocument) {
        queryClient.setQueryData<OutlinerDocument>(
          ['outliner-document', documentId],
          context.previousDocument
        );
      }

      const tempSecondId = context?.tempSecondSegmentId;
      if (tempSecondId) {
        setSegmentLoadingStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(tempSecondId);
          return newMap;
        });
      }
      toast.error(`Failed to split segment: ${error.message}`);
    },
    onSuccess: async (_data, _variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] });
      const tempSecondId = context?.tempSecondSegmentId;
      if (tempSecondId) {
        setSegmentLoadingStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(tempSecondId);
          return newMap;
        });
      }
      queryClient.invalidateQueries({ queryKey: ['outliner-documents'] });
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
      // Also invalidate documents list so Dashboard shows updated segment counts
      queryClient.invalidateQueries({ queryKey: ['outliner-documents'] });
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

  // Load document effect
  useEffect(() => {
    if (document && options?.onDocumentLoaded) {
      options.onDocumentLoaded(document);
    }
  }, [document, options]);

  // Error effect
  useEffect(() => {
    if (loadError && options?.onError) {
      const error = loadError instanceof Error ? loadError : new Error(String(loadError));
      options.onError(error);
    }
  }, [loadError, options]);

 

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
      // Also invalidate documents list so Dashboard shows updated segment counts
      queryClient.invalidateQueries({ queryKey: ['outliner-documents'] });
      toast.success('Segments reset successfully');
    },
  });

  const handleResetSegments = useCallback(async () => {
    if (!confirm('⚠️Are you sure you want to reset the segments? This action cannot be undone.')) {
      return;
    }
    if (!confirm('⚠️Are you really sure?')) {
      return;
    }
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
        text: segmentBodyFromDocument(previousDocument.content, seg.span_start, seg.span_end),
        segment_index: seg.segment_index,
        span_start: seg.span_start,
        span_end: seg.span_end,
        title: seg.title || null,
        author: seg.author || null,
        title_bdrc_id: seg.title_bdrc_id || null,
        author_bdrc_id: seg.author_bdrc_id || null,
        parent_segment_id: seg.parent_segment_id || null,
        is_annotated: false,
        comments: [],
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

      const tempSegmentIds = optimisticSegments.map((s) => s.id);
      setSegmentLoadingStates((prev) => {
        const newMap = new Map(prev);
        tempSegmentIds.forEach((id) => newMap.set(id, true));
        return newMap;
      });

      return { previousDocument, tempSegmentIds };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback to previous document state
      if (context?.previousDocument) {
        queryClient.setQueryData<OutlinerDocument>(
          ['outliner-document', documentId],
          context.previousDocument
        );
      }
      const bulkTempIds = context?.tempSegmentIds;
      if (bulkTempIds?.length) {
        setSegmentLoadingStates((prev) => {
          const newMap = new Map(prev);
          bulkTempIds.forEach((id) => newMap.delete(id));
          return newMap;
        });
      }
      toast.error(`Failed to create segments: ${error.message}`);
    },
    onSuccess: async (data, _variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] });
      const bulkTempIds = context?.tempSegmentIds;
      if (bulkTempIds?.length) {
        setSegmentLoadingStates((prev) => {
          const newMap = new Map(prev);
          bulkTempIds.forEach((id) => newMap.delete(id));
          return newMap;
        });
      }
      queryClient.invalidateQueries({ queryKey: ['outliner-documents'] });
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

  const createCommentMutation = useMutation({
    mutationFn: ({ segmentId, comment }: { segmentId: string; comment: CommentCreateRequest }) =>
      addSegmentComment(segmentId, comment),
    onSuccess: (_data, variables) => {
      // Invalidate both document query and comments query for the segment
      queryClient.invalidateQueries({ queryKey: ['segment-comments', variables.segmentId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create comment: ${error.message}`);
    },
  });


  return {
    // Document data
    document,
    documentId,
    textContent: document?.content || '',
    segments: document?.segments || [],
    isLoading: isLoadingQuery || isLoadingDocument,
    isSaving,
    error: loadError,
    segmentLoadingStates: segmentLoadingStates || new Map(), // Map of segmentId -> loading boolean
    updateSegmentLoading: updateSegmentMutation.isPending,
    isRefetching: isRefetchingQuery,
    isResetting: resetSegmentsMutation.isPending,
    // Actions
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
    createCommentMutation,
  };
};
