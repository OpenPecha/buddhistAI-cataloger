// get alignment data if given s_id and t_id;

import { fetchPreparedAlignmentData } from "../../../api/annotation";
import { populateMissingSpans, reverse_cleaned_alignments, addContentToAnnotations } from "./alignment_generator";

// Type for alignment annotation data structure
type AlignmentAnnotationData = {
    type: "alignment";
    target_annotation: Array<{
        id?: string | null;
        span: { start: number; end: number };
        index?: string;
    } | null>;
    alignment_annotation: Array<{
        id?: string | null;
        span: { start: number; end: number };
        index?: string;
        aligned_segments?: string[];
    } | null>;
};

type ProgressCallback = (message: string) => void;

async function prepareData(
    sourceInstanceId: string, 
    targetInstanceId: string,
    onProgress?: ProgressCallback
) {
    onProgress?.("Fetching source instance data...");
    const preparedData = await fetchPreparedAlignmentData(sourceInstanceId, targetInstanceId);
    const targetText = preparedData.target_text;
    const sourceText = preparedData.source_text;
    const annotation = preparedData.annotation;
    const has_alignment = preparedData.has_alignment;
    const annotation_id = preparedData.annotation_id;

    if(has_alignment){
        // Type assertion for annotation.data - it should be AlignmentAnnotationData
    
        
        onProgress?.("Reconstructing alignment segments...");
        const reconstructed_annoations=reverse_cleaned_alignments(annotation as Parameters<typeof reverse_cleaned_alignments>[0]);
        //get th text for each alignment segment from content
        console.log('reconstruct',reconstructed_annoations);
        
        onProgress?.("Populating missing spans...");
        const populated_annoations=populateMissingSpans(reconstructed_annoations);
        
        onProgress?.("Adding content to annotations...");
        // Add content to each annotation based on spans
        const annotationsWithContent = addContentToAnnotations(
            populated_annoations,
            sourceText,
            targetText
        );
        console.log('annotationsWithContent',annotationsWithContent);
        
        onProgress?.("Applying annotations to text...");
        
        // Extract annotation ID from preparedData response or annotation object if it exists
        const annotationId = preparedData.annotation_id || 
          (annotation && typeof annotation === 'object' && 'id' in annotation && typeof annotation.id === 'string' 
            ? String(annotation.id) 
            : null);

        return {
            source_text: sourceText,
            target_text: targetText,
            annotation: annotation,
            has_alignment: has_alignment,
            annotation_id: annotationId,
        };
    }
    else{
        
    const source_segmentation=preparedData.source_segmentation;
    const target_segmentation=preparedData.target_segmentation;
        onProgress?.("Checking for segmentation annotations...");
 
        return {
            source_text: sourceText,
            target_text: targetText,
            source_segmentation:source_segmentation,
            target_segmentation:target_segmentation,
            has_alignment: has_alignment,
        };
    }
}



export {prepareData}