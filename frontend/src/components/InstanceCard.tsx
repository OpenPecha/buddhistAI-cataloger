import React, { useState } from 'react';
import type { OpenPechaTextInstance, SegmentationAnnotation } from '@/types/text';
import { useAnnnotation } from '@/hooks/useTexts';
import { Button } from './ui/button';
import FormattedTextDisplay from './FormattedTextDisplay';

interface InstanceCardProps {
  instance: OpenPechaTextInstance;
}

const InstanceCard: React.FC<InstanceCardProps> = ({ instance }) => {
  const [expandedAnnotations, setExpandedAnnotations] = useState<string[]>([]);

  // Find segmentation annotation ID from instance.annotations array
  const segmentationAnnotationRef = Array.isArray(instance.annotations)
    ? instance.annotations.find((ann: any) => ann.type === 'segmentation')
    : null;
  const segmentationAnnotationId = segmentationAnnotationRef?.annotation_id || '';
  // Fetch full segmentation annotation data
  const {
    data: segmentationData,
    isLoading: isLoadingAnnotation,
    error: annotationError
  } = useAnnnotation(segmentationAnnotationId);

  const toggleAnnotation = (annotationType: string) => {
    setExpandedAnnotations(prev => 
      prev.includes(annotationType) 
        ? prev.filter(type => type !== annotationType)
        : [...prev, annotationType]
    );
  };


  // Reconstruct text with line breaks using fetched segmentation annotations
  const getFormattedContent = () => {
    if (!instance.content) return '';
    
    // Check if we have fetched segmentation annotations
    const segmentationAnnotations = (segmentationData as any)?.data;
    if (!segmentationAnnotations || !Array.isArray(segmentationAnnotations) || segmentationAnnotations.length === 0) {
      // No segmentation, return content as-is
      console.log('no segmentation annotations',instance);
      return instance.content;
    }

    // Sort annotations by span start position
    const sortedAnnotations = [...segmentationAnnotations]
      .sort((a: any, b: any) => {
        return (a.span?.start || 0) - (b.span?.start || 0);
      });

    // Extract each segment and join with newlines
    const lines = sortedAnnotations.map((annotation: any) => {
      if (!annotation.span) return '';
      return instance.content.substring(annotation.span.start, annotation.span.end);
    });

    return lines.join('\n');
  };
  const contentForView=getFormattedContent().split('\n');
  const renderAnnotationContent = (annotationType: string, annotations: unknown[]) => {
    if (annotationType === 'segmentation') {
      return annotations.map((annotation) => {
        const segAnnotation = annotation as SegmentationAnnotation;
        return (
          <div key={segAnnotation.id} className="bg-gray-50 rounded border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Segment #{segAnnotation.index}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {segAnnotation.span?.start}-{segAnnotation.span?.end} ({segAnnotation.span ? segAnnotation.span.end - segAnnotation.span.start : 0})
              </span>
            </div>
            {instance.content && segAnnotation.span && (
              <textarea
                className="w-full text-xs text-gray-600 font-mono bg-white border border-gray-200 rounded p-2 resize-none"
                rows={1}
                readOnly
                value={instance.content.substring(segAnnotation.span.start, segAnnotation.span.end)}
              />
            )}
          </div>
        );
      });
    }

    // Generic annotation rendering for other types
    return annotations.map((annotation, index) => {
      const annotationObj = annotation as Record<string, unknown>;
      return (
        <div key={(annotationObj.id as string) || index} className="bg-gray-50 rounded border p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {annotationType} #{index + 1}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              {annotationObj.id as string}
            </span>
          </div>
          <div className="text-xs text-gray-600 bg-white border border-gray-200 rounded p-2">
            <pre className="whitespace-pre-wrap">{JSON.stringify(annotation, null, 2)}</pre>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Content</h3>
          </div>
        </div>
      </div>

      {/* Content Text with Line Breaks Applied */}
      {instance.content && (
        <div className="p-6">
          {/* Loading State for Annotation */}
          {segmentationAnnotationId && isLoadingAnnotation && (
            <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
              <span className="text-sm font-medium text-gray-700">Loading segmentation annotation...</span>
              <span className="text-xs text-gray-500 mt-1">Applying spans to content</span>
            </div>
          )}

          {/* Error State for Annotation */}
          {segmentationAnnotationId && annotationError && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-900">Could not load segmentation annotation</p>
                  <p className="text-xs text-yellow-700 mt-1">Displaying raw content without line breaks</p>
                </div>
              </div>
            </div>
          )}

          {/* Content Display - Only show after annotation is loaded or if no annotation exists */}
          {(!segmentationAnnotationId || !isLoadingAnnotation) && (
            <FormattedTextDisplay lines={contentForView} />
          )}
        </div>
      )}

      {/* Dynamic Annotations - Only for old format with embedded annotation data */}
      {instance.annotations && !Array.isArray(instance.annotations) && Object.keys(instance.annotations).length > 0 && (
        <div className="px-6 pb-6">
          <div className="space-y-3">
          {Object.entries(instance.annotations).map(([annotationType, annotations]) => {
            if (!Array.isArray(annotations) || annotations.length === 0) return null;
            
            const isExpanded = expandedAnnotations.includes(annotationType);
            
            return (
                <div key={annotationType} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
                <Button
                  onClick={() => toggleAnnotation(annotationType)}
                  variant="ghost"
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-800 capitalize">
                      {annotationType}
                    </span>
                        <span className="ml-2 px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                      {annotations.length}
                    </span>
                      </div>
                  </div>
                  <svg
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>
                
                {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4">
                      <div className="space-y-3">
                    {renderAnnotationContent(annotationType, annotations)}
                      </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstanceCard;
