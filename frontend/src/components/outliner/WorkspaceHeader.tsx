import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Square, EllipsisVertical, Undo, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateDocumentStatus } from '@/api/outliner';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import ExpandAllButton from './ExpandAllButton';
import { Progress } from '../ui/progress';
import SubmitToReview from './SubmitToReview';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { useActions } from './contexts';

interface WorkspaceHeaderConfig {
  segmentsCount: number;
  checkedSegmentsCount: number;
  rejectedSegmentsCount: number;
  aiTextEndingLoading: boolean;
  hasPreviousSegments: boolean;
}

interface WorkspaceHeaderActions {
  onAIDetectTextEndings: () => void;
  onAITextEndingStop: () => void;
  onUndoTextEndingDetection: () => void;
  onResetSegments?: () => void;
  onSKIP?: () => void;
}

interface WorkspaceHeaderProps {
  headerConfig: WorkspaceHeaderConfig;
  actions: WorkspaceHeaderActions;
  /** Show / hide the right panel (images + table of contents). */
  tocPanel: {
    visible: boolean;
    onToggle: () => void;
  };
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  headerConfig,
  actions,
  tocPanel,
}) => {
  const { t } = useTranslation();
  const { segmentsCount, aiTextEndingLoading, hasPreviousSegments, checkedSegmentsCount, rejectedSegmentsCount } = headerConfig;
  const checked_percentage = segmentsCount > 0 ? (checkedSegmentsCount / segmentsCount) * 100 : 0;
  const { onAIDetectTextEndings, onAITextEndingStop, onUndoTextEndingDetection, onResetSegments ,onSKIP } = actions;
  const { isAllSegmentsExpanded, toggleExpandAllSegments } = useActions();

  const queryClient = useQueryClient();
  const { documentId, document, isLoading, isRefetching, isSaving, isResetting } = useOutlinerDocument();
  const isLoadingOrSaving = isLoading || isRefetching || isSaving || isResetting;
  const documentStatus= document?.status;
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
      onSKIP?.();
    },
    onError: (error: Error) => {
      toast.error(t('outliner.workspace.skipFailed', { message: error.message }));
    },
  });

  const handleSkip = useCallback(() => {
    const isConfirm = window.confirm(t('outliner.workspace.confirmSkip'));
      if (skipMutation.isPending||!isConfirm) return;
      skipMutation.mutate();
    
  }, [skipMutation, t]);

  const notSavedCount = segmentsCount - checkedSegmentsCount;

  return (
    <div className="bg-white border-b py-2 border-gray-200 px-6  flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          {isLoadingOrSaving && (
            <span className="text-sm text-gray-600">{t('outliner.workspace.saving')}</span>
          )}
        </div>
        <div className="text-sm text-gray-600">
          <Progress value={checked_percentage} title={t('outliner.workspace.savedSegmentsTitle', { count: checkedSegmentsCount })} className="w-40"/>
          {rejectedSegmentsCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              {t('outliner.workspace.revisionBadge', { count: rejectedSegmentsCount })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onAIDetectTextEndings}
          disabled={
            isLoadingOrSaving ||
            aiTextEndingLoading ||
            !documentId ||
            !document?.content?.trim()
          }
          title={t('outliner.workspace.aiOutlineTitle')}
          className="flex items-center gap-2"
        >
          {aiTextEndingLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('outliner.workspace.detecting')}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4"/>
            </>
          )}
        </Button>
        {aiTextEndingLoading && (
          <Button
            variant="outline"
            onClick={onAITextEndingStop}
            className="px-3 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
            title={t('outliner.workspace.stopDetection')}
          >
            <Square className="w-4 h-4" />
          </Button>
        )}
        {hasPreviousSegments && !aiTextEndingLoading && (
          <Button
            variant="outline"
            onClick={onUndoTextEndingDetection}
            className="border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-400"
            title={t('outliner.workspace.undoAiTitle')}
          >
            {t('outliner.workspace.undo')}
          </Button>
        )}

         {segmentsCount > 0 && (
          <Menu
            onResetSegments={onResetSegments}
            isAllExpanded={isAllSegmentsExpanded}
            onToggleExpandAll={toggleExpandAllSegments}
          />
        )}
         {segmentsCount > 0 && (
          <SubmitToReview
            disabled={checked_percentage < 100 || rejectedSegmentsCount > 0}
            disabledReason={
              rejectedSegmentsCount > 0
                ? t('outliner.workspace.revisionBadge', { count: rejectedSegmentsCount })
                : checked_percentage < 100
                  ? t('outliner.workspace.submitNotSaved', { count: notSavedCount })
                  : undefined
            }
          />
        )}
          <Button
          variant="outline"
          onClick={handleSkip}
          disabled={isLoadingOrSaving || skipMutation.isPending || !documentId || documentStatus==='skipped'}
        >
          {documentStatus==='skipped' ? t('outliner.workspace.skipped') : skipMutation.isPending ? t('outliner.workspace.skipping') : t('outliner.workspace.skip')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 px-2"
          onClick={tocPanel.onToggle}
          aria-pressed={tocPanel.visible}
          aria-label={
            tocPanel.visible
              ? t('outliner.workspace.hideSidePanel')
              : t('outliner.workspace.showSidePanel')
          }
          title={
            tocPanel.visible
              ? t('outliner.workspace.hideSidePanel')
              : t('outliner.workspace.showSidePanel')
          }
        >
          {tocPanel.visible ? (
            <PanelRightClose className="h-4 w-4" aria-hidden />
          ) : (
            <PanelRightOpen className="h-4 w-4" aria-hidden />
          )}
        </Button>
      
      </div>
    </div>
  );
};

function Menu({
  onResetSegments,
  isAllExpanded,
  onToggleExpandAll,
}: {
  readonly onResetSegments?: () => void;
  readonly isAllExpanded: boolean;
  readonly onToggleExpandAll: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <EllipsisVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onResetSegments && (
          <DropdownMenuItem
            onClick={onResetSegments}
            className="text-red-600 hover:bg-red-50"
          >
            <Undo />
            {t('outliner.workspace.resetAllSegments')}
          </DropdownMenuItem>
        )}
      
        <ExpandAllButton isAllExpanded={isAllExpanded} onToggleExpandAll={onToggleExpandAll}/>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
