import { createContext, useContext, type ReactNode } from 'react';
import type { AISuggestions, TextSegment } from '../types';
import type { Author, FormDataType, Title } from '../annotationSidebarFormTypes';

/** Controls exposed from `useAISuggestions` for the metadata panel. */
export interface AISuggestionsControls {
  aiSuggestions: AISuggestions | null;
  aiLoading: boolean;
  onAIDetect: () => Promise<void>;
  onAIStop: () => void;
}

export interface AnnotationMetadataContextValue {
  activeSegment: TextSegment;
  documentId?: string;
  /** True only when the annotation sidebar "Metadata" tab is selected (not when Outlines is active). */
  isMetadataTabSelected: boolean;
  aiSuggestionsControls: AISuggestionsControls;
  formData: FormDataType;
  suppliedTitleChecked: boolean;
  activeSegmentId: string;
  onFormFieldUpdate: (field: 'title' | 'author', value: Title | Author) => void;
  resetForm: () => void;
  onSuppliedTitleChange: (checked: boolean) => void;
  onSave: () => Promise<void>;
  onNotApplicable: () => Promise<void>;
  onResetAnnotations: () => Promise<void>;
}

const AnnotationMetadataContext = createContext<AnnotationMetadataContextValue | null>(null);

export function AnnotationMetadataProvider({
  value,
  children,
}: {
  value: AnnotationMetadataContextValue;
  children: ReactNode;
}) {
  return (
    <AnnotationMetadataContext.Provider value={value}>{children}</AnnotationMetadataContext.Provider>
  );
}

export function useAnnotationMetadata(): AnnotationMetadataContextValue {
  const ctx = useContext(AnnotationMetadataContext);
  if (ctx == null) {
    throw new Error('useAnnotationMetadata must be used within AnnotationMetadataProvider');
  }
  return ctx;
}
