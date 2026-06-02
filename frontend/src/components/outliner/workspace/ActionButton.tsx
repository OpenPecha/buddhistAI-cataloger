import SubmitToReview from '../SubmitToReview'
import { useTranslation } from 'react-i18next';
import { useDocument } from '../contexts';

function ActionButton() {
    const {t}=useTranslation();
    const { segmentsCount, checkedSegmentsCount, rejectedSegmentsCount, checked_percentage } = useDocument();

    const notSavedCount = segmentsCount - checkedSegmentsCount;
    const submitDisabled = checked_percentage < 100 || rejectedSegmentsCount > 0;
    let submitDisabledReason: string | undefined;
    if (rejectedSegmentsCount > 0) {
      submitDisabledReason = t('outliner.workspace.revisionBadge', { count: rejectedSegmentsCount });
    } else if (checked_percentage < 100) {
      submitDisabledReason = t('outliner.workspace.submitNotSaved', { count: notSavedCount });
    }

  return (
    <SubmitToReview
      disabled={submitDisabled}
      disabledReason={submitDisabledReason}
    />
  )
}

export default ActionButton
