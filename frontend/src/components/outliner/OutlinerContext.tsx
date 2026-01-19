import React, { createContext, useContext } from 'react';
import type {
  TextSegment,
  BubbleMenuState,
  CursorPosition,
} from './types';

interface OutlinerContextValue {
  // State
  textContent: string;
  segments: TextSegment[];
  activeSegmentId: string | null;
  previousDataLastSegmentId: string;
  bubbleMenuState: BubbleMenuState | null;
  cursorPosition: CursorPosition | null;
  aiTextEndingLoading: boolean;
  previousSegments: TextSegment[] | null;
  segmentLoadingStates: Map<string, boolean>; // Map of segmentId -> loading boolean
  
  // Refs
  workspaceRef: React.RefObject<HTMLDivElement>;
  segmentRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  
  // Handlers
  onFileUpload: (content: string) => void;
  onFileUploadToBackend?: (file: File) => Promise<void>;
  isUploading?: boolean;
  onTextSelection: () => void;
  onSegmentClick: (segmentId: string, event?: React.MouseEvent) => void;
  onCursorChange: (segmentId: string, element: HTMLDivElement) => void;
  onActivate: (segmentId: string) => void;
  onInput: (e: React.FormEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onAttachParent: () => void;
  onMergeWithPrevious: (segmentId: string) => void;
  onBubbleMenuSelect: (field: 'title' | 'author', segmentId: string, text: string) => void;
  onSplitSegment: () => void;
  onAIDetectTextEndings: () => void;
  onAITextEndingStop: () => void;
  onUndoTextEndingDetection: () => void;
  onLoadNewFile: () => void;
}

const OutlinerContext = createContext<OutlinerContextValue | null>(null);

export const useOutliner = () => {
  const context = useContext(OutlinerContext);
  if (!context) {
    throw new Error('useOutliner must be used within OutlinerProvider');
  }
  return context;
};

interface OutlinerProviderProps {
  children: React.ReactNode;
  value: OutlinerContextValue;
}

export const OutlinerProvider: React.FC<OutlinerProviderProps> = ({ children, value }) => {
  return <OutlinerContext.Provider value={value}>{children}</OutlinerContext.Provider>;
};
