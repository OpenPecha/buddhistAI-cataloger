import { useBibliography,type BibliographyAnnotation } from '@/contexts/BibliographyContext';

interface APIBibliographyAnnotation {
  span: {
    start: number;
    end: number;
  };
  type: string;
}

export const useBibliographyAPI = () => {
  const { annotations, clearAnnotations } = useBibliography();

  // Map frontend annotation types to backend API types
  // Backend expects: 'alt_incipit_title', 'alt_title', 'author', 'colophon', 'title'
  const mapAnnotationType = (frontendType: BibliographyAnnotation['type']): string | null => {
    const typeMap: Record<string, string> = {
      'title': 'title',
      'alt_title': 'alt_title',
      'colophon': 'colophon',
      'person': 'author',
      'alt_incipit': 'alt_incipit_title',
      // 'incipit' and 'incipit_title' are not valid bibliography annotation types
      // They are only used for metadata (incipit_title field), so we filter them out
    };
    
    return typeMap[frontendType] || null;
  };

  // Convert internal annotations to API format
  const getAPIAnnotations = (): APIBibliographyAnnotation[] => {
    console.log('🔄 Converting annotations to API format. Total annotations:', annotations.length);
    const apiAnnotations = annotations
      .map(annotation => {
        const mappedType = mapAnnotationType(annotation.type);
        if (!mappedType) {
          console.warn(`⚠️ Skipping annotation with unsupported type: ${annotation.type}`);
          return null;
        }
        return {
          span: {
            start: annotation.span.start,
            end: annotation.span.end,
          },
          type: mappedType,
        };
      })
      .filter((ann): ann is APIBibliographyAnnotation => ann !== null);
    
    console.log('✅ Converted annotations:', apiAnnotations);
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
  const getAnnotationsByType = (type: BibliographyAnnotation['type']) => {
    return annotations.filter(ann => ann.type === type);
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
