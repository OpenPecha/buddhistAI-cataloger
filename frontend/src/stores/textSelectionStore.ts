import { create } from 'zustand';

interface TextSelectionState {
  // Source state
  sourceTextId: string | null;
  sourceInstanceId: string | null;
  sourceText: string;
  isSourceLoaded: boolean;
  sourceLoadType: 'database' | 'file' | null; // Track how the text was loaded
  
  // Target state  
  targetTextId: string | null;
  targetInstanceId: string | null;
  targetText: string;
  isTargetLoaded: boolean;
  targetLoadType: 'database' | 'file' | null; // Track how the text was loaded
  targetType: 'translation' | 'commentary' | null; // Track the type of target text
  
  // Loading states
  isLoadingAnnotations: boolean; // Track annotation processing
  loadingMessage: string | null; // Custom loading message
  annotationsApplied: boolean; // Track if annotations have been applied
  
  hasAlignment: boolean;
  annotationId: string | null; // Store the annotation ID when alignment exists
  
  // Annotation data with content
  annotationData: {
    target_annotation: Array<{
      id?: string | null;
      span: { start: number; end: number };
      content?: string;
    } | null>;
    alignment_annotation: Array<{
      id?: string | null;
      span: { start: number; end: number };
      aligned_segments?: string[];
      content?: string;
    } | null>;
  } | null;
  
  // Actions
  setSourceText: (textId: string, instanceId: string, content: string, loadType?: 'database' | 'file') => void;
  setTargetText: (textId: string, instanceId: string, content: string, loadType?: 'database' | 'file') => void;
  setSourceTextFromFile: (content: string) => void;
  setTargetTextFromFile: (content: string) => void;
  setTargetTextFromUpload: (content: string) => void; // Set target text from file upload
  setSourceSelection: (textId: string, instanceId: string) => void; // Set source selection without loading text
  clearSourceSelection: () => void;
  clearTargetSelection: () => void;
  clearAllSelections: () => void;
  setTargetType: (type: 'translation' | 'commentary' | null) => void;
  // Loading state actions
  setLoadingAnnotations: (isLoading: boolean, message?: string) => void;
  setAnnotationsApplied: (applied: boolean) => void;
  setHasAlignment:(hasAlignment: boolean) => void;
  setAnnotationId: (id: string | null) => void;
  setAnnotationData: (data: {
    target_annotation: Array<{
      id?: string | null;
      span: { start: number; end: number };
      content?: string;
    } | null>;
    alignment_annotation: Array<{
      id?: string | null;
      span: { start: number; end: number };
      aligned_segments?: string[];
      content?: string;
    } | null>;
  } | null) => void;
  resetAllSelections: () => void;
}

export const useTextSelectionStore = create<TextSelectionState>((set) => ({
  // Initial source state
  sourceTextId: null,
  sourceInstanceId: null,
  sourceText: '',
  isSourceLoaded: false,
  sourceLoadType: null,
  
  // Initial target state
  targetTextId: null,
  targetInstanceId: null,
  targetText: '',
  isTargetLoaded: false,
  targetLoadType: null,
  targetType: null,
  
  // Initial loading states
  isLoadingAnnotations: false,
  loadingMessage: null,
  annotationsApplied: false,

  hasAlignment: false,
  annotationId: null,
  
  annotationData: null,
  
  setHasAlignment: (hasAlignment: boolean) =>
    set({
      hasAlignment: hasAlignment,
    }),
  
  setAnnotationId: (id: string | null) =>
    set({
      annotationId: id,
    }),
  
  setAnnotationData: (data) =>
    set({
      annotationData: data,
    }),
  // Actions
  setSourceText: (textId: string, instanceId: string, content: string, loadType: 'database' | 'file' = 'database') =>
    set({
      sourceTextId: textId,
      sourceInstanceId: instanceId,
      sourceText: content,
      isSourceLoaded: true,
      sourceLoadType: loadType,
      annotationsApplied: false, // Reset annotations state when new text is loaded
    }),
    
  setTargetText: (textId: string, instanceId: string, content: string, loadType: 'database' | 'file' = 'database') =>
    set({
      targetTextId: textId,
      targetInstanceId: instanceId,
      targetText: content,
      isTargetLoaded: true,
      targetLoadType: loadType,
      targetType: loadType === 'database' ? 'translation' : null, // Auto-set to translation for database texts
      annotationsApplied: true, // Reset annotations state when new text is loaded
    }),

  setSourceTextFromFile: (content: string) =>
    set({
      sourceTextId: 'file-upload',
      sourceInstanceId: 'file-instance',
      sourceText: content,
      isSourceLoaded: true,
      sourceLoadType: 'file',
      annotationsApplied: true, // File uploads don't need annotation processing
    }),

  setTargetTextFromFile: (content: string) =>
    set({
      targetTextId: 'file-upload',
      targetInstanceId: 'file-instance',
      targetText: content,
      isTargetLoaded: true,
      targetLoadType: 'file',
      targetType: null, // No auto-selection for file uploads
      annotationsApplied: true, // File uploads don't need annotation processing
    }),

  setTargetTextFromUpload: (content: string) =>
    set({
      targetTextId: 'uploaded-file',
      targetInstanceId: 'uploaded-instance',
      targetText: content,
      isTargetLoaded: true,
      targetLoadType: 'file',
      targetType: null, // User will select type
      annotationsApplied: true, // File uploads don't need annotation processing
    }),

  setSourceSelection: (textId: string, instanceId: string) =>
    set({
      sourceTextId: textId,
      sourceInstanceId: instanceId,
      // Don't set text content or loaded state - just the selection
    }),
    
  clearSourceSelection: () =>
    set({
      sourceTextId: null,
      sourceInstanceId: null,
      sourceText: '',
      isSourceLoaded: false,
      sourceLoadType: null,
    }),
    
  clearTargetSelection: () =>
    set({
      targetTextId: null,
      targetInstanceId: null,
      targetText: '',
      isTargetLoaded: false,
      targetLoadType: null,
      targetType: null,
    }),
    
  clearAllSelections: () =>
    set({
      sourceTextId: null,
      sourceInstanceId: null,
      sourceText: '',
      isSourceLoaded: false,
      sourceLoadType: null,
      targetTextId: null,
      targetInstanceId: null,
      targetText: '',
      isTargetLoaded: false,
      targetLoadType: null,
      targetType: null,
      isLoadingAnnotations: false,
      loadingMessage: null,
      annotationsApplied: false,
      annotationId: null,
    }),

  setTargetType: (type: 'translation' | 'commentary' | null) =>
    set({
      targetType: type,
    }),

  // Loading state actions
  setLoadingAnnotations: (isLoading: boolean, message?: string) =>
    set({
      isLoadingAnnotations: isLoading,
      loadingMessage: message || null,
      annotationsApplied: !isLoading, // If we're loading, annotations aren't applied yet
    }),

  setAnnotationsApplied: (applied: boolean) =>
    set({
      annotationsApplied: applied,
      isLoadingAnnotations: !applied, // If annotations are applied, we're not loading
    }),
  resetAllSelections: () =>
    set({
      sourceTextId: null,
      sourceInstanceId: null,
      sourceText: '',
      isSourceLoaded: false,
      sourceLoadType: null,
      targetTextId: null,
      targetInstanceId: null,
      targetText: '',
    })
}));
