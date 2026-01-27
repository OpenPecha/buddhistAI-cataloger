import { useMemo } from "react";
import { EachSegment } from "./EachSegment";

interface SegmentUpdateWrapperProps {
  readonly content: string | undefined;
  readonly annotationData: any;
}

export function SegmentUpdateWrapper({ content, annotationData }: SegmentUpdateWrapperProps) {
  // Extract segmentation annotations from annotationData
  const segmentationAnnotations = annotationData?.data;
  
  // Sort annotations by span start position
  const sortedAnnotations = useMemo(() => {
    if (!segmentationAnnotations || !Array.isArray(segmentationAnnotations) || segmentationAnnotations.length === 0) {
      return [];
    }
    return [...segmentationAnnotations].sort(
      (a: any, b: any) => {
        return (a.span?.start || 0) - (b.span?.start || 0);
      }
    );
  }, [segmentationAnnotations]);

  // Extract segments based on annotation spans
  const segments = useMemo(() => {
    if (!content || sortedAnnotations.length === 0) {
      return [];
    }
    return sortedAnnotations.map((annotation: any) => {
      if (!annotation.span) return "";
      return content.substring(annotation.span.start, annotation.span.end);
    });
  }, [content, sortedAnnotations]);

  // Early returns after hooks
  if (!content) return null;
  
  // If no annotations, return empty or fallback
  if (!segmentationAnnotations || !Array.isArray(segmentationAnnotations) || segmentationAnnotations.length === 0) {
    return (
      <div className="flex flex-col p-4">
        <span className="text-sm text-gray-500">No segments found</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 gap-2 font-monlam overflow-auto max-h-[90vh]">
      {segments.map((segment, index) => (
        <EachSegment 
          key={sortedAnnotations[index]?.id || index} 
          segment={segment} 
          segmentId={sortedAnnotations[index]?.id} 
        />
      ))}
    </div>
  );
}
