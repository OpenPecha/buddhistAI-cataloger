import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Progress } from '../ui/progress';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import {  useDocument } from './contexts';

import WorkSpaceHeaderMenu from './workspace/WorkSpaceHeaderMenu';
// import AIDetectionButton from './workspace/AIDetectionButton';
import ActionButton from './workspace/ActionButton';




interface WorkspaceHeaderProps {
  /** Show / hide the right panel (images + table of contents). */
  tocPanel: {
    visible: boolean;
    onToggle: () => void;
  };
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  tocPanel,
}) => {
  const { t } = useTranslation();
  const { rejectedSegmentsCount,checked_percentage,checkedSegmentsCount  } = useDocument();
  const { isBusy:isLoadingOrSaving} = useOutlinerDocument();

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
        {/* <AIDetectionButton/> */}
        <WorkSpaceHeaderMenu/>
        <ActionButton/>
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
