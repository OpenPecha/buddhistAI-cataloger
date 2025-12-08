import { createContext } from 'react';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import type { SentenceMapping } from './types';

// External alignment data structure (from API)
export interface AlignmentAnnotation {
  id: string;
  span: { start: number; end: number };
  index: number;
  alignment_index: number[];
}

export interface TargetAnnotation {
  id: string;
  span: { start: number; end: number };
  index: number;
}

export interface ExternalAlignmentData {
  id: string;
  type: string;
  data: {
    alignment_annotation: AlignmentAnnotation[];
    target_annotation: TargetAnnotation[];
  };
}

export interface EditorContextValue {
  sourceEditorRef: React.RefObject<ReactCodeMirrorRef | null>;
  targetEditorRef: React.RefObject<ReactCodeMirrorRef | null>;
  getSourceContent: () => string | undefined;
  getTargetContent: () => string | undefined;
  generateSentenceMappings: () => SentenceMapping[];
  syncScrollToLine: (fromEditor: 'source' | 'target', lineNumber: number) => void;
  syncToClickedLine: (clickPosition: number, fromEditor: 'source' | 'target') => void;
  syncLineSelection: (fromEditor: 'source' | 'target', lineNumber: number) => void;
  syncTextSelection: (fromEditor: 'source' | 'target', selectionStart: number, selectionEnd: number) => void;
  isScrollSyncing: React.RefObject<boolean>;
  isScrollSyncEnabled: boolean;
  setScrollSyncEnabled: (enabled: boolean) => void;
  externalAlignmentData: ExternalAlignmentData | null;
  setExternalAlignmentData: (data: ExternalAlignmentData | null) => void;
  loadAlignmentData: (data: ExternalAlignmentData) => void;
  setOriginalSourceText: (text: string) => void;
  setOriginalTargetText: (text: string) => void;
  isContentValid: () => boolean;
}

export const EditorContext = createContext<EditorContextValue | undefined>(undefined);















