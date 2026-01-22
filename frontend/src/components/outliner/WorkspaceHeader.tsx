import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Square, RotateCcw, EllipsisVertical } from 'lucide-react';

interface WorkspaceHeaderConfig {
  segmentsCount: number;
  aiTextEndingLoading: boolean;
  hasPreviousSegments: boolean;
}

interface WorkspaceHeaderActions {
  onAIDetectTextEndings: () => void;
  onAITextEndingStop: () => void;
  onUndoTextEndingDetection: () => void;
  onResetSegments?: () => void;
}

interface WorkspaceHeaderProps {
  headerConfig: WorkspaceHeaderConfig;
  actions: WorkspaceHeaderActions;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  headerConfig,
  actions,
}) => {
  const { segmentsCount, aiTextEndingLoading, hasPreviousSegments } = headerConfig;
  const { onAIDetectTextEndings, onAITextEndingStop, onUndoTextEndingDetection, onResetSegments } = actions;
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Text Workspace</h2>
        <p className="text-sm text-gray-600">
          {segmentsCount} segment{segmentsCount !== 1 ? 's' : ''}
        </p>
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

         {segmentsCount > 0 && <Menu onResetSegments={onResetSegments}/>}
     
      </div>
    </div>
  );
};


import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";


function Menu({ onResetSegments }: {readonly onResetSegments: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <EllipsisVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={onResetSegments}
          className="text-red-600 hover:bg-red-50"
        >
          Reset All Segments
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
