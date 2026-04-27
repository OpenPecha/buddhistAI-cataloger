// get alignment data if given s_id and t_id;

import { fetchAlignment } from "../../../api/annotation";
import { populateMissingSpans, reverse_cleaned_alignments, addContentToAnnotations } from "./alignment_generator";
import { normalizeAlignmentPayload } from "./normalizeAlignments";

type ProgressCallback = (message: string) => void;

async function prepareData(
    sourceInstanceId: string, 
    targetInstanceId: string,
    onProgress?: ProgressCallback
) {
    onProgress?.("Fetching source instance data...");
    const preparedData = await fetchAlignment(sourceInstanceId, targetInstanceId);
    const targetText = preparedData.target_text;
    const sourceText = preparedData.source_text;
    const annotation = preparedData.annotation;
    const has_alignment = preparedData.has_alignment;

    if(has_alignment){
        const variants = normalizeAlignmentPayload(annotation);
        const primary =
            variants[0]?.data ??
            (annotation &&
            typeof annotation === "object" &&
            !Array.isArray(annotation) &&
            Array.isArray((annotation as { target_annotation?: unknown }).target_annotation) &&
            Array.isArray((annotation as { alignment_annotation?: unknown }).alignment_annotation)
                ? {
                      target_annotation: (annotation as { target_annotation: unknown[] }).target_annotation,
                      alignment_annotation: (annotation as { alignment_annotation: unknown[] })
                          .alignment_annotation,
                  }
                : null);
        if (!primary) {
            onProgress?.("Skipping alignment reconstruction (unrecognized shape)...");
        }

        onProgress?.("Reconstructing alignment segments...");
        const reconstructed_annoations = primary
            ? reverse_cleaned_alignments({
                  type: "alignment",
                  target_annotation: primary.target_annotation as Parameters<
                      typeof reverse_cleaned_alignments
                  >[0]["target_annotation"],
                  alignment_annotation: primary.alignment_annotation as Parameters<
                      typeof reverse_cleaned_alignments
                  >[0]["alignment_annotation"],
              })
            : null;

        if (reconstructed_annoations) {
            onProgress?.("Populating missing spans...");
            const populated_annoations = populateMissingSpans(reconstructed_annoations);

            onProgress?.("Adding content to annotations...");
            addContentToAnnotations(populated_annoations, sourceText, targetText);
        }

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