export interface TextSelection {
  text: string;
  start: number;
  end: number;
  editorId: string;
}

export interface TargetMapping {
  text: string;
  start: number;
  end: number;
}

export interface TextMapping {
  id: string;
  sourceText: string;
  sourceStart: number;
  sourceEnd: number;
  targetMappings: TargetMapping[];
  color: string;
  createdAt: Date;
}

export interface MappingState {
  mappings: TextMapping[];
  currentSourceSelection: TextSelection | null;
  currentTargetSelections: TextSelection[];
  isCreatingMapping: boolean;
}

export interface MappingExport {
  id: string;
  sourceText: string;
  sourcePosition: { start: number; end: number };
  targetMappings: Array<{
    text: string;
    position: { start: number; end: number };
  }>;
  metadata: { color: string; createdAt: Date };
}

export type EditorType = 'source' | 'target';

export interface SelectionHandler {
  onTextSelect: (selection: TextSelection) => void;
  onSelectionClear: (editorId: string) => void;
}
