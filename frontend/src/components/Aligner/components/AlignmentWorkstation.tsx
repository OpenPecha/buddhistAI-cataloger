import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Editor from './Editor';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useMappingState } from '../hooks/useMappingState';
import { useTextSelectionStore } from '../../../stores/textSelectionStore';
import { EditorProvider, useEditorContext } from '../context';
import TextNavigationBar from './TextNavigationBar';
import MappingSidebar from './MappingSidebar';
import FontSizeSelector from './FontSizeSelector';
import { prepareData } from '../utils/prepare_data';
import { reconstructSegments } from '../utils/generateAnnotation';
import { applySegmentation } from '../../../lib/annotation';

function AlignmentWorkstationContent() {
  const { sourceEditorRef, targetEditorRef } = useEditorContext();
  const { sourceInstanceId, targetInstanceId } = useParams();
  
  const [sourceFontSize, setSourceFontSize] = useState(24);
  const [targetFontSize, setTargetFontSize] = useState(24);

  const {
    selectionHandler,
  } = useMappingState();

  // Use Zustand store for text state
  const {
    isSourceLoaded,
    isTargetLoaded,
    setSourceText,
    setTargetText,
    setLoadingAnnotations,
    setAnnotationsApplied,
    setHasAlignment,
    setAnnotationData,
    setAnnotationId,
    sourceTextId,
  } = useTextSelectionStore();

  // Load texts from URL parameters on mount
  React.useEffect(() => {
    const loadFromUrl = async (sid: string, tid: string) => {
      try {
        setLoadingAnnotations(true, "Initializing...");
        const preparedData = await prepareData(sid, tid);
        const sourceText = preparedData.source_text;
        const targetText = preparedData.target_text;
        
        if (preparedData.has_alignment) {
          const annotationData = preparedData.annotation;
          
          if (
            annotationData?.target_annotation &&
            annotationData?.alignment_annotation
          ) {
            setLoadingAnnotations(true, "Reconstructing segments...");
            setHasAlignment(true);
            // Store annotation ID if available
            if ('annotation_id' in preparedData && preparedData.annotation_id) {
              setAnnotationId(preparedData.annotation_id);
            }
            // Store annotation data with content for mapping visualization
            setAnnotationData({
              target_annotation: annotationData.target_annotation,
              alignment_annotation: annotationData.alignment_annotation,
            });
            const { source, target } = reconstructSegments(
              annotationData.target_annotation,
              annotationData.alignment_annotation,
              sourceText,
              targetText
            );
            setLoadingAnnotations(true, "Finalizing text display...");
            const segmentedSourceText = source.join("\n");
            const segmentedTargetText = target.join("\n");
            setSourceText(
              sourceTextId || '',
              sid,
              segmentedSourceText,
              "database"
            );
            setTargetText(
              `related-${tid}`,
              tid,
              segmentedTargetText,
              "database"
            );
            setAnnotationsApplied(true);
            setLoadingAnnotations(false);
            
          
          }
        } else {
          setLoadingAnnotations(true, "Applying segmentation...");
          const sourceSegmentation = preparedData.source_segmentation as Array<{ span: { start: number; end: number } }> | undefined;
          const targetSegmentation = preparedData.target_segmentation as Array<{ span: { start: number; end: number } }> | undefined;
          
          let segmentedSourceText = sourceText;
          let segmentedTargetText = targetText;
          
          if (sourceSegmentation && Array.isArray(sourceSegmentation) && sourceSegmentation.length > 0) {
            segmentedSourceText = applySegmentation(sourceText, sourceSegmentation);
          }
          
          if (targetSegmentation && Array.isArray(targetSegmentation) && targetSegmentation.length > 0) {
            segmentedTargetText = applySegmentation(targetText, targetSegmentation);
          }
          
          setHasAlignment(false);
          setSourceText(
            sourceTextId || '',
            sid,
            segmentedSourceText,
            "database"
          );
          setTargetText(
            `related-${tid}`,
            tid,
            segmentedTargetText,
            "database"
          );
          setAnnotationsApplied(true);
          setLoadingAnnotations(false);
        
         
        }
      } catch (error) {
        console.error("Error loading source from URL parameters:", error);
        setLoadingAnnotations(false);
      }
    };
    
    if (sourceInstanceId && targetInstanceId) {
      loadFromUrl(sourceInstanceId, targetInstanceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceInstanceId, targetInstanceId]);

  const bothTextLoaded = isSourceLoaded && isTargetLoaded;

  // Render main content - always show editor view
  const renderMainContent = () => {
    if (!bothTextLoaded) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <div className="text-gray-500 text-lg font-medium">Loading texts...</div>
          </div>
        </div>
      );
    }

    return (
      // Editor View - Always show editors
      <div className="flex-1 w-full flex min-h-0 overflow-hidden bg-gray-50">
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
              <MappingSidebar  />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    );
  };

  return (
    <div className='w-full h-full flex flex-col min-h-0'>
      {/* Header */}
      {bothTextLoaded && (
        <div className="shrink-0">
          <TextNavigationBar />
        </div>
      )}
      {/* Always show editor view */}
      {renderMainContent()}
    
      {/* Footer */}
      <div className='absolute bottom-0 left-0 right-0 h-8 shrink-0 bg-gray-100 flex items-center justify-center text-xs text-gray-500'>
        <span>Only Enter and Backspace keys are available for editing</span> 
      </div>
    </div>
  );
}

function AlignmentWorkstation() {
  return (
    <EditorProvider>
      <AlignmentWorkstationContent />
    </EditorProvider>
  );
}

export default AlignmentWorkstation;
