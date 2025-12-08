import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAnnotation, fetchInstance } from '../../../api/text';
import { applySegmentation, generateFileSegmentation, extractInstanceSegmentation } from '../../../lib/annotation';
import { reconstructSegments } from '../utils/generateAnnotation';
import { useTextSelectionStore } from '../../../stores/textSelectionStore';
import type { RelatedInstance } from './useRelatedInstances';

// Interface for alignment annotation response
interface AlignmentAnnotationData {
  alignment_annotation: Array<{
    id: string;
    span: {
      start: number;
      end: number;
    };
    index: number;
    alignment_index: number[];
  }>;
  target_annotation: Array<{
    id: string;
    span: {
      start: number;
      end: number;
    };
    index: number;
  }>;
}

interface AlignmentAnnotationResponse {
  id: string;
  type: string;
  data: AlignmentAnnotationData;
}

interface RelatedInstanceResponse {
  instance_id: string;
  metadata: {
    instance_type: string;
    copyright: string;
    text_id: string;
    title: Record<string, string>;
    alt_titles: Array<Record<string, string>>;
    language: string;
    contributions: Array<{
      person_id: string;
      role: string;
    }>;
  };
  annotation: string;
  relationship: string;
}

// Helper function to determine target type from metadata
function determineTargetType(instanceData: RelatedInstanceResponse | RelatedInstance | null): 'translation' | 'commentary' | null {
  if (!instanceData) return null;
  
  if ('metadata' in instanceData && instanceData.metadata) {
    const instanceType = instanceData.metadata.instance_type?.toLowerCase() || '';
    const relationship = instanceData.relationship?.toLowerCase() || '';
    
    if (instanceType.includes('commentary') || relationship.includes('commentary')) {
      return 'commentary';
    }
    
    if (instanceType.includes('translation') || relationship.includes('translation')) {
      return 'translation';
    }
  }
  
  if ('type' in instanceData && instanceData.type) {
    const instanceType = instanceData.type.toLowerCase();
    if (instanceType.includes('commentary')) {
      return 'commentary';
    }
    if (instanceType.includes('translation')) {
      return 'translation';
    }
  }
  
  return 'translation';
}

interface UseAlignmentSegmentationProps {
  sourceInstanceId: string | null;
  sourceTextId: string | null;
  selectedTargetInstanceId: string | null;
  selectedAnnotationId: string | null;
  relatedInstances: RelatedInstance[];
  onSearchParamsChange: (updates: Record<string, string>) => void;
}

export function useAlignmentSegmentation({
  sourceInstanceId,
  sourceTextId,
  selectedTargetInstanceId,
  selectedAnnotationId,
  relatedInstances,
  onSearchParamsChange,
}: UseAlignmentSegmentationProps) {
  const {
    setSourceText,
    setTargetText,
    setTargetType,
    setLoadingAnnotations,
    setAnnotationsApplied,
  } = useTextSelectionStore();

  // Fetch alignment annotation when annotation ID is available
  const { data: alignmentAnnotation, isLoading: isLoadingAlignment, error: alignmentError } = useQuery({
    queryKey: ['alignmentAnnotation', selectedAnnotationId],
    queryFn: () => fetchAnnotation(selectedAnnotationId!),
    enabled: Boolean(selectedAnnotationId),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  // Fetch source instance content
  const { data: sourceInstanceData, isLoading: isLoadingSourceInstance } = useQuery({
    queryKey: ['sourceInstance', sourceInstanceId],
    queryFn: () => fetchInstance(sourceInstanceId!),
    enabled: Boolean(sourceInstanceId),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  // Fetch target instance content
  const { data: targetInstanceData, isLoading: isLoadingTargetInstance } = useQuery({
    queryKey: ['targetInstance', selectedTargetInstanceId],
    queryFn: () => fetchInstance(selectedTargetInstanceId!),
    enabled: Boolean(selectedTargetInstanceId),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  // Apply segmentation when alignment annotation and instance data are available
  useEffect(() => {
    // Wait for both instance data to be fully loaded before processing
    if (!sourceInstanceData || !targetInstanceData || isLoadingSourceInstance || isLoadingTargetInstance) {
      return;
    }

    // Determine loading message based on whether alignment annotation exists
    const loadingMessage = alignmentAnnotation 
      ? 'Applying alignment annotations...' 
      : 'Applying instance segmentation...';
    
    setLoadingAnnotations(true, loadingMessage);
    
    try {
      let segmentedSourceText: string;
      let segmentedTargetText: string;
      
      if (alignmentAnnotation) {
        const alignmentData = alignmentAnnotation as unknown as AlignmentAnnotationResponse;
        const annotationData = alignmentData.data;
        
        if (annotationData?.target_annotation && Array.isArray(annotationData.target_annotation) &&
            annotationData?.alignment_annotation && Array.isArray(annotationData.alignment_annotation)) {
          
          const sourceContent = sourceInstanceData.content || '';
          const targetContent = targetInstanceData.content || '';
          
          // Reconstruct segments from alignment annotations
          const { source, target } = reconstructSegments(
            annotationData.target_annotation,
            annotationData.alignment_annotation,
            sourceContent,
            targetContent
          );
          
          // Join segments with newlines to create segmented text
          segmentedSourceText = source.join('\n');
          segmentedTargetText = target.join('\n');
        } else {
          segmentedSourceText = sourceInstanceData.content || '';
          segmentedTargetText = targetInstanceData.content || '';
        }
      } else {
        // No alignment annotation - use instance segmentation if available
        const sourceContent = sourceInstanceData.content || '';
        const targetContent = targetInstanceData.content || '';
        
        // Try to extract segmentation from source instance annotations
        const sourceInstanceSegmentation = extractInstanceSegmentation(sourceInstanceData.annotations);
        if (sourceInstanceSegmentation) {
          segmentedSourceText = applySegmentation(sourceContent, sourceInstanceSegmentation);
        } else {
          // Fallback to file segmentation if no instance segmentation
          const sourceSegmentations = generateFileSegmentation(sourceContent);
          segmentedSourceText = applySegmentation(sourceContent, sourceSegmentations);
        }
        
        // Try to extract segmentation from target instance annotations
        const targetInstanceSegmentation = extractInstanceSegmentation(targetInstanceData.annotations);
        if (targetInstanceSegmentation) {
          segmentedTargetText = applySegmentation(targetContent, targetInstanceSegmentation);
        } else {
          // Fallback to file segmentation if no instance segmentation
          const targetSegmentations = generateFileSegmentation(targetContent);
          segmentedTargetText = applySegmentation(targetContent, targetSegmentations);
        }
      }
      
      setSourceText(
        sourceTextId || sourceInstanceData.id || 'source-instance',
        sourceInstanceId!,
        segmentedSourceText,
        'database'
      );
      
      setTargetText(
        `related-${selectedTargetInstanceId}`,
        selectedTargetInstanceId!,
        segmentedTargetText,
        'database'
      );
      
      const selectedInstance = relatedInstances.find(instance => 
        (instance.instance_id || instance.id) === selectedTargetInstanceId
      );
      const targetType = determineTargetType(selectedInstance || null);
      setTargetType(targetType);
      
      // Don't update search params automatically - only update when user explicitly selects
      
      setAnnotationsApplied(true);
      
    } catch (error) {
      console.error('Error applying alignment annotations:', error);
      setLoadingAnnotations(false);
      setAnnotationsApplied(true);
    }
  }, [
    alignmentAnnotation,
    sourceInstanceData,
    targetInstanceData,
    isLoadingSourceInstance,
    isLoadingTargetInstance,
    sourceInstanceId,
    sourceTextId,
    selectedTargetInstanceId,
    setSourceText,
    setTargetText,
    setTargetType,
    onSearchParamsChange,
    relatedInstances,
    setLoadingAnnotations,
    setAnnotationsApplied,
  ]);

  return {
    isLoadingAlignment,
    isLoadingSourceInstance,
    isLoadingTargetInstance,
    alignmentError,
  };
}

