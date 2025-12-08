import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTexts, fetchTextInstances, fetchInstance, fetchAnnotation, fetchTextsByTitle, type TextTitleSearchResult } from '../api/text';
import { applySegmentation } from '../lib/annotation';
import type { OpenPechaTextInstance, SegmentationAnnotation as APISegmentationAnnotation, OpenPechaText } from '../types/text';
import type { SegmentAnnotation } from '../components/Formatter/types';

// Query keys for React Query caching
export const textKeys = {
  all: ['texts'] as const,
  lists: () => [...textKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...textKeys.lists(), { filters }] as const,
  details: () => [...textKeys.all, 'detail'] as const,
  detail: (id: string) => [...textKeys.details(), id] as const,
  instances: (id: string) => [...textKeys.detail(id), 'instances'] as const,
  instance: (id: string) => ['instance', id] as const,
  annotation: (id: string) => ['annotation', id] as const,
};

// Configuration options for text processing
export interface TextRetrievalOptions {
  applySegmentation?: boolean;
  includeAnnotations?: boolean;
  processForFormatter?: boolean;
}

// Result type for processed text data
export interface TextRetrievalResult {
  instanceId: string;
  baseText: string;
  content: string;
  segmentAnnotations: SegmentAnnotation[];
  segmentedText: Array<{segment: SegmentAnnotation, text: string}>;
  hasSegmentation: boolean;
  errors?: string[];
}

/**
 * Hook for fetching the list of available texts
 */
export const useTexts = (params?: { 
  limit?: number; 
  offset?: number; 
  language?: string; 
  author?: string 
}) => {
  
  return useQuery({
    queryKey: textKeys.list(params || {}),
    queryFn: () => fetchTexts(params),
    refetchIntervalInBackground:true,
  });
};

/**
 * Hook for searching texts by title with debouncing
 * @param searchQuery - The search query string
 * @param debounceMs - Debounce delay in milliseconds (default: 500ms)
 * @returns search results and loading state
 */
export const useTextTitleSearch = (searchQuery: string, debounceMs: number = 500) => {
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  const trimmedQuery = debouncedQuery.trim();
  const isEnabled = trimmedQuery.length > 0;

  const { data, isLoading, error } = useQuery<TextTitleSearchResult[]>({
    queryKey: ['textTitleSearch', trimmedQuery],
    queryFn: async () => {
      try {
        const results = await fetchTextsByTitle(trimmedQuery);
        return Array.isArray(results) ? results : [];
      } catch (err) {
        throw err;
      }
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    results: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Unknown error') : null,
  };
};

/**
 * Hook for fetching instances of a specific text
 */
export const useTextInstances = (textId: string | null) => {
  return useQuery({
    queryKey: textKeys.instances(textId || "textId"),
    queryFn: () => textId ? fetchTextInstances(textId) : null,
    enabled: !!textId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval:false,
    refetchOnWindowFocus:false,
    refetchOnMount:false,
    refetchOnReconnect:false,
    refetchIntervalInBackground:false,
  });
};

/**
 * Hook for fetching a specific instance
 */
export const useInstance = (instanceId: string | null) => {
  return useQuery({
    queryKey: textKeys.instance(instanceId || "instanceId"),
    queryFn: () => instanceId ? fetchInstance(instanceId) : null,
    enabled: !!instanceId && instanceId !== '',
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval:false,
    refetchOnWindowFocus:false,
    refetchOnMount:false,
    refetchOnReconnect:false,
    refetchIntervalInBackground:false,
  });
};

/**
 * Hook for fetching annotation data
 */
export const useAnnotation = (annotationId: string | null) => {
  return useQuery({
    queryKey: textKeys.annotation(annotationId || "annotationId"),
    queryFn: () => annotationId ? fetchAnnotation(annotationId) : null,
    enabled: !!annotationId && annotationId !== '',
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval:false,
    refetchOnWindowFocus:false,
    refetchOnMount:false,
    refetchOnReconnect:false,
    refetchIntervalInBackground:false,
  });
};

/**
 * Hook for processing text from instance with segmentation
 */
export const useTextFromInstance = (
  instanceId: string | null,
  options: TextRetrievalOptions = {}
) => {
  const { data: instanceData, isLoading: isLoadingInstance } = useInstance(instanceId);
  
  // Get segmentation annotation ID from instance
  const segmentationAnnotationId = instanceData?.annotations && typeof instanceData.annotations === 'object' 
    ? Object.values(instanceData.annotations)
        .flat()
        .find((ann: any) => ann && typeof ann === 'object' && 'annotation_id' in ann && ann.type === 'segmentation')?.annotation_id
    : undefined;

  // Fetch segmentation data if available and requested
  const { data: segmentationData, isLoading: isLoadingAnnotation } = useAnnotation(
    options.applySegmentation !== false ? segmentationAnnotationId || null : null
  );

  return useQuery({
    queryKey: ['textFromInstance', instanceId, options, segmentationAnnotationId],
    queryFn: async (): Promise<TextRetrievalResult | null> => {
      if (!instanceData) return null;

      const baseText = instanceData.content || '';
      let content = baseText;
      let segmentAnnotations: SegmentAnnotation[] = [];
      let segmentedText: Array<{segment: SegmentAnnotation, text: string}> = [];
      const hasSegmentation = !!segmentationData && (
        Array.isArray(segmentationData) || 
        (typeof segmentationData === 'object' && 'annotation' in segmentationData)
      );
      const errors: string[] = [];

      try {
        if (hasSegmentation && options.applySegmentation !== false) {
          // Handle different annotation data structures
          let annotationArray: APISegmentationAnnotation[] = [];
          
          if (Array.isArray(segmentationData)) {
            annotationArray = segmentationData;
          } else if (segmentationData && typeof segmentationData === 'object' && 'annotation' in segmentationData) {
            const annotationData = (segmentationData as any).annotation;
            if (Array.isArray(annotationData)) {
              annotationArray = annotationData;
            }
          }
          
          if (annotationArray.length > 0) {
            // Apply segmentation to content
            content = applySegmentation(baseText, annotationArray);
            
            // Convert API segmentation to formatter's SegmentAnnotation type
            segmentAnnotations = annotationArray.map((seg: APISegmentationAnnotation, index: number) => ({
              id: seg.id || `seg-${index + 1}`,
              start: seg.span?.start || 0,
              end: seg.span?.end || 0,
              title: undefined, // Titles are added by the user in the formatter
            }));

            segmentedText = segmentAnnotations.map(segment => ({
              segment,
              text: baseText.slice(segment.start, segment.end)
            }));
          } else {
            errors.push('No valid segmentation data found in annotation');
          }
        } else {
          // If no segmentation data, treat each line as a segment
          let currentPos = 0;
          const lines = content.split('\n');
          segmentAnnotations = lines.map((line, index) => {
            const start = currentPos;
            const end = currentPos + line.length;
            currentPos = end + 1;
            return {
              id: `line-seg-${index + 1}`,
              start: start,
              end: end,
              title: undefined,
            };
          });
          
          segmentedText = segmentAnnotations.map(segment => ({
            segment,
            text: content.slice(segment.start, segment.end)
          }));
        }
      } catch (error) {
        errors.push(`Segmentation processing failed: ${error instanceof Error ? error.message : String(error)}`);
        
        // Fallback to line-based segmentation
        let currentPos = 0;
        const lines = baseText.split('\n');
        segmentAnnotations = lines.map((line, index) => {
          const start = currentPos;
          const end = currentPos + line.length;
          currentPos = end + 1;
          return {
            id: `fallback-seg-${index + 1}`,
            start: start,
            end: end,
            title: undefined,
          };
        });
        
        segmentedText = segmentAnnotations.map(segment => ({
          segment,
          text: baseText.slice(segment.start, segment.end)
        }));
      }

      return {
        instanceId: instanceId!,
        baseText,
        content,
        segmentAnnotations,
        segmentedText,
        hasSegmentation,
        errors: errors.length > 0 ? errors : undefined
      };
    },
    refetchInterval:false,
    refetchOnWindowFocus:false,
    refetchOnMount:false,
    refetchOnReconnect:false,
    refetchIntervalInBackground:false,
    enabled: !!instanceData && !isLoadingInstance && (!segmentationAnnotationId || !isLoadingAnnotation),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook for getting formatter-ready text data (alias for useTextFromInstance with formatter options)
 */
export const useFormatterText = (instanceId: string | null) => {
  return useTextFromInstance(instanceId, { 
    applySegmentation: true, 
    includeAnnotations: true, 
    processForFormatter: true 
  });
};

/**
 * Hook for managing alignment data between two instances
 */
export const useAlignmentData = (
  sourceInstanceId: string | null,
  targetInstanceId: string | null,
  _options: TextRetrievalOptions = {}
) => {
  const sourceQuery = useTextFromInstance(sourceInstanceId, _options);
  const targetQuery = useTextFromInstance(targetInstanceId, _options);

  return useQuery({
    queryKey: ['alignmentData', sourceInstanceId, targetInstanceId, _options],
    queryFn: () => {
      if (!sourceQuery.data || !targetQuery.data) return null;
      
      return {
        source: sourceQuery.data,
        target: targetQuery.data,
        isReady: true
      };
    },
    refetchInterval:false,
    refetchOnWindowFocus:false,
    refetchOnMount:false,
    refetchOnReconnect:false,
    refetchIntervalInBackground:false,
    enabled: !!sourceQuery.data && !!targetQuery.data,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook for dynamically loading text content with state management
 */
export const useTextLoader = () => {
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(null);
  const [textData, setTextData] = useState<TextRetrievalResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadText = useCallback(async (
    instanceId: string, 
    _options: TextRetrievalOptions = {}
  ) => {
    setIsLoading(true);
    setError(null);
    setCurrentInstanceId(instanceId);

    try {
      // This would need to be implemented as a direct API call
      // since we can't use hooks inside callbacks
      const instanceData = await fetchInstance(instanceId);
      const baseText = instanceData.content || '';
      
      // Basic processing without segmentation for now
      // In a real implementation, you'd want to handle segmentation here too
      const result: TextRetrievalResult = {
        instanceId,
        baseText,
        content: baseText,
        segmentAnnotations: [],
        segmentedText: [],
        hasSegmentation: false
      };
      
      setTextData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load text';
      setError(errorMessage);
      setTextData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearText = useCallback(() => {
    setTextData(null);
    setCurrentInstanceId(null);
    setError(null);
  }, []);

  return {
    currentInstanceId,
    textData,
    isLoading,
    error,
    loadText,
    clearText
  };
};

/**
 * Hook for managing formatter state with text retrieval integration
 */
export const useFormatterWithTextRetrieval = () => {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [baseText, setBaseText] = useState<string>('');
  const [segmentAnnotations, setSegmentAnnotations] = useState<SegmentAnnotation[]>([]);
  const [segmentedText, setSegmentedText] = useState<Array<{segment: SegmentAnnotation, text: string}>>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);

  // Fetch formatter-ready text when instanceId changes
  const { data: formatterData, isLoading, error } = useFormatterText(instanceId);

  // Update state when data is loaded
  useEffect(() => {
    if (formatterData) {
      setBaseText(formatterData.baseText);
      setSegmentAnnotations(formatterData.segmentAnnotations);
      setSegmentedText(formatterData.segmentedText);
    }
  }, [formatterData]);

  // Function to load text from instance
  const loadFromInstance = useCallback((newInstanceId: string) => {
    setInstanceId(newInstanceId);
    setSelectedSegments([]); // Clear selections when loading new text
  }, []);

  // Function to manually update segments (for user modifications)
  const updateSegmentAnnotations = useCallback((newSegments: SegmentAnnotation[]) => {
    setSegmentAnnotations(newSegments);
    
    // Regenerate segmented text
    const newSegmentedText = newSegments.map(segment => ({
      segment,
      text: baseText.slice(segment.start, segment.end)
    }));
    setSegmentedText(newSegmentedText);
  }, [baseText]);

  // Function to assign title to segments
  const assignTitleToSegments = useCallback((title: string, segmentIds?: string[]) => {
    const targetSegments = segmentIds || selectedSegments;
    
    setSegmentAnnotations(prev => 
      prev.map(segment => 
        targetSegments.includes(segment.id)
          ? { ...segment, title }
          : segment
      )
    );
    
    // Clear selection after assignment
    setSelectedSegments([]);
  }, [selectedSegments]);

  // Function to handle segment selection
  const handleSegmentSelect = useCallback((segmentId: string, isShiftClick?: boolean) => {
    if (isShiftClick) {
      // Toggle selection for multiple segments
      setSelectedSegments(prev => 
        prev.includes(segmentId) 
          ? prev.filter(id => id !== segmentId)
          : [...prev, segmentId]
      );
    } else {
      // Single selection
      setSelectedSegments([segmentId]);
    }
  }, []);

  return {
    // State
    instanceId,
    baseText,
    segmentAnnotations,
    segmentedText,
    selectedSegments,
    
    // Loading states
    isLoading,
    error,
    
    // Actions
    loadFromInstance,
    updateSegmentAnnotations,
    assignTitleToSegments,
    handleSegmentSelect,
    setSelectedSegments,
    
    // Raw data
    formatterData
  };
};

/**
 * Mutation hook for loading text content with error handling and caching
 */
export const useLoadTextContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (instanceId: string): Promise<{ instanceId: string; content: string }> => {
      const textInstance = await fetchInstance(instanceId);
      const content = textInstance.content || 'No content available';
      return { instanceId, content };
    },
    onSuccess: (data) => {
      // Cache the text instance data
      queryClient.setQueryData(textKeys.instance(data.instanceId), (oldData: OpenPechaTextInstance | undefined) => {
        if (oldData) return oldData;
        return {
          id: data.instanceId,
          content: data.content,
          alignment_sources: [],
          alignment_targets: [],
          alt_incipit_titles: null,
          annotations: {},
          bdrc: null,
          colophon: null,
          copyright: 'public',
          incipit_title: null,
          type: 'unknown',
          wiki: null,
        } as OpenPechaTextInstance;
      });
    },
  });
};

/**
 * Mutation hook for processing text with advanced options
 */
export const useLoadTextMutation = () => {
  return useMutation({
    mutationFn: async ({ 
      instanceId, 
      options: _options = {} 
    }: { 
      instanceId: string; 
      options?: TextRetrievalOptions 
    }) => {
      // This would need to implement the full text processing logic
      // For now, it's a basic implementation
      const instanceData = await fetchInstance(instanceId);
      const baseText = instanceData.content || '';
      
      const result: TextRetrievalResult = {
        instanceId,
        baseText,
        content: baseText,
        segmentAnnotations: [],
        segmentedText: [],
        hasSegmentation: false
      };
      
      return result;
    },
    onError: (error) => {
      console.error('Failed to load text:', error);
    }
  });
};
