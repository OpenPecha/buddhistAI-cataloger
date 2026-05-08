import React from 'react'
import SubmitToReview from '../SubmitToReview'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDocumentStatus } from '@/api/outliner';
import { useDocument } from '../contexts';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { toast } from 'sonner';

function ActionButton() {
    const {t}=useTranslation();
    const { segmentsCount, checkedSegmentsCount, rejectedSegmentsCount, checked_percentage } = useDocument();
    const { documentId, document,isLoading, isRefetching, isSaving, isResetting } = useOutlinerDocument();
    const queryClient = useQueryClient();
    const isLoadingOrSaving = isLoading || isRefetching || isSaving || isResetting;
    const documentStatus= document?.status;
   
    const notSavedCount = segmentsCount - checkedSegmentsCount;
    const submitDisabled = checked_percentage < 100 || rejectedSegmentsCount > 0;
    let submitDisabledReason: string | undefined;
    if (rejectedSegmentsCount > 0) {
      submitDisabledReason = t('outliner.workspace.revisionBadge', { count: rejectedSegmentsCount });
    } else if (checked_percentage < 100) {
      submitDisabledReason = t('outliner.workspace.submitNotSaved', { count: notSavedCount });
    }
  
    let skipButtonLabel = t('outliner.workspace.skip');
    

    const skipMutation = useMutation({
        mutationFn: async () => {
          if (!documentId) throw new Error('No document loaded');
          return updateDocumentStatus(documentId, 'skipped');
        },
        onSuccess: async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['outliner-document', documentId] }),
            queryClient.invalidateQueries({ queryKey: ['outliner-documents'] }),
          ]);
          toast.success(t('outliner.workspace.documentMarkedSkipped'));
        },
        onError: (error: Error) => {
          toast.error(t('outliner.workspace.skipFailed', { message: error.message }));
        },
      });
      if (documentStatus === 'skipped') {
        skipButtonLabel = t('outliner.workspace.skipped');
      } else if (skipMutation.isPending) {
        skipButtonLabel = t('outliner.workspace.skipping');
      }
    const handleSkip = () => {
        const isConfirm = globalThis.confirm(t('outliner.workspace.confirmSkip'));
          if (skipMutation.isPending||!isConfirm) return;
          skipMutation.mutate();
        
      }
  return (
    <>
       <SubmitToReview
          disabled={submitDisabled}
          disabledReason={submitDisabledReason}
        />
        <Button
          variant="outline"
          onClick={handleSkip}
          disabled={!submitDisabled|| isLoadingOrSaving || skipMutation.isPending || !documentId || documentStatus==='skipped'}
        >
          {skipButtonLabel}
        </Button> 
    </>
  )


  
}

export default ActionButton
