import { useContext } from 'react';
import { EditorContext, type EditorContextValue } from './context';

/**
 * Hook to access the EditorContext
 * @throws Error if used outside of EditorProvider
 */
export const useEditorContext = (): EditorContextValue => {
  const context = useContext(EditorContext);
  
  if (context === undefined) {
    throw new Error('useEditorContext must be used within an EditorProvider');
  }
  
  return context;
};