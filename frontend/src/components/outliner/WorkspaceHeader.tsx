import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Square, EllipsisVertical, Undo } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateDocumentStatus } from '@/api/outliner';

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
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  headerConfig,
  actions,
}) => {
  const { segmentsCount, aiTextEndingLoading, hasPreviousSegments, checkedSegmentsCount, rejectedSegmentsCount } = headerConfig;
  const checked_percentage = segmentsCount > 0 ? (checkedSegmentsCount / segmentsCount) * 100 : 0;
  const { onAIDetectTextEndings, onAITextEndingStop, onUndoTextEndingDetection, onResetSegments ,onSKIP } = actions;
  const [isAllExpanded, setIsAllExpanded] = useState(false);

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
      toast.success('Document marked as skipped');
      onSKIP?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to skip document: ${error.message}`);
    },
  });

  const handleSkip = useCallback(() => {
    const isConfirm=confirm("are you sure")
      if (skipMutation.isPending||!isConfirm) return;
      skipMutation.mutate();
    
  }, [skipMutation]);



  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900"> Workspace</h2> 
        {isLoadingOrSaving &&        <span className="text-sm text-gray-600">saving...</span>}
        </div>
        <div className="text-sm text-gray-600">
          <Progress value={checked_percentage} title={`${checkedSegmentsCount} saved segments`}/>
          <span>{segmentsCount} segment{segmentsCount !== 1 ? 's' : ''}</span>
          {rejectedSegmentsCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              {rejectedSegmentsCount} need{rejectedSegmentsCount === 1 ? 's' : ''} revision
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* AI Text Ending Detection Button */}
        <Button
          variant="outline"
          onClick={onAIDetectTextEndings}
          disabled={aiTextEndingLoading}
          title="AI Detect Text Endings"
          className="flex items-center gap-2"
        >
          {aiTextEndingLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Detecting...
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
            title="Stop detection"
          >
            <Square className="w-4 h-4" />
          </Button>
        )}
        {/* Undo Button */}
        {hasPreviousSegments && !aiTextEndingLoading && (
          <Button
            variant="outline"
            onClick={onUndoTextEndingDetection}
            className="border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-400"
            title="Undo AI segmentation"
          >
            Undo
          </Button>
        )}

         {segmentsCount > 0 && <Menu onResetSegments={onResetSegments} isAllExpanded={isAllExpanded} setIsAllExpanded={setIsAllExpanded}/>}
         {segmentsCount > 0 && (
          <SubmitToReview
            disabled={checked_percentage < 100 || rejectedSegmentsCount > 0}
            disabledReason={
              rejectedSegmentsCount > 0
                ? `${rejectedSegmentsCount} segment${rejectedSegmentsCount !== 1 ? 's' : ''} need${rejectedSegmentsCount === 1 ? 's' : ''} revision`
                : checked_percentage < 100
                  ? `${segmentsCount - checkedSegmentsCount} segment${segmentsCount - checkedSegmentsCount !== 1 ? 's' : ''} not yet saved`
                  : undefined
            }
          />
        )}
        <Button
          variant="outline"
          onClick={handleSkip}
          disabled={isLoadingOrSaving || skipMutation.isPending || !documentId || documentStatus==='skipped'}
        >
          {documentStatus==='skipped'?"skipped": skipMutation.isPending ? 'Skipping...' : 'SKIP'}
        </Button>
      </div>
    </div>
  );
};


import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import ExpandAllButton from './ExpandAllButton';
import { Progress } from '../ui/progress';
import SubmitToReview from './SubmitToReview';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';


function Menu({
  onResetSegments,
  isAllExpanded,
  setIsAllExpanded,
}: {
  readonly onResetSegments?: () => void;
  readonly isAllExpanded: boolean;
  readonly setIsAllExpanded: (v: boolean) => void;
}) {
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
            Reset All Segments
          </DropdownMenuItem>
        )}
      
        <ExpandAllButton isAllExpanded={isAllExpanded} setIsAllExpanded={setIsAllExpanded}/>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
