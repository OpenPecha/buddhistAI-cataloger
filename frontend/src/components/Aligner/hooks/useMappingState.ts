import { useState, useCallback, useMemo } from 'react';
import type { 
  TextMapping, 
  TextSelection, 
  MappingState, 
  MappingExport,
  SelectionHandler 
} from '../types';

// Color palette for mappings
const MAPPING_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
];

export const useMappingState = () => {
  const [state, setState] = useState<MappingState>({
    mappings: [],
    currentSourceSelection: null,
    currentTargetSelections: [],
    isCreatingMapping: false,
  });

  // Generate unique ID for mappings
  const generateMappingId = useCallback(() => {
    return `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Get next available color
  const getNextColor = useCallback(() => {
    const usedColors = state.mappings.map(m => m.color);
    const availableColors = MAPPING_COLORS.filter(color => !usedColors.includes(color));
    return availableColors.length > 0 ? availableColors[0] : MAPPING_COLORS[0];
  }, [state.mappings]);

  // Handle text selection from editors
  const handleTextSelect = useCallback((selection: TextSelection) => {
    setState(prevState => {
      if (selection.editorId.includes('source')) {
        return {
          ...prevState,
          currentSourceSelection: selection,
          isCreatingMapping: true,
        };
      } else {
        // Handle target selection (can be multiple)
        const existingIndex = prevState.currentTargetSelections.findIndex(
          s => s.editorId === selection.editorId
        );
        
        let newTargetSelections;
        if (existingIndex >= 0) {
          // Replace existing selection for this editor
          newTargetSelections = [...prevState.currentTargetSelections];
          newTargetSelections[existingIndex] = selection;
        } else {
          // Add new selection
          newTargetSelections = [...prevState.currentTargetSelections, selection];
        }

        return {
          ...prevState,
          currentTargetSelections: newTargetSelections,
          isCreatingMapping: prevState.currentSourceSelection !== null,
        };
      }
    });
  }, []);

  // Handle selection clear
  const handleSelectionClear = useCallback((editorId: string) => {
    setState(prevState => {
      if (editorId.includes('source')) {
        return {
          ...prevState,
          currentSourceSelection: null,
          isCreatingMapping: false,
        };
      } else {
        const newTargetSelections = prevState.currentTargetSelections.filter(
          s => s.editorId !== editorId
        );
        return {
          ...prevState,
          currentTargetSelections: newTargetSelections,
          isCreatingMapping: prevState.currentSourceSelection !== null && newTargetSelections.length > 0,
        };
      }
    });
  }, []);

  // Create selection handler (memoized to prevent re-renders)
  const selectionHandler: SelectionHandler = useMemo(() => ({
    onTextSelect: handleTextSelect,
    onSelectionClear: handleSelectionClear,
  }), [handleTextSelect, handleSelectionClear]);

  // Create new mapping
  const createMapping = useCallback(() => {
    if (!state.currentSourceSelection || state.currentTargetSelections.length === 0) {
      return false;
    }

    const newMapping: TextMapping = {
      id: generateMappingId(),
      sourceText: state.currentSourceSelection.text,
      sourceStart: state.currentSourceSelection.start,
      sourceEnd: state.currentSourceSelection.end,
      targetMappings: state.currentTargetSelections.map(selection => ({
        text: selection.text,
        start: selection.start,
        end: selection.end,
      })),
      color: getNextColor(),
      createdAt: new Date(),
    };

    setState(prevState => ({
      ...prevState,
      mappings: [...prevState.mappings, newMapping],
      currentSourceSelection: null,
      currentTargetSelections: [],
      isCreatingMapping: false,
    }));

    return true;
  }, [state.currentSourceSelection, state.currentTargetSelections, generateMappingId, getNextColor]);

  // Delete mapping
  const deleteMapping = useCallback((mappingId: string) => {
    setState(prevState => ({
      ...prevState,
      mappings: prevState.mappings.filter(m => m.id !== mappingId),
    }));
  }, []);

  // Clear all mappings
  const clearAllMappings = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      mappings: [],
      currentSourceSelection: null,
      currentTargetSelections: [],
      isCreatingMapping: false,
    }));
  }, []);

  // Clear current selections
  const clearSelections = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      currentSourceSelection: null,
      currentTargetSelections: [],
      isCreatingMapping: false,
    }));
  }, []);

  // Export mappings function
  const getMappings = useCallback((): MappingExport[] => {
    return state.mappings.map(mapping => ({
      id: mapping.id,
      sourceText: mapping.sourceText,
      sourcePosition: {
        start: mapping.sourceStart,
        end: mapping.sourceEnd,
      },
      targetMappings: mapping.targetMappings.map(target => ({
        text: target.text,
        position: {
          start: target.start,
          end: target.end,
        },
      })),
      metadata: {
        color: mapping.color,
        createdAt: mapping.createdAt,
      },
    }));
  }, [state.mappings]);

  // Check if mapping can be created
  const canCreateMapping = state.currentSourceSelection !== null && 
                          state.currentTargetSelections.length > 0;

  return {
    // State
    mappings: state.mappings,
    currentSourceSelection: state.currentSourceSelection,
    currentTargetSelections: state.currentTargetSelections,
    isCreatingMapping: state.isCreatingMapping,
    canCreateMapping,
    
    // Handlers
    selectionHandler,
    
    // Actions
    createMapping,
    deleteMapping,
    clearAllMappings,
    clearSelections,
    getMappings,
  };
};
