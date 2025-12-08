import { fetchInstance } from '../api/text';
import { applySegmentation } from './annotation';
import type { OpenPechaTextInstance, SegmentationAnnotation } from '../types/text';
import type { SegmentAnnotation } from '../components/Formatter/types';

/**
 * Options for text retrieval
 */
export interface TextRetrievalOptions {
  /** Whether to apply segmentation annotations */
  applySegmentation?: boolean;
  /** Whether to include alignment data */
  includeAlignment?: boolean;
  /** Custom segmentation format for the formatter */
  useFormatterSegments?: boolean;
}

/**
 * Result of text retrieval with metadata
 */
export interface TextRetrievalResult {
  /** The processed text content */
  content: string;
  /** Original instance data */
  instance: OpenPechaTextInstance;
  /** Segmentation annotations if available */
  segmentations?: SegmentationAnnotation[];
  /** Formatter-compatible segment annotations */
  formatterSegments?: SegmentAnnotation[];
  /** Alignment sources */
  alignmentSources?: string[];
  /** Alignment targets */
  alignmentTargets?: string[];
  /** Any processing errors */
  errors?: string[];
}

/**
 * Get text content from instance with optional segmentation and alignment processing
 * @param instanceId - The instance ID to fetch
 * @param options - Configuration options for text processing
 * @returns Promise with processed text and metadata
 */
export async function getTextFromInstance(
  instanceId: string,
  options: TextRetrievalOptions = {}
): Promise<TextRetrievalResult> {
  const {
    applySegmentation: shouldApplySegmentation = true,
    includeAlignment = true,
    useFormatterSegments = false
  } = options;

  const errors: string[] = [];
  let segmentations: SegmentationAnnotation[] | undefined;
  let formatterSegments: SegmentAnnotation[] | undefined;

  try {
    // Fetch the instance data
    const instance = await fetchInstance(instanceId);
    
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    // Get base content
    let content = instance.content || '';
    
    if (!content) {
      errors.push('No content found in instance');
      content = 'No content available';
    }

    // Process segmentation annotations if available and requested
    if (shouldApplySegmentation && instance.annotations) {
      try {
        // Look for segmentation annotations
        const segmentationKey = Object.keys(instance.annotations).find(key => 
          key.includes('segmentation') || key.includes('segment')
        );

        if (segmentationKey && Array.isArray(instance.annotations[segmentationKey])) {
          const rawSegmentations = instance.annotations[segmentationKey] as unknown[];
          
          // Validate and convert segmentation data
          segmentations = rawSegmentations
            .filter((seg): seg is SegmentationAnnotation => {
              if (!seg || typeof seg !== 'object') return false;
              const segObj = seg as any;
              return 'span' in segObj && 
                     typeof segObj.span === 'object' &&
                     typeof segObj.span.start === 'number' &&
                     typeof segObj.span.end === 'number';
            })
            .map(seg => seg as SegmentationAnnotation);

          if (segmentations.length > 0) {
            // Apply segmentation to content
            content = applySegmentation(content, segmentations);

            // Convert to formatter segments if requested
            if (useFormatterSegments) {
              formatterSegments = segmentations.map((seg, index) => ({
                id: `seg_${index + 1}`,
                start: seg.span.start,
                end: seg.span.end,
                // title can be added later by user
              }));
            }
          }
        }
      } catch (segError) {
        errors.push(`Error processing segmentation: ${segError instanceof Error ? segError.message : 'Unknown error'}`);
      }
    }

    // Prepare alignment data if requested
    const alignmentSources = includeAlignment ? instance.alignment_sources : undefined;
    const alignmentTargets = includeAlignment ? instance.alignment_targets : undefined;

    return {
      content,
      instance,
      segmentations,
      formatterSegments,
      alignmentSources,
      alignmentTargets,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    errors.push(`Failed to fetch instance: ${errorMessage}`);
    
    // Return minimal result with error
    return {
      content: 'Failed to load content',
      instance: {} as OpenPechaTextInstance,
      errors
    };
  }
}

/**
 * Get text content from multiple instances for alignment comparison
 * @param instanceIds - Array of instance IDs to fetch
 * @param options - Configuration options for text processing
 * @returns Promise with array of text retrieval results
 */
export async function getTextFromMultipleInstances(
  instanceIds: string[],
  options: TextRetrievalOptions = {}
): Promise<TextRetrievalResult[]> {
  const results = await Promise.allSettled(
    instanceIds.map(id => getTextFromInstance(id, options))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        content: 'Failed to load content',
        instance: {} as OpenPechaTextInstance,
        errors: [`Failed to fetch instance ${instanceIds[index]}: ${result.reason}`]
      };
    }
  });
}

/**
 * Get alignment data between source and target instances
 * @param sourceInstanceId - Source instance ID
 * @param targetInstanceId - Target instance ID
 * @param options - Configuration options
 * @returns Promise with alignment comparison data
 */
export async function getAlignmentData(
  sourceInstanceId: string,
  targetInstanceId: string,
  options: TextRetrievalOptions = {}
): Promise<{
  source: TextRetrievalResult;
  target: TextRetrievalResult;
  alignmentMapping?: Array<{
    sourceSegment: number;
    targetSegment: number;
    confidence?: number;
  }>;
}> {
  const [source, target] = await getTextFromMultipleInstances(
    [sourceInstanceId, targetInstanceId],
    { ...options, includeAlignment: true }
  );

  // TODO: Implement alignment mapping logic based on alignment_sources and alignment_targets
  // This would require additional API calls or processing logic
  
  return {
    source,
    target,
    // alignmentMapping can be populated with actual alignment data
  };
}

/**
 * Convert segmentation annotations to formatter-compatible segments
 * @param segmentations - Original segmentation annotations
 * @param baseText - The base text content
 * @returns Array of formatter-compatible segment annotations
 */
export function convertToFormatterSegments(
  segmentations: SegmentationAnnotation[],
  baseText: string
): SegmentAnnotation[] {
  return segmentations.map((seg, index) => ({
    id: `seg_${index + 1}`,
    start: seg.span.start,
    end: seg.span.end,
    // Validate that the segment is within text bounds
    ...(seg.span.end <= baseText.length ? {} : { 
      end: Math.min(seg.span.end, baseText.length) 
    })
  }));
}

/**
 * Extract text segments from content using segment annotations
 * @param content - The full text content
 * @param segments - Segment annotations
 * @returns Array of text segments with metadata
 */
export function extractTextSegments(
  content: string,
  segments: SegmentAnnotation[]
): Array<{segment: SegmentAnnotation, text: string}> {
  return segments.map(segment => ({
    segment,
    text: content.slice(segment.start, segment.end)
  }));
}

/**
 * Utility function to get formatted text ready for the Formatter component
 * @param instanceId - Instance ID to fetch
 * @returns Promise with formatter-ready data
 */
export async function getFormatterReadyText(instanceId: string): Promise<{
  baseText: string;
  segmentAnnotations: SegmentAnnotation[];
  segmentedText: Array<{segment: SegmentAnnotation, text: string}>;
  errors?: string[];
}> {
  const result = await getTextFromInstance(instanceId, {
    applySegmentation: false, // We'll handle segmentation manually
    useFormatterSegments: true,
    includeAlignment: false
  });

  const baseText = result.instance.content || '';
  const segmentAnnotations = result.formatterSegments || [];
  const segmentedText = extractTextSegments(baseText, segmentAnnotations);

  return {
    baseText,
    segmentAnnotations,
    segmentedText,
    errors: result.errors
  };
}
