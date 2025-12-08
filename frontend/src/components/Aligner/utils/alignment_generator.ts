type Annotation = {
    index: string;
    span: { start: number; end: number };
};

export type AlignmentData = {
    type: "alignment";
    target_annotation: (Annotation | null)[];
    alignment_annotation: (Annotation | null)[];
};

function cleaned_alignments(alignmentData: AlignmentData) {
    const targets = alignmentData.target_annotation;
    const alignments = alignmentData.alignment_annotation;
    const cleaned_target_annotations: Annotation[] = [];
    const cleaned_alignment_annotations: Annotation[] = [];
    const target_length = targets.length;
    const alignment_length = alignments.length;
    const loop_length = Math.max(target_length, alignment_length);

    for(let i = 0; i < loop_length+1; i++) {
        const target = targets[i];
        const alignment = alignments[i];
        
        // Skip if both are null/undefined
        if (!target && !alignment) continue;
        
        // Handle cases where one or both annotations exist
        // Include empty lines (where start === end) to preserve alignment structure
        // Include if:
        // 1. Both have content (non-empty)
        // 2. One is empty and the other has content (preserve empty line alignment)
        // 3. Both are empty (preserve empty-to-empty alignment)
        if (target && alignment) {
            // Both exist - include them (preserving empty lines)
            cleaned_target_annotations.push(target);
            cleaned_alignment_annotations.push(alignment);
        } else if (target && !alignment) {
            // Only target exists - include it with a null alignment (or create empty alignment)
            cleaned_target_annotations.push(target);
            // Create an empty alignment annotation to maintain structure
            cleaned_alignment_annotations.push({
                index: target.index,
                span: { start: target.span.start, end: target.span.start } // Empty span
            });
        } else if (!target && alignment) {
            // Only alignment exists - include it with a null target (or create empty target)
            cleaned_alignment_annotations.push(alignment);
            // Create an empty target annotation to maintain structure
            cleaned_target_annotations.push({
                index: alignment.index,
                span: { start: alignment.span.start, end: alignment.span.start } // Empty span
            });
        }
    }

    const cleaned_alignments_result: AlignmentData = {
        type: "alignment",
        target_annotation: cleaned_target_annotations,
        alignment_annotation: cleaned_alignment_annotations
    }
    
    
    return cleaned_alignments_result;
}

function reverse_cleaned_alignments(cleanedAlignments: AlignmentData) {
    const cleaned_targets = cleanedAlignments.target_annotation;
    const cleaned_alignments_array = cleanedAlignments.alignment_annotation;
    
    // Helper function to check if a string index is numeric (can be used as array index)
    const isNumericIndex = (index: string): boolean => {
        return /^\d+$/.test(index);
    };
    
    // Helper function to safely parse string index to number for array positioning
    const parseIndexToNumber = (index: string): number | null => {
        if (!isNumericIndex(index)) return null;
        const parsed = Number.parseInt(index, 10);
        return Number.isNaN(parsed) ? null : parsed;
    };
    
    // Check if we have numeric string indices (e.g., "0", "1", "2") or UUIDs
    const hasNumericIndices = cleaned_targets.length > 0 && 
        cleaned_targets[0] !== null && 
        cleaned_targets[0].index !== undefined &&
        isNumericIndex(cleaned_targets[0].index);
    
    if (hasNumericIndices) {
        // Handle numeric string indices (e.g., "0", "1", "2")
        let maxTargetIndex = -1;
        let maxAlignmentIndex = -1;
        
        // Find maximum indices (keeping index as string, parsing only for comparison)
        for (const target of cleaned_targets) {
            if (!target || !target.index) continue;
            const idx = parseIndexToNumber(target.index);
            if (idx !== null && idx > maxTargetIndex) maxTargetIndex = idx;
        }
        
        for (const alignment of cleaned_alignments_array) {
            if (!alignment || !alignment.index) continue;
            const idx = parseIndexToNumber(alignment.index);
            if (idx !== null && idx > maxAlignmentIndex) maxAlignmentIndex = idx;
        }
        
        // Create arrays with appropriate size (using max index + 1 to account for 0-based indexing)
        const target_length = maxTargetIndex + 1;
        const alignment_length = maxAlignmentIndex + 1;
        const loop_length = Math.max(target_length, alignment_length);
        
        const reconstructed_targets = new Array<Annotation | null>(loop_length).fill(null);
        const reconstructed_alignments = new Array<Annotation | null>(loop_length).fill(null);
        
        // Place items at their original index positions (index remains string in Annotation)
        for (const target of cleaned_targets) {
            if (!target || !target.index) continue;
            const idx = parseIndexToNumber(target.index);
            if (idx !== null && idx >= 0 && idx < loop_length) {
                reconstructed_targets[idx] = target; // target.index is still a string
            }
        }
        
        for (const alignment of cleaned_alignments_array) {
            if (!alignment || !alignment.index) continue;
            const idx = parseIndexToNumber(alignment.index);
            if (idx !== null && idx >= 0 && idx < loop_length) {
                reconstructed_alignments[idx] = alignment; // alignment.index is still a string
            }
        }
        
        // Create the reconstructed input structure
        const reconstructedInput: AlignmentData = {
            type: "alignment",
            target_annotation: reconstructed_targets,
            alignment_annotation: reconstructed_alignments
        };
        
        return reconstructedInput;
    } else {
        // For UUID or non-numeric string indices, or missing index field,
        // we need to fill gaps in spans with null entries.
        // We'll insert null entries where there are gaps in the alignment_annotation spans.
        const reconstructed_targets: (Annotation | null)[] = [];
        const reconstructed_alignments: (Annotation | null)[] = [];
        
        // Process alignment_annotation to detect span gaps and insert nulls
        // We preserve the pairing order from cleaned arrays while detecting gaps
        let lastAlignmentEnd = 0;
        
        for (let i = 0; i < cleaned_alignments_array.length; i++) {
            const alignment = cleaned_alignments_array[i];
            const target = cleaned_targets[i];
            
            if (alignment) {
                // Check if there's a gap before this alignment
                if (alignment.span.start > lastAlignmentEnd) {
                    // Insert null entries for the gap in both arrays to maintain pairing
                    reconstructed_targets.push(null);
                    reconstructed_alignments.push(null);
                }
                
                // Add the current alignment and its paired target
                reconstructed_alignments.push(alignment);
                reconstructed_targets.push(target || null);
                
                lastAlignmentEnd = alignment.span.end;
            } else if (target) {
                // Only target exists, add it with null alignment
                reconstructed_targets.push(target);
                reconstructed_alignments.push(null);
            }
        }
        
        // Ensure both arrays have the same length
        const maxLength = Math.max(reconstructed_targets.length, reconstructed_alignments.length);
        while (reconstructed_targets.length < maxLength) {
            reconstructed_targets.push(null);
        }
        while (reconstructed_alignments.length < maxLength) {
            reconstructed_alignments.push(null);
        }
        
        const reconstructedInput: AlignmentData = {
            type: "alignment",
            target_annotation: reconstructed_targets,
            alignment_annotation: reconstructed_alignments
        };
        
        return reconstructedInput;
    }
}


function populateMissingSpans(alignments: AlignmentData) {
    // Extended annotation type that includes id
    type AnnotationWithId = Annotation & { id?: string | null; aligned_segments?: string[] };
    type AlignmentDataWithId = {
        type: "alignment";
        target_annotation: (AnnotationWithId | null)[];
        alignment_annotation: (AnnotationWithId | null)[];
    };
    
    // Create a copy of the alignments object
    const result = JSON.parse(JSON.stringify(alignments)) as AlignmentDataWithId;
    
    // Process target_annotation - insert entries with id: null and spans for gaps between siblings
    if (result.target_annotation && result.target_annotation.length > 0) {
        const newTargetAnnotations: (AnnotationWithId | null)[] = [];
        
        // Filter out nulls and sort by start position to find gaps
        const nonNullTargets = result.target_annotation
            .filter((ann): ann is AnnotationWithId => ann !== null)
            .sort((a: AnnotationWithId, b: AnnotationWithId) => a.span.start - b.span.start);
        
        // Process each annotation and insert entries with id: null for gaps
        for (let i = 0; i < nonNullTargets.length; i++) {
            const current = nonNullTargets[i];
            const previous = i > 0 ? nonNullTargets[i - 1] : null;
            
            // If there's a gap between previous end and current start, insert entry with id: null
            if (previous && previous.span.end < current.span.start) {
                newTargetAnnotations.push({
                    id: null,
                    index: String(newTargetAnnotations.length),
                    span: {
                        start: previous.span.end,
                        end: current.span.start
                    }
                } as AnnotationWithId);
            }
            
            // Add the current annotation
            newTargetAnnotations.push(current);
        }
        
        result.target_annotation = newTargetAnnotations;
    }
    
    // Process alignment_annotation - insert entries with id: null and spans for gaps between siblings
    if (result.alignment_annotation && result.alignment_annotation.length > 0) {
        const newAlignmentAnnotations: (AnnotationWithId | null)[] = [];
        
        // Filter out nulls and sort by start position to find gaps
        const nonNullAlignments = result.alignment_annotation
            .filter((ann): ann is AnnotationWithId => ann !== null)
            .sort((a: AnnotationWithId, b: AnnotationWithId) => a.span.start - b.span.start);
        
        // Process each annotation and insert entries with id: null for gaps
        for (let i = 0; i < nonNullAlignments.length; i++) {
            const current = nonNullAlignments[i];
            const previous = i > 0 ? nonNullAlignments[i - 1] : null;
            
            // If there's a gap between previous end and current start, insert entry with id: null
            if (previous && previous.span.end < current.span.start) {
                newAlignmentAnnotations.push({
                    id: null,
                    index: String(newAlignmentAnnotations.length),
                    span: {
                        start: previous.span.end,
                        end: current.span.start
                    },
                    aligned_segments: []
                } as AnnotationWithId);
            }
            
            // Add the current annotation
            newAlignmentAnnotations.push(current);
        }
        
        result.alignment_annotation = newAlignmentAnnotations;
    }
    
    return result;
}

function addContentToAnnotations(
    alignments: AlignmentData,
    sourceContent: string,
    targetContent: string
): AlignmentData {
    // Extended annotation type that includes id and content
    type AnnotationWithContent = Annotation & { 
        id?: string | null; 
        aligned_segments?: string[];
        content?: string;
    };
    
    const result = JSON.parse(JSON.stringify(alignments)) as {
        type: "alignment";
        target_annotation: (AnnotationWithContent | null)[];
        alignment_annotation: (AnnotationWithContent | null)[];
    };
    
    // Add content to target_annotation (spans refer to source content)
    if (result.target_annotation && result.target_annotation.length > 0) {
        result.target_annotation = result.target_annotation.map((ann) => {
            if (!ann) return null;
            const content = sourceContent.substring(ann.span.start, ann.span.end);
            return {
                ...ann,
                content
            };
        });
    }
    
    // Add content to alignment_annotation (spans refer to target content)
    if (result.alignment_annotation && result.alignment_annotation.length > 0) {
        result.alignment_annotation = result.alignment_annotation.map((ann) => {
            if (!ann) return null;
            const content = targetContent.substring(ann.span.start, ann.span.end);
            return {
                ...ann,
                content
            };
        });
    }
    
    return result as AlignmentData;
}

export {cleaned_alignments,reverse_cleaned_alignments,populateMissingSpans,addContentToAnnotations}