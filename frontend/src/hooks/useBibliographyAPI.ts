import { useBibliography,type BibliographyAnnotation } from '@/contexts/BibliographyContext';

interface APIBibliographyAnnotation {
  span: {
    start: number;
    end: number;
  };
  biblography_type: string;
}

export const useBibliographyAPI = () => {
  const { annotations, clearAnnotations } = useBibliography();

  // Convert internal annotations to API format
  const getAPIAnnotations = (): APIBibliographyAnnotation[] => {
    console.log('🔄 Converting annotations to API format. Total annotations:', annotations.length);
    const apiAnnotations = annotations.map(annotation => ({
      span: {
        start: annotation.span.start,
        end: annotation.span.end,
      },
      biblography_type: annotation.biblography_type,
    }));
    console.log('🔄 API format annotations:', apiAnnotations);
    return apiAnnotations;
  };

  // Check if annotations exist
  const hasAnnotations = (): boolean => {
    return annotations.length > 0;
  };

  // Get annotations count
  const getAnnotationsCount = (): number => {
    return annotations.length;
  };

  // Get annotations by type
  const getAnnotationsByType = (type: BibliographyAnnotation['biblography_type']) => {
    return annotations.filter(ann => ann.biblography_type === type);
  };

  // Clear annotations after successful submission
  const clearAfterSubmission = () => {
    clearAnnotations();
  };

  return {
    annotations,
    getAPIAnnotations,
    hasAnnotations,
    getAnnotationsCount,
    getAnnotationsByType,
    clearAfterSubmission,
  };
};
