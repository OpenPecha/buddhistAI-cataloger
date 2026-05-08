import { Button } from '@/components/ui/button'
import { useActions, useDocument } from '@/features/outliner/contexts';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { Loader2, Sparkles, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next';

function AIDetectionButton() {
  const { t } = useTranslation();
  const { aiTextEndingLoading } = useDocument()
  const { documentId, isBusy: isLoadingOrSaving } = useOutlinerDocument();

  const {
    onAIDetectTextEndings,
    onAITextEndingStop,
  } = useActions()
  const disableAIButton = isLoadingOrSaving || aiTextEndingLoading || !documentId;

  return (
    <div>
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
      <Button
        variant="outline"
        onClick={onAIDetectTextEndings}
        disabled={disableAIButton}
        title={t('outliner.workspace.aiOutlineTitle')}
        className="flex items-center gap-2"
      >
        {aiTextEndingLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('outliner.workspace.detecting')}
          </>
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
      </Button>

    </div>
  )
}

export default AIDetectionButton
