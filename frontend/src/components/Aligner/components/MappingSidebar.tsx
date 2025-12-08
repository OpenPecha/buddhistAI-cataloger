import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditorContext } from '../context';
import { useTextSelectionStore } from '../../../stores/textSelectionStore';
import { createAnnotation, updateAnnotation } from '../../../api/text';
import type { Annotations } from '../../../types/text';
import { useTranslation } from 'react-i18next';
import { generateAlignment } from '../utils/generateAnnotation';
import { toast } from 'sonner';



const MappingSidebar = () => {
  const { t } = useTranslation();
  const { getSourceContent, getTargetContent, isContentValid } = useEditorContext();
  const { sourceInstanceId, targetInstanceId, hasAlignment, sourceText, targetText, annotationId, clearAllSelections, resetAllSelections } = useTextSelectionStore();
  const queryClient = useQueryClient();
  // Local state for success/error messages
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // React Query mutation for creating annotation
  const createAnnotationMutation = useMutation<Annotations, Error, {
    inferenceId: string;
    annotationData: {
      type: string;
      target_manifestation_id: string;
      target_annotation: Array<{
        span: { start: number; end: number };
        index: number;
      }>;
      alignment_annotation: Array<{
        span: { start: number; end: number };
        index: number;
        alignment_index: number[];
      }>;
    };
  }>({
    mutationFn: async ({ inferenceId, annotationData }) => {
      return await createAnnotation(inferenceId, annotationData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relatedInstances'] });
      toast.success('alignmentSavedSuccess');
      window.location.reload();
    },
    onError: (error) => {
      console.error(t('mapping.savingAlignmentFailed'), error);
      setSaveError(error.message || t('mapping.failedToSaveAlignment'));
      setSaveSuccess(null);
    },
  });

  // React Query mutation for updating annotation
  const updateAnnotationMutation = useMutation<Annotations, Error, {
    annotationId: string;
    annotationData: {
      type: string;
      target_manifestation_id: string;
      target_annotation: Array<{
        span: { start: number; end: number };
        index: number;
      }>;
      alignment_annotation: Array<{
        span: { start: number; end: number };
        index: number;
        alignment_index: number[];
      }>;
    };
  }>({
    mutationFn: async ({ annotationId, annotationData }) => {
      return await updateAnnotation(annotationId, annotationData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relatedInstances'] });
      toast.success('Alignment updated successfully');
      window.location.reload();
    },
    onError: (error) => {
      console.error('Failed to update alignment:', error);
      setSaveError(error.message || t('mapping.failedToUpdateAlignment') || 'Failed to update alignment');
      setSaveSuccess(null);
    },
  });



  // Handle confirmation and proceed with save
  const handleConfirmSave = () => {
    setShowConfirmModal(false);
    // Small delay to allow modal to close before showing loading overlay
    setTimeout(() => {
      proceedWithSave();
    }, 100);
  };

  // Handle saving alignment annotation
  const handleSave = () => {
    // Show custom confirmation modal
    setShowConfirmModal(true);
  };

  const proceedWithSave = () => {
    if (!sourceInstanceId || !targetInstanceId) {
      setSaveError(t('mapping.sourceAndTargetRequired'));
      return;
    }

    // Validate content before saving
    if (!isContentValid()) {
      setSaveError(t('mapping.contentModifiedError'));
      return;
    }
    
    // Get source and target content from editors, with fallback to store
    const editorSourceContent = getSourceContent();
    const editorTargetContent = getTargetContent();
    // Use editor content if available, otherwise fallback to store content
    const sourceContent = editorSourceContent ?? sourceText ?? '';
    const targetContent = editorTargetContent ?? targetText ?? '';
    
    if (!sourceContent || !targetContent) {
      setSaveError(t('mapping.sourceAndTargetContentRequired'));
      return;
    }
    const sourceSegments = sourceContent.split('\n');
    const targetSegments = targetContent.split('\n');

    const spans = generateAlignment(sourceSegments, targetSegments);

    // Use update if hasAlignment and annotationId exists, otherwise create
    if (hasAlignment) {
      // Convert string indices to numbers for updateAnnotation API
      const targetAnnotation = spans.target_annotation
        .filter(item => item.index !== undefined && item.index !== null)
        .map(item => ({
          span: item.span,
          index: typeof item.index === 'string' ? Number.parseInt(item.index, 10) : (item.index ?? 0),
        }));

      const alignmentAnnotation = spans.alignment_annotation
        .filter(item => item.index !== undefined && item.index !== null && item.alignment_index !== undefined)
        .map(item => ({
          span: item.span,
          index: typeof item.index === 'string' ? Number.parseInt(item.index, 10) : (item.index ?? 0),
          alignment_index: (item.alignment_index ?? []).map(idx => typeof idx === 'string' ? Number.parseInt(idx, 10) : idx),
        }));
        console.log('updated')
      updateAnnotationMutation.mutate({
        annotationId,
        annotationData: {
          type: 'alignment',
          target_manifestation_id: sourceInstanceId,
          target_annotation: targetAnnotation,
          alignment_annotation: alignmentAnnotation,
        },
      });
    } else {
      // Convert to number format for createAnnotation
      const checkCondition=(d)=>d.span.start<d.span.end;
      const createTargetAnnotation = spans.target_annotation
        .filter(item => item.index !== undefined && item.index !== null)
        .filter(checkCondition)
        .map(item => ({
          span: item.span,
          index: typeof item.index === 'string' ? Number.parseInt(item.index, 10) : (item.index ?? 0),
        }));

      const createAlignmentAnnotation = spans.alignment_annotation
        .filter(item => item.index !== undefined && item.index !== null && item.alignment_index !== undefined)
        .filter(checkCondition)
        .map(item => ({
          span: item.span,
          index: typeof item.index === 'string' ? Number.parseInt(item.index, 10) : (item.index ?? 0),
          alignment_index: (item.alignment_index ?? []).map(idx => typeof idx === 'string' ? Number.parseInt(idx, 10) : idx),
        }));
        function filterAlignedArrays(arr1, arr2) {
          // Collect all indices from arr1
          const arr1IndicesSet = new Set();
          for (const item of arr1) {
              arr1IndicesSet.add(item.index);
          }
          
          // Collect all indices that appear in arr2's alignment_index arrays
          const alignmentIndicesSet = new Set();
          for (const item of arr2) {
              if (item.alignment_index && Array.isArray(item.alignment_index)) {
                  for (const idx of item.alignment_index) {
                      alignmentIndicesSet.add(idx);
                  }
              }
          }
          
          // Filter arr1: keep only elements whose index exists in arr2's alignment_index
          const filteredArr1 = arr1.filter(item => alignmentIndicesSet.has(item.index));
          
          // Filter arr2: keep only elements whose alignment_index contains at least one index from arr1
          const filteredArr2 = arr2.filter(item => {
              if (!item.alignment_index || !Array.isArray(item.alignment_index)) {
                  return false;
              }
              return item.alignment_index.some(idx => arr1IndicesSet.has(idx));
          });
          
          return {
              source: filteredArr1,
              target: filteredArr2
          };
      }
       const filtered = filterAlignedArrays(createTargetAnnotation, createAlignmentAnnotation);
      createAnnotationMutation.mutate({
        inferenceId: targetInstanceId,
        annotationData: {
          type: 'alignment',
          target_manifestation_id: sourceInstanceId,
          target_annotation: filtered.source,
          alignment_annotation: filtered.target,
        },
      }
      );
    }
  };


  const isPublishing = createAnnotationMutation.isPending || updateAnnotationMutation.isPending;

  return (
      <>
        {/* Publishing Loading Overlay */}
        {isPublishing && (
          <div className="fixed inset-0 bg-black/60 bg-opacity-60 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg shadow-xl p-8 flex flex-col items-center gap-4 min-w-[300px]">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              <div className="text-gray-700 text-lg font-medium">
                {hasAlignment ? 'Updating alignment...' : 'Publishing alignment...'}
              </div>
              <div className="text-gray-500 text-sm">
                Please wait while we save your changes
              </div>
            </div>
          </div>
        )}

        <div className="p-4">
          {/* Success Message */}
          {saveSuccess && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{saveSuccess}</p>
            </div>
          )}
          
          {/* Error Message */}
          {saveError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{saveError}</p>
            </div>
          )}

        
         <SaveButton hasAlignment={hasAlignment} handleSave={handleSave} disabled={isPublishing}/>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal &&  <ConfirmModal handleConfirmSave={handleConfirmSave} setShowConfirmModal={setShowConfirmModal} hasAlignment={hasAlignment} />}
      </>
  );
};

export default MappingSidebar;


function SaveButton({hasAlignment, handleSave,disabled }: { hasAlignment: boolean, handleSave: () => void,disabled: boolean }){
  return   <button
  onClick={handleSave}
  className='w-full bg-blue-600 text-white font-poppins px-2 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed'
  disabled={disabled}
>
 {hasAlignment ? 'Update' : 'Publish'}
</button>
}



function ConfirmModal({ handleConfirmSave, setShowConfirmModal, hasAlignment }: { handleConfirmSave: () => void, setShowConfirmModal: (show: boolean) => void, hasAlignment: boolean }){
  return  <div 
  role="dialog"
  aria-modal="true"
  aria-labelledby="confirm-modal-title"
  onClick={() => setShowConfirmModal(false)}
  onKeyDown={(e) => {
    if (e.key === 'Escape') {
      setShowConfirmModal(false);
    }
  }}
  className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50"
>
  <div 
    className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md mx-4"
    onClick={(e) => e.stopPropagation()}
    onKeyDown={(e) => e.stopPropagation()}
  >
    {/* Modal Header */}
    <div className="px-6 py-4 border-b border-gray-200">
      <h3 id="confirm-modal-title" className="text-lg font-semibold text-gray-900">
        {hasAlignment ? 'Confirm Save' : 'Confirm Publish'}
      </h3>
    </div>

    {/* Modal Body */}
    <div className="px-6 py-4">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-medium text-red-800 mb-2">
            ⚠️ Dangerous Operation
          </h4>
          <p className="text-sm text-red-700">
            <strong>WARNING:</strong> This action will permanently modify the alignment data and cannot be easily undone. 
            Are you absolutely certain you want to proceed with this operation?
          </p>
         
        </div>
      </div>
    </div>

    {/* Modal Footer */}
    <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
      <button
        onClick={() => setShowConfirmModal(false)}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
      >
         Cancel
      </button>
      <button
        onClick={handleConfirmSave}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      >
        Publish
      </button>
    </div>
  </div>
</div>
}
