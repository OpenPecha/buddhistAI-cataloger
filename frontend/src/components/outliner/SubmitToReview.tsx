import { Button } from "../ui/button";
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { submitDocumentToBdrcInReview } from '@/api/outliner';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';

interface SubmitToReviewProps {
  disabled?: boolean;
  disabledReason?: string;
}

function SubmitToReview({ disabled, disabledReason }: SubmitToReviewProps) {
    const { t } = useTranslation();
    const { documentId } = useParams<{ documentId: string }>();
    const navigate = useNavigate();

    const updateStatusMutation = useMutation({
        mutationFn: () => submitDocumentToBdrcInReview(documentId!),
        onSuccess: () => {
            toast.success(t('outliner.submitReview.success'));
            navigate('/outliner')
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    function handleStatusUpdate() {
        if (!documentId) {
            toast.error(t('outliner.submitReview.noDocumentId'));
            return;
        }
        updateStatusMutation.mutate();
    }

    const isLoading = updateStatusMutation.isPending;

    return (
      <Button
        type="button"
        disabled={disabled || isLoading}
        title={disabled ? disabledReason : t('outliner.submitReview.title')}
        className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleStatusUpdate}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {t('outliner.submitReview.submit')}
      </Button>
    );
}

export default SubmitToReview;