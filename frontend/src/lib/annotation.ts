export function getAnnotation (text: string){
    const segments = [];
    let pos = 0;
    const lines = text.split('\n');
    for (const line of lines) {
        const start = pos;
        const end = pos + line.length;
        segments.push({
            start,
            end,
            text: line
        });
        // Account for newline character not included in line
        pos = end + 1;
    }
    return segments;
}

/**
 * Apply segmentation annotations to text content
 * @param text - Original text content
 * @param segmentations - Array of segmentation annotations with span information
 * @returns Segmented text with separators between segments
 */
export function applySegmentation(text: string, segmentations: Array<{span: {start: number, end: number}}>): string {
    
    if (!text) {
        console.log('⚠️ applySegmentation: No text provided, returning empty string');
        return '';
    }
    
    if (!segmentations || segmentations.length === 0) {
        console.log('⚠️ applySegmentation: No segmentations provided, returning original text');
        return text;
    }

    console.log('🔍 Segmentations to apply:', segmentations.map((seg, i) => ({
        index: i,
        start: seg.span?.start,
        end: seg.span?.end,
        length: seg.span ? seg.span.end - seg.span.start : 0,
        text: seg.span ? text.substring(seg.span.start, seg.span.end) : 'invalid'
    })));

    // // Validate segmentations structure
    // console.log('✅ Validating segmentation structure...');
    // for (let i = 0; i < segmentations.length; i++) {
    //     const seg = segmentations[i];
    //     if (!seg || !seg.span || typeof seg.span.start !== 'number' || typeof seg.span.end !== 'number') {
    //         const error = `Invalid segmentation structure at index ${i}: expected {span: {start: number, end: number}}`;
    //         console.error('❌ Validation error:', error);
    //         throw new Error(error);
    //     }
        
    //     if (seg.span.start < 0 || seg.span.end < seg.span.start || seg.span.end > text.length) {
    //         const error = `Invalid span range at index ${i}: start=${seg.span.start}, end=${seg.span.end}, text length=${text.length}`;
    //         console.error('❌ Range validation error:', error);
    //         throw new Error(error);
    //     }
    // }
    // console.log('✅ All segmentations validated successfully');

    // Sort segmentations by start position
    const sortedSegmentations = [...segmentations].sort((a, b) => a.span.start - b.span.start);
 

    // Build the result by inserting newlines at segment boundaries
    let result = '';
    let lastEnd = 0;

    for (let i = 0; i < sortedSegmentations.length; i++) {
        const seg = sortedSegmentations[i];
        
    
        
        // Add text from lastEnd to the start of this segment
        const gapText = text.substring(lastEnd, seg.span.start);
        if (gapText) {
            result += gapText;
        }
        
        // Add newline BEFORE the segment (but not for the first segment, unless it's at position 0)
        if (i > 0 || seg.span.start > 0) {
            result += '\n';
        }
        
        // Add the segment itself
        const segmentText = text.substring(seg.span.start, seg.span.end);
        result += segmentText;
        
        lastEnd = seg.span.end;
    }

    // Add any remaining text after the last segment
    if (lastEnd < text.length) {
        const remainingText = text.substring(lastEnd);
        result += remainingText;
    }

    return result;
}

/**
 * Generate segmentation annotations from text file content using newlines as segment boundaries
 * @param text - Raw text content from uploaded file
 * @returns Array of segmentation annotations based on line breaks
 */
export function generateFileSegmentation(text: string): Array<{span: {start: number, end: number}}> {
    const segments = [];
    let pos = 0;
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip empty lines but still account for their position
        if (line.trim().length > 0) {
            segments.push({
                span: {
                    start: pos,
                    end: pos + line.length
                }
            });
        }
        // Move position past the line and newline character
        pos += line.length + 1; // +1 for the newline character
    }
    
    return segments;
}

/**
 * Extract segmentation annotations from instance annotations
 * @param annotations - Instance annotations object
 * @returns Array of segmentation annotations with span information, or null if not found
 */
export function extractInstanceSegmentation(annotations: { [key: string]: unknown[] } | null | undefined): Array<{span: {start: number, end: number}}> | null {
    if (!annotations || typeof annotations !== 'object') {
        return null;
    }

    // Look for segmentation annotations
    const segmentationKey = Object.keys(annotations).find(key => 
        key.includes('segmentation') || key.includes('segment')
    );

    if (!segmentationKey || !Array.isArray(annotations[segmentationKey])) {
        return null;
    }

    const rawSegmentations = annotations[segmentationKey] as unknown[];
    
    // Validate and convert segmentation data
    const segmentations = rawSegmentations
        .filter((seg): seg is {span: {start: number, end: number}} => {
            if (!seg || typeof seg !== 'object') return false;
            const segObj = seg as any;
            return 'span' in segObj && 
                   typeof segObj.span === 'object' &&
                   typeof segObj.span.start === 'number' &&
                   typeof segObj.span.end === 'number';
        });

    return segmentations.length > 0 ? segmentations : null;
}