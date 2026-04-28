import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Editor from './Editor';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useMappingState } from '../hooks/useMappingState';
import { useTextSelectionStore } from '../../../stores/textSelectionStore';
import { EditorProvider, useEditorContext } from '../context';
import MappingSidebar from './MappingSidebar';
import FontSizeSelector from './FontSizeSelector';
import { prepareData } from '../utils/prepare_data';
import { reconstructSegments } from '../utils/generateAnnotation';
import { applySegmentation } from '../../../lib/annotation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeAlignmentPayload } from '../utils/normalizeAlignments';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { deleteAlignmentAnnotation } from '../../../api/annotation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

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
  
  const [sourceFontSize, setSourceFontSize] = useState(20);
  const [targetFontSize, setTargetFontSize] = useState(20);
  const [selectedAlignmentIndex, setSelectedAlignmentIndex] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  const {
    selectionHandler,
  } = useMappingState();

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

  const deleteAlignmentMutation = useMutation({
    mutationFn: deleteAlignmentAnnotation,
    onSuccess: () => {
      toast.success('Alignment deleted');
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({
        queryKey: ['preparedData', sourceInstanceId, targetInstanceId],
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete alignment');
    },
  });

  const applyAlignedAnnotation = React.useCallback(
    (
      sourceText: string,
      targetText: string,
      annotationData: NonNullable<PreparedData['annotation']>,
      annotationId: string | null
    ) => {
      if (!annotationData?.target_annotation || !annotationData?.alignment_annotation) return;

      const store = useTextSelectionStore.getState();
      store.setLoadingAnnotations(true, "Reconstructing segments...");
      store.setHasAlignment(true);
      store.setAnnotationId(annotationId);
      store.setAnnotationData({
        target_annotation: annotationData.target_annotation,
        alignment_annotation: annotationData.alignment_annotation,
      });

      const targetAnnotationForReconstruction = (annotationData.target_annotation || []).map(
        (ann: AnnotationFromBackend | null) =>
          ann ? { ...ann, index: ann.index == null ? undefined : String(ann.index) } : null
      );
      const alignmentAnnotationForReconstruction = (annotationData.alignment_annotation || []).map(
        (ann: AnnotationFromBackend | null) =>
          ann ? { ...ann, index: ann.index == null ? undefined : String(ann.index) } : null
      );

      const { source, target } = reconstructSegments(
        targetAnnotationForReconstruction,
        alignmentAnnotationForReconstruction,
        sourceText,
        targetText
      );
      store.setLoadingAnnotations(true, "Finalizing text display...");
      const segmentedSourceText = source.join("\n");
      const segmentedTargetText = target.join("\n");
      store.setSourceText(sourceInstanceId!, sourceInstanceId!, segmentedSourceText, "database");
      store.setTargetText(`related-${targetInstanceId!}`, targetInstanceId!, segmentedTargetText, "database");
      store.setAnnotationsApplied(true);
      store.setLoadingAnnotations(false);
    },
    [sourceInstanceId, targetInstanceId]
  );
  const processUnalignedData = React.useCallback((data: PreparedData) => {
    const store = useTextSelectionStore.getState();
    const sourceText = data.source_text;
    const targetText = data.target_text;
    store.setLoadingAnnotations(true, "Applying segmentation...");
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

    store.setHasAlignment(false);
    store.setSourceText(sourceInstanceId!, sourceInstanceId!, segmentedSourceText, "database");
    store.setTargetText(`related-${targetInstanceId!}`, targetInstanceId!, segmentedTargetText, "database");
    store.setAnnotationsApplied(true);
    store.setLoadingAnnotations(false);
  }, [sourceInstanceId, targetInstanceId]);

  /** API reports alignment container exists but list is empty — show full plain texts for first alignment. */
  const processRawFullTextForNewAlignment = React.useCallback((data: PreparedData) => {
    const store = useTextSelectionStore.getState();
    store.setLoadingAnnotations(true, "Loading texts...");
    store.setHasAlignment(false);
    store.setAnnotationId(null);
    store.setAnnotationData(null);
    store.setSourceText(sourceInstanceId!, sourceInstanceId!, data.source_text, "database");
    store.setTargetText(`related-${targetInstanceId!}`, targetInstanceId!, data.target_text, "database");
    store.setAnnotationsApplied(true);
    store.setLoadingAnnotations(false);
  }, [sourceInstanceId, targetInstanceId]);

  React.useEffect(() => {
    setSelectedAlignmentIndex(0);
  }, [sourceInstanceId, targetInstanceId]);

  React.useEffect(() => {
    const store = useTextSelectionStore.getState();
    if (isFetchingPreparedData) {
      store.setLoadingAnnotations(true, "Initializing...");
      return;
    }

    if (isError) {
      console.error("Error loading data:", error);
      store.setLoadingAnnotations(false);
      return;
    }

    if (!preparedData) return;

    if (!preparedData.has_alignment) {
      processUnalignedData(preparedData);
      return;
    }

    if (
      Array.isArray(preparedData.annotation) &&
      preparedData.annotation.length === 0
    ) {
      processRawFullTextForNewAlignment(preparedData);
      return;
    }

    const variants = normalizeAlignmentPayload(preparedData.annotation);
    const maxIdx = Math.max(0, variants.length - 1);
    const idx = Math.min(selectedAlignmentIndex, maxIdx);
    const chosen = variants[idx];

    if (chosen) {
      let fallbackId: string | null = preparedData.annotation_id ?? null;
      const ann = preparedData.annotation;
      if (fallbackId == null && ann && typeof ann === "object" && !Array.isArray(ann)) {
        const rid = (ann as Record<string, unknown>).id;
        if (typeof rid === "string") fallbackId = rid;
      }
      applyAlignedAnnotation(
        preparedData.source_text,
        preparedData.target_text,
        chosen.data as unknown as NonNullable<PreparedData["annotation"]>,
        chosen.id ?? fallbackId
      );
      return;
    }

    // Legacy: annotation present but normalize failed — try raw single object
    const raw = preparedData.annotation;
    if (
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      Array.isArray((raw as { target_annotation?: unknown }).target_annotation) &&
      Array.isArray((raw as { alignment_annotation?: unknown }).alignment_annotation)
    ) {
      const legacy = raw as NonNullable<PreparedData["annotation"]>;
      applyAlignedAnnotation(
        preparedData.source_text,
        preparedData.target_text,
        legacy,
        preparedData.annotation_id ?? null
      );
      return;
    }

    console.warn("Alignment data present but could not be parsed");
    useTextSelectionStore.getState().setLoadingAnnotations(false);
  }, [
    preparedData,
    isFetchingPreparedData,
    isError,
    error,
    selectedAlignmentIndex,
    applyAlignedAnnotation,
    processUnalignedData,
    processRawFullTextForNewAlignment,
  ]);

  const alignmentVariants =
    preparedData?.has_alignment && preparedData.annotation != null
      ? normalizeAlignmentPayload(preparedData.annotation)
      : [];
  const alignmentSelectOptions =
    alignmentVariants.length > 1 ? alignmentVariants : [];

  const maxVariantIdx = Math.max(0, alignmentVariants.length - 1);
  const safeVariantIdx = Math.min(selectedAlignmentIndex, maxVariantIdx);
  const selectedVariant = alignmentVariants[safeVariantIdx];
  let fallbackAnnotationId: string | null = preparedData?.annotation_id ?? null;
  const annRaw = preparedData?.annotation;
  if (
    fallbackAnnotationId == null &&
    annRaw &&
    typeof annRaw === 'object' &&
    !Array.isArray(annRaw)
  ) {
    const rid = (annRaw as Record<string, unknown>).id;
    if (typeof rid === 'string') fallbackAnnotationId = rid;
  }
  const deleteAnnotationId =
    selectedVariant?.id ?? fallbackAnnotationId ?? null;

  // Render main content - always show editor view
  
  const type= useTextSelectionStore.getState().targetType;

  // text info from instance id 

  if (isError){
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-red-500 text-lg font-medium">Error loading data</div>
        </div>
      </div>
    );
  }
  const annotationListEmpty =
    Boolean(preparedData?.has_alignment) &&
    Array.isArray(preparedData?.annotation) &&
    preparedData.annotation.length === 0;
   
  

  return (
    <div className='w-full h-[calc(100vh-4.5rem)] flex flex-col min-h-0 relative'>
      {annotationListEmpty && (
        <div className="shrink-0 px-4 py-3 border-b border-amber-200/80 bg-amber-50">
          <h2 className="text-sm font-semibold text-amber-950">Create alignment</h2>
          <p className="text-sm text-amber-900/85 mt-1 max-w-3xl">
            Full source and target texts appear below with no alignment markup. Select matching
            spans in both columns, build mappings in the sidebar, then publish to save your first
            alignment.
          </p>
        </div>
      )}



      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this alignment?</DialogTitle>
            <DialogDescription>
              This removes the alignment from OpenPecha. You can recreate it later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteAlignmentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteAlignmentMutation.isPending || !deleteAnnotationId}
              onClick={() => {
                if (deleteAnnotationId) {
                  deleteAlignmentMutation.mutate(deleteAnnotationId);
                }
              }}
            >
              {deleteAlignmentMutation.isPending ? 'Deleting…' : 'Confirm delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
   
      <div className="flex-1 w-full flex min-h-0 overflow-hidden bg-gray-50">
   
      {isFetchingPreparedData ?
      <PanelLoader/>:
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Source Editor Panel */}
        <Panel 
          defaultSize={30} 
          minSize={25}  
          className="min-h-0 flex flex-col  bg-white border-r border-gray-200"
        >
          {/* Source Panel Header */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <h3 className="text-sm font-semibold text-gray-700">Text</h3>
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
          defaultSize={70} 
          minSize={25} 
          className="relative min-h-0 flex flex-col bg-white border-r border-gray-200"
        >
          <div className='flex w-full justify-between'>
          {/* Target Panel Header */}
          <div className="px-4 py-3 flex-1 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <h3 className="text-sm font-semibold text-gray-700">{type}</h3>
            </div>
            <FontSizeSelector 
              fontSize={targetFontSize} 
              onFontSizeChange={setTargetFontSize} 
            />

          </div>
      <MappingSidebar  />
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
      </PanelGroup>
      }
      
      </div>
    
    

      {alignmentVariants.length > 0 && (
        <div className="container mx-auto absolute bottom-0 w-fit left-0 right-0 shrink-0 flex  rounded-full items-center gap-3 px-4 py-2 border border-gray-400 bg-gray-300">
          {alignmentSelectOptions.length > 0 && (
            <>
              <span className="text-sm text-gray-600 whitespace-nowrap">Alignment</span>
              <Select
                value={String(Math.min(selectedAlignmentIndex, alignmentSelectOptions.length - 1))}
                onValueChange={(v) => setSelectedAlignmentIndex(Number.parseInt(v, 10))}
              >
                <SelectTrigger className="w-[min(100%,280px)] h-8 text-sm" size="sm">
                  <SelectValue placeholder="Choose alignment" />
                </SelectTrigger>
                <SelectContent>
                  {alignmentSelectOptions.map((opt, i) => (
                    <SelectItem key={`${opt.id ?? "alignment"}-${i}`} value={String(i)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {deleteAnnotationId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
          ) : null}
        </div>
      )}
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



function PanelLoader() {
  // Skeleton loader for each pane, including the horizontal "Info/Sidebar" section below the editors
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* PanelGroup: Editors */}
      <div className="flex flex-1 min-h-0">
        {/* Source Pane Skeleton */}
        <div className="flex-1 flex flex-col border-r border-gray-200 bg-white px-4 py-4 animate-pulse min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-gray-200" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
          {/* Lines of fake text */}
          <div className="space-y-2 mb-2 flex-1">
            <div className="h-5 bg-gray-200 rounded w-full" />
            <div className="h-5 bg-gray-200 rounded w-5/6" />
            <div className="h-5 bg-gray-200 rounded w-4/6" />
            <div className="h-5 bg-gray-200 rounded w-3/6" />
            <div className="h-5 bg-gray-200 rounded w-4/5" />
          </div>
        </div>

        {/* Target Pane Skeleton */}
        <div className="flex-1 flex flex-col bg-gray-50 px-4 py-4 animate-pulse min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-gray-200" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
          {/* Lines of fake text */}
          <div className="space-y-2 mb-2 flex-1">
            <div className="h-5 bg-gray-200 rounded w-full" />
            <div className="h-5 bg-gray-200 rounded w-5/6" />
            <div className="h-5 bg-gray-200 rounded w-4/6" />
            <div className="h-5 bg-gray-200 rounded w-3/6" />
            <div className="h-5 bg-gray-200 rounded w-4/5" />
          </div>
        </div>
      </div>
      {/* Horizontal Bottom Pane (MappingSidebar/Info) Skeleton */}
      <div className="w-full h-32 border-t border-gray-200 flex items-start bg-gray-100 animate-pulse px-6 py-4 gap-6">
        {/* Example sections for mapping/sidebar info slots */}
        <div className="w-1/3 h-full space-y-3">
          <div className="h-6 w-2/3 bg-gray-200 rounded" />
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-5/6 bg-gray-200 rounded" />
        </div>
        <div className="w-1/3 h-full space-y-3">
          <div className="h-6 w-1/2 bg-gray-200 rounded" />
          <div className="h-4 w-2/3 bg-gray-200 rounded" />
          <div className="h-4 w-1/3 bg-gray-200 rounded" />
        </div>
        <div className="w-1/3 h-full space-y-3">
          <div className="h-6 w-1/3 bg-gray-200 rounded" />
          <div className="h-4 w-1/2 bg-gray-200 rounded" />
          <div className="h-4 w-3/5 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}