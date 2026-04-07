import { Button } from "../ui/button";
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
    const { documentId } = useParams<{ documentId: string }>();
    const navigate = useNavigate();

    const updateStatusMutation = useMutation({
        mutationFn: () => submitDocumentToBdrcInReview(documentId!),
        onSuccess: () => {
            toast.success('Submitted to review and synced to BDRC');
            navigate('/outliner')
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    function handleStatusUpdate() {
        if (!documentId) {
            toast.error('Document ID not found');
            return;
        }
        updateStatusMutation.mutate();
    }

    const isLoading = updateStatusMutation.isPending;

    return (
      <Button
        type="button"
        disabled={disabled || isLoading}
        title={disabled ? disabledReason : 'Submit to Review'}
        className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleStatusUpdate}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        Submit
      </Button>
    );
}

export default SubmitToReview;