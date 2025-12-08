import React from 'react';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import type { SelectionHandler, TextMapping, EditorType } from '../types';
import { useTextSelectionStore } from '../../../stores/textSelectionStore';
import SourceSelectionPanel from './SourceSelectionPanel';
import TargetSelectionPanel from './TargetSelectionPanel';
import TextEditor from './TextEditor';
import LoadingOverlay from './LoadingOverlay';

interface EditorProps {
  readonly ref: React.RefObject<ReactCodeMirrorRef | null> | null;
  readonly isEditable: boolean;
  readonly editorId: string;
  readonly editorType: EditorType;
  readonly onSelectionChange?: SelectionHandler;
  readonly mappings?: TextMapping[];
  readonly showContentOnlyWhenBothLoaded?: boolean;
  readonly fontSize: number;
}

function Editor({
  ref,
  isEditable,
  editorId,
  editorType,
  onSelectionChange,
  mappings = [],
  showContentOnlyWhenBothLoaded = false,
  fontSize
}: EditorProps) {
  const { 
    isSourceLoaded, 
    isTargetLoaded, 
    isLoadingAnnotations, 
    loadingMessage
  } = useTextSelectionStore();
  
  const isTextLoaded = editorType === 'source' ? isSourceLoaded : isTargetLoaded;
  const bothTextsLoaded = isSourceLoaded && isTargetLoaded;
  
  const shouldShowContent = showContentOnlyWhenBothLoaded ? bothTextsLoaded : isTextLoaded;
  
  const shouldShowLoadingOverlay = isLoadingAnnotations && shouldShowContent;
  



 return (

    <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col">
    
      {shouldShowContent ? (
        <>
          <div className="flex-1 min-h-0  ">
            <TextEditor
              ref={ref}
              isEditable={isEditable}
              editorId={editorId}
              editorType={editorType}
              onSelectionChange={onSelectionChange}
              mappings={mappings}
              fontSize={fontSize}
            />
          </div>
          {/* Loading overlay for this specific editor */}
          {shouldShowLoadingOverlay && (
            <LoadingOverlay 
              isVisible={true} 
              message={loadingMessage || 'Processing annotations...'} 
            />
          )}
        </>
      ) : (
        <div className="relative h-full w-full">
          {editorType === 'source' ? (
            <SourceSelectionPanel />
          ) : (
            <TargetSelectionPanel />
          )}
        </div>
      )}
    </div>
  );
}


export default Editor;
