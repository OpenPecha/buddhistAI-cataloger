import React from 'react';
import { useTextSelectionStore } from '../../../stores/textSelectionStore';
import { useRelatedInstances, type RelatedInstance } from '../hooks/useRelatedInstances';
import { RotateCcw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAnnotation, fetchInstance } from '../../../api/text';
import { applySegmentation, generateFileSegmentation, extractInstanceSegmentation } from '../../../lib/annotation';
import { reconstructSegments } from '../utils/generateAnnotation';
import LoadingOverlay from './LoadingOverlay';
import { CATALOGER_URL } from '../../../config';

// Interface for the API response structure
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

type ActionType = 'create-translation' | 'create-commentary' | 'align-existing' | null;

function TargetSelectionPanel() {
  const {
    sourceInstanceId,
    sourceTextId,
    targetInstanceId,
    setSourceText,
    setTargetText,
    setTargetType,
    isLoadingAnnotations,
    loadingMessage,
    setLoadingAnnotations,
    setAnnotationsApplied
  } = useTextSelectionStore();
  
  const [selectedAction, setSelectedAction] = React.useState<ActionType>(null);
  const [selectedInstanceId, setSelectedInstanceId] = React.useState<string | null>(targetInstanceId || null);
  const [selectedAnnotationId, setSelectedAnnotationId] = React.useState<string | null>(null);
  
  const [, setSearchParams] = useSearchParams();

  // Helper function to determine target type from metadata
  const determineTargetType = React.useCallback((instanceData: RelatedInstanceResponse | RelatedInstance | null): 'translation' | 'commentary' | null => {
    if (!instanceData) return null;
    
    // Check for metadata in related instance format (RelatedInstanceResponse)
    if ('metadata' in instanceData && instanceData.metadata) {
      const instanceType = instanceData.metadata.instance_type?.toLowerCase() || '';
      const relationship = instanceData.relationship?.toLowerCase() || '';
      
      // Check for commentary indicators
      if (instanceType.includes('commentary') || relationship.includes('commentary')) {
        return 'commentary';
      }
      
      // Check for translation indicators
      if (instanceType.includes('translation') || relationship.includes('translation')) {
        return 'translation';
      }
    }
    
    // Check for direct fields in RelatedInstance format
    if ('type' in instanceData && instanceData.type) {
      const instanceType = instanceData.type.toLowerCase();
      if (instanceType.includes('commentary')) {
        return 'commentary';
      }
      if (instanceType.includes('translation')) {
        return 'translation';
      }
    }
    
    // Default to translation for database texts
    return 'translation';
  }, []);

  
  // React Query hooks - Disabled automatic instance fetching
  // const { data: instanceData, isLoading: isLoadingInstance, error: instanceError } = useInstance(selectedInstanceId);
  
  // Get related instances based on source selection
  const { data: relatedInstances = [], isLoading: isLoadingRelatedInstances, error: relatedInstancesError } = useRelatedInstances(
    sourceInstanceId,
    { enabled: Boolean(sourceInstanceId) }
  );

  // Fetch alignment annotation when annotation ID is available
  const { data: alignmentAnnotation, isLoading: isLoadingAlignment, error: alignmentError } = useQuery({
    queryKey: ['alignmentAnnotation', selectedAnnotationId],
    queryFn: () => fetchAnnotation(selectedAnnotationId!),
    enabled: Boolean(selectedAnnotationId),
    refetchInterval:false,
    refetchOnWindowFocus:false,
    refetchOnMount:false,
    refetchOnReconnect:false,
    refetchIntervalInBackground:false,
  });

  // Fetch source instance content
  const { data: sourceInstanceData, isLoading: isLoadingSourceInstance } = useQuery({
    queryKey: ['sourceInstance', sourceInstanceId],
    queryFn: () => fetchInstance(sourceInstanceId!),
    enabled: Boolean(sourceInstanceId),
    refetchInterval:false,
    refetchOnWindowFocus:false,
    refetchOnMount:false,
    refetchOnReconnect:false,
    refetchIntervalInBackground:false,
  });

  // Fetch target instance content (only in related mode)
  const { data: targetInstanceData, isLoading: isLoadingTargetInstance } = useQuery({
    queryKey: ['targetInstance', selectedInstanceId],
    queryFn: () => fetchInstance(selectedInstanceId!),
    enabled: Boolean(selectedInstanceId),
    refetchInterval:false,
    refetchOnWindowFocus:false,
    refetchOnMount:false,
    refetchOnReconnect:false,
    refetchIntervalInBackground:false,
  });


  // Apply segmentation when alignment annotation and instance data are available (only in related mode)
  React.useEffect(() => {
    // Wait for both instance data to be fully loaded before processing
    if (!sourceInstanceData || !targetInstanceData || isLoadingSourceInstance || isLoadingTargetInstance) {
      console.log('⚠️ Missing instance data or still loading, skipping annotation application');
      return;
    }
  

    // Determine loading message based on whether alignment annotation exists
    const loadingMessage = alignmentAnnotation 
      ? 'Applying alignment annotations...' 
      : 'Applying instance segmentation...';
    
    console.log('🔄 Setting loading state for annotation application');
    setLoadingAnnotations(true, loadingMessage);
    
    try {
      let segmentedSourceText: string;
      let segmentedTargetText: string;
      
      console.log('🔍 Checking for alignment annotation data...');
      // Try to apply alignment annotation if available
      if (alignmentAnnotation) {
        console.log('✅ Alignment annotation found, processing...');
        const alignmentData = alignmentAnnotation as unknown as AlignmentAnnotationResponse;
        const annotationData = alignmentData.data;
        
        console.log('📋 Alignment annotation structure:', {
          id: alignmentData.id,
          type: alignmentData.type,
          hasTargetAnnotation: !!annotationData?.target_annotation,
          targetAnnotationCount: annotationData?.target_annotation?.length || 0,
          hasAlignmentAnnotation: !!annotationData?.alignment_annotation,
          alignmentAnnotationCount: annotationData?.alignment_annotation?.length || 0
        });
        
        // Validate alignment data structure
        if (annotationData?.target_annotation && Array.isArray(annotationData.target_annotation) &&
            annotationData?.alignment_annotation && Array.isArray(annotationData.alignment_annotation)) {
          
          console.log('✅ Alignment data structure validated successfully');
          console.log('📝 Target annotations:', annotationData.target_annotation.map((ann, i) => ({
            index: i,
            id: ann.id,
            span: ann.span,
            annotationIndex: ann.index
          })));
          console.log('🔗 Alignment annotations:', annotationData.alignment_annotation.map((ann, i) => ({
            index: i,
            id: ann.id,
            span: ann.span,
            annotationIndex: ann.index,
            alignmentIndex: ann.alignment_index
          })));
          
          // Reconstruct segments from alignment annotations
          const sourceContent = sourceInstanceData.content || '';
          const targetContent = targetInstanceData.content || '';
          
          console.log('🎯 Reconstructing segments from alignment annotations');
          console.log('📝 Source content length:', sourceContent.length);
          console.log('📝 Target content length:', targetContent.length);
          
          const { source, target } = reconstructSegments(
            annotationData.target_annotation,
            annotationData.alignment_annotation,
            sourceContent,
            targetContent
          );
          
          // Join segments with newlines to create segmented text
          segmentedSourceText = source.join('\n');
          segmentedTargetText = target.join('\n');
          
          console.log('✅ Segments reconstructed:', {
            sourceSegments: source.length,
            targetSegments: target.length
          });
        } else {
          console.log('❌ Invalid alignment data structure, using fallback');
          console.log('🔍 Validation details:', {
            hasTargetAnnotation: !!annotationData?.target_annotation,
            isTargetAnnotationArray: Array.isArray(annotationData?.target_annotation),
            hasAlignmentAnnotation: !!annotationData?.alignment_annotation,
            isAlignmentAnnotationArray: Array.isArray(annotationData?.alignment_annotation)
          });
          // Fallback to plain text if annotation data is invalid
          segmentedSourceText = sourceInstanceData.content || '';
          segmentedTargetText = targetInstanceData.content || '';
        }
      } else {
        console.log('⚠️ No alignment annotation available, using instance segmentation if available');
        // Third case: No alignment annotation available, use instance segmentation if available
        const sourceContent = sourceInstanceData.content || '';
        const targetContent = targetInstanceData.content || '';
        
        // Try to extract segmentation from source instance annotations
        const sourceInstanceSegmentation = extractInstanceSegmentation(sourceInstanceData.annotations);
        if (sourceInstanceSegmentation) {
          console.log('📝 Using source instance segmentation');
          segmentedSourceText = applySegmentation(sourceContent, sourceInstanceSegmentation);
        } else {
          console.log('📝 No source instance segmentation, using file segmentation fallback');
          const sourceSegmentations = generateFileSegmentation(sourceContent);
          segmentedSourceText = applySegmentation(sourceContent, sourceSegmentations);
        }
        
        // Try to extract segmentation from target instance annotations
        const targetInstanceSegmentation = extractInstanceSegmentation(targetInstanceData.annotations);
        if (targetInstanceSegmentation) {
          console.log('📝 Using target instance segmentation');
          segmentedTargetText = applySegmentation(targetContent, targetInstanceSegmentation);
        } else {
          console.log('📝 No target instance segmentation, using file segmentation fallback');
          const targetSegmentations = generateFileSegmentation(targetContent);
          segmentedTargetText = applySegmentation(targetContent, targetSegmentations);
        }
        
        console.log('📊 Segmentation results:', {
          sourceHasInstanceSegmentation: !!sourceInstanceSegmentation,
          targetHasInstanceSegmentation: !!targetInstanceSegmentation,
          sourceLinesAfterSegmentation: segmentedSourceText.split('\n').length,
          targetLinesAfterSegmentation: segmentedTargetText.split('\n').length
        });
      }
      
      console.log('💾 Updating text store with segmented content...');
      console.log('📊 Final segmentation results:', {
        sourceTextLength: segmentedSourceText.length,
        targetTextLength: segmentedTargetText.length,
        sourceLinesCount: segmentedSourceText.split('\n').length,
        targetLinesCount: segmentedTargetText.split('\n').length
      });
      
      // Update the store with texts (preserve original sourceTextId)
      console.log('🔄 Setting source text in store');
      setSourceText(
        sourceTextId || sourceInstanceData.id || 'source-instance',
        sourceInstanceId!,
        segmentedSourceText,
        'database'
      );
      
      console.log('🔄 Setting target text in store');
      setTargetText(
        `related-${selectedInstanceId}`,
        selectedInstanceId!,
        segmentedTargetText,
        'database'
      );
      
      // Determine and set target type based on metadata
      const selectedInstance = relatedInstances.find(instance => 
        (instance.instance_id || instance.id) === selectedInstanceId
      );
      const targetType = determineTargetType(selectedInstance || null);
      console.log('🏷️ Determined target type:', targetType);
      setTargetType(targetType);
      
      // Update URL parameters for target selection - only use t_id
      console.log('🔗 Updating URL parameters');
      setSearchParams((prev) => {
        prev.set('t_id', selectedInstanceId!);
        // Remove old params if they exist
        prev.delete('tTextId');
        prev.delete('tInstanceId');
        return prev;
      });
      
      // Mark annotations as applied
      console.log('✅ Marking annotations as applied');
      setAnnotationsApplied(true);
      
      console.log('🎉 Annotation application completed successfully!');
      
    } catch (error) {
      console.error('❌ Error applying alignment annotations:', error);
      console.error('🔍 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      console.log('🔄 Falling back to error recovery');
      setLoadingAnnotations(false);
      setAnnotationsApplied(true);
    }
  }, [alignmentAnnotation, sourceInstanceData, targetInstanceData, isLoadingSourceInstance, isLoadingTargetInstance, sourceInstanceId, sourceTextId, selectedInstanceId, setSourceText, setTargetText, setTargetType, setSearchParams, relatedInstances, determineTargetType, setLoadingAnnotations, setAnnotationsApplied]);
  
  // Load source text without segmentation when no target is selected or in empty mode
  React.useEffect(() => {
    if (!sourceInstanceData || !sourceInstanceId) return;
    
    // Only load source text without segmentation if:
    // 1. We're in empty mode, OR
    // 2. No target is selected (no alignment annotations will be applied)
    const shouldLoadPlainSource = !selectedInstanceId;
    
    if (shouldLoadPlainSource) {
      const sourceContent = sourceInstanceData.content || '';
      setSourceText(
        sourceTextId || sourceInstanceData.id || 'source-instance',
        sourceInstanceId,
        sourceContent, // No segmentation applied
        'database'
      );
    }
  }, [sourceInstanceData, sourceInstanceId, sourceTextId, selectedInstanceId, setSourceText]);
  
  
  // Available instances are the related instances
  const availableInstances = React.useMemo(() => {
    return Array.isArray(relatedInstances) ? relatedInstances : [];
  }, [relatedInstances]);

  // Sync local state with store state
  React.useEffect(() => {
    setSelectedInstanceId(targetInstanceId || null);
    // If target instance is already selected, set action to align-existing
    if (targetInstanceId) {
      setSelectedAction('align-existing');
    }
  }, [targetInstanceId]);

  // Handle action selection
  const handleActionSelection = React.useCallback((action: ActionType) => {
    setSelectedAction(action);
    
    if (action === 'create-translation' || action === 'create-commentary') {
      // Open cataloger in new tab
      const url = `${CATALOGER_URL}?sourceTextId=${sourceTextId}&sourceInstanceId=${sourceInstanceId}`;
      window.open(url, '_blank');
      // Reset action after opening
      setSelectedAction(null);
    }
  }, [sourceTextId, sourceInstanceId]);

 

  // Handle instance selection from dropdown
  const handleInstanceSelection = React.useCallback((instanceId: string) => {
    if (!instanceId) {
      setSelectedInstanceId(null);
      setSelectedAnnotationId(null);
      return;
    }
    
    // Find the selected instance from the related instances
    const selectedInstance = relatedInstances.find(instance => 
      (instance.instance_id || instance.id) === instanceId
    );
    
    if (selectedInstance) {
      // Get the annotation ID from the response data
      const annotationId = (selectedInstance as RelatedInstanceResponse).annotation || 
                          selectedInstance.annotations?.[0]?.annotation_id;
      // Set the annotation ID which will trigger the React Query to fetch alignment annotation
      setSelectedAnnotationId(annotationId || null);
    }
    
    setSelectedInstanceId(instanceId);
    
    // Update URL parameters - only use t_id
    setSearchParams((prev) => {
      prev.set('t_id', instanceId);
      // Remove old params if they exist
      prev.delete('tTextId');
      prev.delete('tInstanceId');
      return prev;
    });
  }, [relatedInstances, setSearchParams]);


  // Handle reset - clear target selection
  const handleReset = React.useCallback(() => {
    const { clearTargetSelection } = useTextSelectionStore.getState();
    clearTargetSelection();
    
    // Also clear local state
    setSelectedInstanceId(null);
    setSelectedAnnotationId(null);
    setSelectedAction(null);
    
    // Clear URL parameters for target
    setSearchParams((prev) => {
      prev.delete('t_id');
      prev.delete('tTextId');
      prev.delete('tInstanceId');
      return prev;
    });
  }, [setSearchParams]);

  return (
    <div className="h-full flex flex-col bg-gray-50 border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Target Text
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {(() => {
                if (!sourceInstanceId) {
                  return 'Please select a source text first to see related target instances';
                } else if (sourceInstanceId && !targetInstanceId) {
                  return 'Select from related instances based on your source text';
                } else {
                  return 'Target text selected from related instances';
                }
              })()}
            </p>
          </div>
          
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        {!sourceInstanceId ? (
          /* Disabled state message when no source is selected */
          <div className="space-y-2">
            <div className="p-4 bg-gray-100 border border-gray-300 rounded-md">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-sm text-gray-600">
                  Please select a source text and instance first
                </p>
              </div>
            </div>
          </div>
        ) : !selectedAction ? (
          /* Action Selection Step */
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                What would you like to do?
              </h4>
              <p className="text-sm text-gray-600">
                Choose an action for the selected text and instance
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {/* Create Translation Option */}
              <button
                onClick={() => handleActionSelection('create-translation')}
                className="p-6 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors text-left"
              >
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-blue-600 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-blue-900 mb-2">Create New Translation</h4>
                    <p className="text-sm text-blue-700">
                      Create a new translation for this text. This will open the cataloger tool in a new tab.
                    </p>
                  </div>
                </div>
              </button>

              {/* Create Commentary Option */}
              <button
                onClick={() => handleActionSelection('create-commentary')}
                className="p-6 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-colors text-left"
              >
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-green-600 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-green-900 mb-2">Create New Commentary</h4>
                    <p className="text-sm text-green-700">
                      Create a new commentary for this text. This will open the cataloger tool in a new tab.
                    </p>
                  </div>
                </div>
              </button>

              {/* Align Existing Text Option */}
              <button
                onClick={() => handleActionSelection('align-existing')}
                className="p-6 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 hover:border-purple-300 transition-colors text-left"
              >
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-purple-600 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-purple-900 mb-2">Align Existing Text</h4>
                    <p className="text-sm text-purple-700">
                      Align this text with an already created translation or commentary.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        ) : selectedAction === 'align-existing' ? (
          /* Related Target Instances Selection */
          <div className="space-y-4">
            {/* Back button to return to action selection */}
            <button
              onClick={() => {
                setSelectedAction(null);
                setSelectedInstanceId(null);
                setSelectedAnnotationId(null);
              }}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to options</span>
            </button>

            <div className="space-y-2">
              <label htmlFor="target-instance-select" className="block text-sm font-medium text-gray-700">
                Select Related Instance
              </label>
              <select
                id="target-instance-select"
                value={selectedInstanceId || ""}
                onChange={(e) => handleInstanceSelection(e.target.value)}
                disabled={isLoadingRelatedInstances}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
              <option value="">
                {(() => {
                  if (isLoadingRelatedInstances) return 'Loading related instances...';
                  if (relatedInstancesError) return 'Error loading related instances';
                  if (availableInstances?.length === 0) return 'No related instances found';
                  return 'Choose a related instance...';
                })()}
              </option>
              {availableInstances.map((instance) => {
                if (!instance) return null;
                
                // Handle both API response formats
                const instanceId = instance.instance_id || instance.id;
                const isNewFormat = 'instance_id' in instance && 'metadata' in instance;
                
                let title: string;
                let instanceType: string;
                let language: string;
                let relationship: string;
                
                if (isNewFormat) {
                  const apiInstance = instance as RelatedInstanceResponse;
                  const titleObj = apiInstance.metadata.title;
                  const firstTitleKey = titleObj ? Object.keys(titleObj)[0] : undefined;
                  title = (firstTitleKey && titleObj[firstTitleKey]) || `Instance ${instanceId}`;
                  instanceType = apiInstance.metadata.instance_type || 'Instance';
                  language = apiInstance.metadata.language ? ` (${apiInstance.metadata.language})` : '';
                  relationship = apiInstance.relationship ? ` [${apiInstance.relationship}]` : '';
                } else {
                  // Fallback to old format
                  const titleObj = instance.incipit_title;
                  const altTitlesObj = instance.alt_incipit_titles;
                  const firstTitleKey = titleObj ? Object.keys(titleObj)[0] : undefined;
                  const firstAltTitleKey = altTitlesObj ? Object.keys(altTitlesObj)[0] : undefined;
                  
                  title = (firstTitleKey && titleObj?.[firstTitleKey]) || 
                         (firstAltTitleKey && altTitlesObj?.[firstAltTitleKey]) || 
                         `Instance ${instanceId}`;
                  instanceType = instance.type || 'Instance';
                  language = '';
                  relationship = '';
                }

                return (
                  <option key={instanceId} value={instanceId}>
                    {instanceType} - {title}{language}{relationship}
                  </option>
                );
              })}
            </select>
            
            {relatedInstancesError && (
              <p className="text-sm text-red-600">
                Failed to load related instances: {relatedInstancesError.message}
              </p>
            )}
            {/* Loading indicators */}
            {(isLoadingAlignment || isLoadingSourceInstance || isLoadingTargetInstance) && selectedAnnotationId && (
              <div className="space-y-2">
                {isLoadingAlignment && (
                  <div className="flex items-center space-x-2 text-sm text-blue-600">
                    <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Fetching alignment annotation...</span>
                  </div>
                )}
                {isLoadingSourceInstance && (
                  <div className="flex items-center space-x-2 text-sm text-blue-600">
                    <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Fetching source text content...</span>
                  </div>
                )}
                {isLoadingTargetInstance && (
                  <div className="flex items-center space-x-2 text-sm text-blue-600">
                    <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Fetching target text content...</span>
                  </div>
                )}
              </div>
            )}
            {alignmentError && (
              <p className="text-sm text-red-600">
                Failed to load alignment annotation: {alignmentError.message}
              </p>
            )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Loading Overlay */}
      <LoadingOverlay 
        isVisible={isLoadingAnnotations} 
        message={loadingMessage || 'Processing annotations...'} 
      />
    </div>
  );
}

export default TargetSelectionPanel;
