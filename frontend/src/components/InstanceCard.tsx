import React, { useState } from 'react';
import type { OpenPechaTextInstance, SegmentationAnnotation } from '@/types/text';
import { Button } from './ui/button';

interface InstanceCardProps {
  instance: OpenPechaTextInstance;
}

const InstanceCard: React.FC<InstanceCardProps> = ({ instance }) => {
  const [expandedAnnotations, setExpandedAnnotations] = useState<string[]>([]);

  const toggleAnnotation = (annotationType: string) => {
    setExpandedAnnotations(prev => 
      prev.includes(annotationType) 
        ? prev.filter(type => type !== annotationType)
        : [...prev, annotationType]
    );
  };

  const getAnnotationCount = () => {
    if (!instance.annotations) return 0;
    return Object.values(instance.annotations).reduce((total, annotations) => {
      return total + (Array.isArray(annotations) ? annotations.length : 0);
    }, 0);
  };
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">Content</h3>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{instance.content?.length || 0} chars</span>
          <span>•</span>
          <span>{getAnnotationCount()} annotations</span>
        </div>
      </div>

      {/* Content Text */}
      {instance.content && (
        <div className="mb-4">
          <textarea 
            value={instance.content} 
            className="w-full text-sm text-gray-800 font-mono bg-gray-50 border border-gray-200 rounded p-2 resize-none"
            rows={4}
            readOnly
          />
        </div>
      )}

      {/* Dynamic Annotations */}
      {instance.annotations && Object.keys(instance.annotations).length > 0 && (
        <div className="space-y-2">
          {Object.entries(instance.annotations).map(([annotationType, annotations]) => {
            if (!Array.isArray(annotations) || annotations.length === 0) return null;
            
            const isExpanded = expandedAnnotations.includes(annotationType);
            
            return (
              <div key={annotationType} className="border border-gray-200 rounded">
                <Button
                  onClick={() => toggleAnnotation(annotationType)}
                  variant="ghost"
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {annotationType}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      {annotations.length}
                    </span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${
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
                  <div className="border-t border-gray-200 p-3 space-y-2">
                    {renderAnnotationContent(annotationType, annotations)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InstanceCard;
