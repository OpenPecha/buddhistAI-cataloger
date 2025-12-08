import Editor from './components/Editor';
import UnifiedSelectionPanel from './components/UnifiedSelectionPanel';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useMappingState } from './hooks/useMappingState';
import { useTextSelectionStore } from '../../stores/textSelectionStore';
import { EditorProvider, useEditorContext } from './context';
import TextNavigationBar from './components/TextNavigationBar';
import MappingSidebar from './components/MappingSidebar';
import FontSizeSelector from './components/FontSizeSelector';
import { useState } from 'react';

function AlignerContent() {
  const { sourceEditorRef, targetEditorRef } = useEditorContext();
  
  const [sourceFontSize, setSourceFontSize] = useState(24);
  const [targetFontSize, setTargetFontSize] = useState(24);



  const {
    mappings,
    selectionHandler,
  } = useMappingState();

  // Use Zustand store for text state
  const { isSourceLoaded, isTargetLoaded } = useTextSelectionStore();

  // Always show editors
  const showEditors = true;

  const bothTextLoaded = isSourceLoaded && isTargetLoaded;
  return (
    <div className='w-full h-full flex flex-col min-h-0'>
      {/* Header */}
      {bothTextLoaded && (
        <div className="shrink-0">
          <TextNavigationBar />
        </div>
      )}
      
      {/* Unified Selection Panel - Show when both texts are not loaded */}
      {bothTextLoaded && showEditors ? (
        <div className="flex-1 w-full flex  min-h-0 overflow-hidden bg-gray-50">
          <PanelGroup direction="horizontal" className="flex-1">
            {/* Source Editor Panel */}
            <Panel 
              defaultSize={50} 
              minSize={25}  
              className="min-h-0 flex flex-col bg-white border-r border-gray-200"
            >
              {/* Source Panel Header */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <h3 className="text-sm font-semibold text-gray-700">Source Text</h3>
                </div>
                <FontSizeSelector 
                  fontSize={sourceFontSize} 
                  onFontSizeChange={setSourceFontSize} 
                />
              </div>
              {/* Source Editor Content */}
                <Editor
                  ref={sourceEditorRef}
                  isEditable={true}
                  editorId="source-editor"
                  editorType="source"
                  onSelectionChange={selectionHandler}
                  mappings={mappings}
                  showContentOnlyWhenBothLoaded={true}
                  fontSize={sourceFontSize}
                />
            </Panel>
            
            {/* Resize handle between source and target */}
            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors duration-200 cursor-col-resize flex items-center justify-center group">
              <div className="w-0.5 h-8 bg-gray-400 rounded-full opacity-40 group-hover:opacity-100 group-hover:bg-blue-500 transition-all"></div>
            </PanelResizeHandle>
            
            {/* Target Editor Panel */}
            <Panel 
              defaultSize={50} 
              minSize={25} 
              className="min-h-0 flex flex-col bg-white border-r border-gray-200"
            >
              {/* Target Panel Header */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <h3 className="text-sm font-semibold text-gray-700">Target Text</h3>
                </div>
                <FontSizeSelector 
                  fontSize={targetFontSize} 
                  onFontSizeChange={setTargetFontSize} 
                />
              </div>
              
              {/* Target Editor Content */}
                <Editor
                  ref={targetEditorRef}
                  isEditable={true}
                  editorId="target-editor"
                  editorType="target"
                  onSelectionChange={selectionHandler}
                  mappings={mappings}
                  showContentOnlyWhenBothLoaded={true}
                  fontSize={targetFontSize}
                />
            </Panel>
            
            {/* Resize handle between target and sidebar */}
            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors duration-200 cursor-col-resize flex items-center justify-center group">
              <div className="w-0.5 h-8 bg-gray-400 rounded-full opacity-40 group-hover:opacity-100 group-hover:bg-blue-500 transition-all"></div>
            </PanelResizeHandle>
            
            {/* Mapping Sidebar Panel */}
            <Panel 
              defaultSize={20} 
              minSize={15} 
              maxSize={35}
              className="min-h-0 flex flex-col bg-white"
            >
              {/* Sidebar Header */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <h3 className="text-sm font-semibold text-gray-700">Actions</h3>
                </div>
              </div>
              
              {/* Sidebar Content */}
              <div className="flex-1 min-h-0 overflow-auto">
                <MappingSidebar />
              </div>
            </Panel>
          </PanelGroup>
        </div>
      ) : (
          <UnifiedSelectionPanel />
      )}
    
      {/* Footer */}
      {bothTextLoaded && showEditors &&
      <div className='absolute bottom-0 left-0 right-0 h-8 shrink-0 bg-gray-100 flex items-center justify-center text-xs text-gray-500'>
      <span>Only Enter and Backspace keys are available for editing</span> 
      </div>
      }
    </div>
  );
}

function Aligner() {
  return (
    <EditorProvider>
      <AlignerContent />
    </EditorProvider>
  );
}

export default Aligner;
