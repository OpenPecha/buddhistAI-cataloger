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
import { useQuery } from '@tanstack/react-query';

type AnnotationFromBackend = {
  id?: string | null;
  span: { start: number; end: number };
  index?: string | number;
  aligned_segments?: string[];
};

type PreparedData = {
  source_text: string;
  target_text: string;
  has_alignment: boolean;
  annotation?: {
      target_annotation: (AnnotationFromBackend | null)[];
      alignment_annotation: (AnnotationFromBackend | null)[];
  } | null;
  annotation_id?: string | null;
  source_segmentation?: Array<{ span: { start: number; end: number } }> | null;
  target_segmentation?: Array<{ span: { start: number; end: number } }> | null;
};

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

  const {
    data: preparedData,
    isLoading: isFetchingPreparedData,
    isError,
    error,
  } = useQuery({
    queryKey: ['preparedData', sourceInstanceId, targetInstanceId],
    queryFn: () => {
      if (!sourceInstanceId || !targetInstanceId) {
        return Promise.reject(new Error("Source or target instance ID is missing"));
      }
      return prepareData(sourceInstanceId, targetInstanceId);
    },
    enabled: !!sourceInstanceId && !!targetInstanceId,
  });

  const processAlignedData = React.useCallback((data: PreparedData) => {
    const sourceText = data.source_text;
    const targetText = data.target_text;
    const annotationData = data.annotation;

    if (annotationData?.target_annotation && annotationData?.alignment_annotation) {
      setLoadingAnnotations(true, "Reconstructing segments...");
      setHasAlignment(true);
      if ('annotation_id' in data && data.annotation_id) {
        setAnnotationId(data.annotation_id);
      }
      setAnnotationData({
        target_annotation: annotationData.target_annotation,
        alignment_annotation: annotationData.alignment_annotation,
      });

      const targetAnnotationForReconstruction = (annotationData.target_annotation || []).map(
        (ann: AnnotationFromBackend | null) => ann ? { ...ann, index: ann.index == null ? undefined : String(ann.index) } : null
      );
      const alignmentAnnotationForReconstruction = (annotationData.alignment_annotation || []).map(
        (ann: AnnotationFromBackend | null) => ann ? { ...ann, index: ann.index == null ? undefined : String(ann.index) } : null
      );

      const { source, target } = reconstructSegments(
        targetAnnotationForReconstruction,
        alignmentAnnotationForReconstruction,
        sourceText,
        targetText
      );
      setLoadingAnnotations(true, "Finalizing text display...");
      const segmentedSourceText = source.join("\n");
      const segmentedTargetText = target.join("\n");
      setSourceText(
        sourceTextId || '',
        sourceInstanceId!,
        segmentedSourceText,
        "database"
      );
      setTargetText(
        `related-${targetInstanceId!}`,
        targetInstanceId!,
        segmentedTargetText,
        "database"
      );
      setAnnotationsApplied(true);
      setLoadingAnnotations(false);
    }
  }, [setLoadingAnnotations, setHasAlignment, setAnnotationId, setAnnotationData, setSourceText, sourceTextId, sourceInstanceId, setTargetText, targetInstanceId, setAnnotationsApplied]);

  const processUnalignedData = React.useCallback((data: PreparedData) => {
    const sourceText = data.source_text;
    const targetText = data.target_text;
    setLoadingAnnotations(true, "Applying segmentation...");
    const sourceSegmentation = data.source_segmentation as Array<{ span: { start: number; end: number } }> | undefined;
    const targetSegmentation = data.target_segmentation as Array<{ span: { start: number; end: number } }> | undefined;

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
      sourceInstanceId!,
      segmentedSourceText,
      "database"
    );
    setTargetText(
      `related-${targetInstanceId!}`,
      targetInstanceId!,
      segmentedTargetText,
      "database"
    );
    setAnnotationsApplied(true);
    setLoadingAnnotations(false);
  }, [setLoadingAnnotations, setHasAlignment, setSourceText, sourceTextId, sourceInstanceId, setTargetText, targetInstanceId, setAnnotationsApplied]);

  React.useEffect(() => {
    if (isFetchingPreparedData) {
      setLoadingAnnotations(true, "Initializing...");
      return;
    }

    if (isError) {
      console.error("Error loading data:", error);
      setLoadingAnnotations(false);
      return;
    }

    if (preparedData) {
      if (preparedData.has_alignment) {
        processAlignedData(preparedData);
      } else {
        processUnalignedData(preparedData);
      }
    }
  }, [preparedData, isFetchingPreparedData, isError, error, processAlignedData, processUnalignedData, setLoadingAnnotations]);

  const bothTextLoaded = isSourceLoaded && isTargetLoaded;

  // Render main content - always show editor view
  const renderMainContent = () => {
    if (isError){
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-red-500 text-lg font-medium">Error loading data</div>
          </div>
        </div>
      );
    }
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
