import type { SentenceMapping } from '../context/types';

// Generate a unique ID for annotations
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

export interface PublishData {
  language: string;
  content: string;
  title: string;
  author: {
    person_bdrc_id: string;
  };
  category_id: string;
  segmentation: Array<{
    span: {
      start: number;
      end: number;
    };
  }>;
  target_annotation: Array<{
    id: string;
    span: {
      start: number;
      end: number;
    };
    index: number;
  }>;
  alignment_annotation: Array<{
    id: string;
    span: {
      start: number;
      end: number;
    };
    index: number;
    alignment_index: number[];
  }>;
  copyright: string;
}

export interface PublishMetadata {
  title: string;
  language: string;
  author: {
    person_bdrc_id: string;
  };
  category_id: string;
  copyright: string;
}

/**
 * Transform SentenceMapping[] to API format for publishing
 * @param mappings - Array of sentence mappings from the editor
 * @param targetContent - The target text content
 * @param metadata - Publication metadata (title, author, etc.)
 * @returns Transformed data ready for API submission
 */
export const transformMappingsToAPI = (
  mappings: SentenceMapping[],
  targetContent: string,
  metadata: PublishMetadata
): PublishData => {
  // Separate all mappings into source and target segments
  const allSourceSegments = mappings.filter(
    m => m.source.start !== -1 && m.source.end !== -1
  );
  
  const allTargetSegments = mappings.filter(
    m => m.target.start !== -1 && m.target.end !== -1
  );

  // Validation: Target cannot have more segments than source
  if (allTargetSegments.length > allSourceSegments.length) {
    throw new Error(`Target cannot have more segments than source. Target has ${allTargetSegments.length} segments, but source only has ${allSourceSegments.length} segments.`);
  }

  // Filter mappings that have both valid source and target (aligned mappings)
  const alignedMappings = mappings.filter(
    m => m.source.start !== -1 && m.source.end !== -1 && 
         m.target.start !== -1 && m.target.end !== -1
  );

  // Create segmentation array from all source segments
  const segmentation = allSourceSegments.map(mapping => ({
    span: {
      start: mapping.source.start,
      end: mapping.source.end
    }
  }));

  // Create target_annotation array from all source segments with sequential indices
  const target_annotation = allSourceSegments.map((mapping, index) => ({
    id: generateId(),
    span: {
      start: mapping.source.start,
      end: mapping.source.end
    },
    index
  }));


  // Create alignment_annotation array only for aligned mappings
  const alignment_annotation = alignedMappings.map((mapping) => {
    // Find the index of this source segment in the segmentation array
    const sourceIndex = allSourceSegments.findIndex(
      seg => seg.source.start === mapping.source.start && seg.source.end === mapping.source.end
    );
    
    // alignment_index should match the source index for this alignment pattern
    const targetAlignmentIndex = sourceIndex;

    return {
      id: generateId(),
      span: {
        start: mapping.target.start,  // Use TARGET span for alignment_annotation
        end: mapping.target.end
      },
      index: sourceIndex,
      alignment_index: [targetAlignmentIndex]
    };
  });

  const contentWithoutNewlines = targetContent.replaceAll('\n', '');
  return {
    language: metadata.language,
    content: contentWithoutNewlines,
    title: metadata.title,
    author: metadata.author,
    category_id: metadata.category_id,
    segmentation,
    target_annotation,
    alignment_annotation,
    copyright: metadata.copyright
  };
};

/**
 * Validate mappings and content before publishing
 * @param mappings - Array of sentence mappings
 * @param sourceContent - Source text content
 * @param targetContent - Target text content
 * @returns Validation result with error message if invalid
 */
export const validatePublishData = (
  mappings: SentenceMapping[],
  sourceContent: string | null,
  targetContent: string | null
): { isValid: boolean; error?: string } => {
  if (!sourceContent || sourceContent.trim().length === 0) {
    return { isValid: false, error: 'Source content is required' };
  }

  if (!targetContent || targetContent.trim().length === 0) {
    return { isValid: false, error: 'Target content is required' };
  }

  if (!mappings || mappings.length === 0) {
    return { isValid: false, error: 'At least one mapping is required' };
  }

  // Check if there are any valid mappings (non-empty)
  const validMappings = mappings.filter(
    m => m.source.start !== -1 && m.source.end !== -1 && 
         m.target.start !== -1 && m.target.end !== -1
  );

  if (validMappings.length === 0) {
    return { isValid: false, error: 'At least one valid mapping is required' };
  }

  // Validate segment counts: Target cannot have more segments than source
  const sourceSegments = mappings.filter(m => m.source.start !== -1 && m.source.end !== -1);
  const targetSegments = mappings.filter(m => m.target.start !== -1 && m.target.end !== -1);
  
  if (targetSegments.length > sourceSegments.length) {
    return { 
      isValid: false, 
      error: `Target cannot have more segments than source. Target has ${targetSegments.length} segments, but source only has ${sourceSegments.length} segments.` 
    };
  }

  return { isValid: true };
};

/**
 * Get summary statistics for mappings
 * @param mappings - Array of sentence mappings
 * @returns Summary statistics
 */
export const getMappingsSummary = (mappings: SentenceMapping[]) => {
  const validMappings = mappings.filter(
    m => m.source.start !== -1 && m.source.end !== -1 && 
         m.target.start !== -1 && m.target.end !== -1
  );

  const emptySourceMappings = mappings.filter(m => m.source.start === -1).length;
  const emptyTargetMappings = mappings.filter(m => m.target.start === -1).length;

  return {
    totalMappings: mappings.length,
    validMappings: validMappings.length,
    emptySourceMappings,
    emptyTargetMappings
  };
};
