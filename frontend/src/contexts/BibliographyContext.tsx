import { createContext, useContext, useState, ReactNode } from 'react';


export type BibliographyAnnotationType = 'title' | 'alt_title' | 'colophon' | 'incipit' | 'incipit_title' | 'alt_incipit' | 'person';

export interface BibliographyAnnotation {
  id: string;
  span: {
    start: number;
    end: number;
  };
  type: BibliographyAnnotationType;
  text: string;
  timestamp: number;
}

interface BibliographyContextType {
  annotations: BibliographyAnnotation[];
  addAnnotation: (annotation: Omit<BibliographyAnnotation, 'id' | 'timestamp'>) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  getAnnotationsByType: (type: BibliographyAnnotation['type']) => BibliographyAnnotation[];
  updateAnnotation: (id: string, updates: Partial<BibliographyAnnotation>) => void;
}

const BibliographyContext = createContext<BibliographyContextType | undefined>(undefined);

export const BibliographyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [annotations, setAnnotations] = useState<BibliographyAnnotation[]>([]);

  const addAnnotation = (annotation: Omit<BibliographyAnnotation, 'id' | 'timestamp'>) => {
    const newAnnotation: BibliographyAnnotation = {
      ...annotation,
      id: `bib-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    setAnnotations(prev => [...prev, newAnnotation]);
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== id));
  };

  const clearAnnotations = () => {
    setAnnotations([]);
  };

  const getAnnotationsByType = (type: BibliographyAnnotation['type']) => {
    return annotations.filter(ann => ann.type === type);
  };

  const updateAnnotation = (id: string, updates: Partial<BibliographyAnnotation>) => {
    setAnnotations(prev =>
      prev.map(ann => (ann.id === id ? { ...ann, ...updates } : ann))
    );
  };

  return (
    <BibliographyContext.Provider
      value={{
        annotations,
        addAnnotation,
        removeAnnotation,
        clearAnnotations,
        getAnnotationsByType,
        updateAnnotation,
      }}
    >
      {children}
    </BibliographyContext.Provider>
  );
};

export const useBibliography = () => {
  const context = useContext(BibliographyContext);
  if (context === undefined) {
    throw new Error('useBibliography must be used within a BibliographyProvider');
  }
  return context;
};
