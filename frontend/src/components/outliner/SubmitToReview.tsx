
import { Button } from "../ui/button";
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { updateDocumentStatus } from '@/api/outliner';
import { toast } from 'sonner';
import { useDocument } from './contexts';

function SubmitToReview() {
    const { documentId } = useParams<{ documentId: string }>();
    const navigate = useNavigate();
    const { segments } = useDocument();

    const rejectedCount = segments.filter(s => s.status === 'rejected').length;

    const updateStatusMutation = useMutation({
        mutationFn: () => updateDocumentStatus(documentId!, 'completed'),
        onSuccess: () => {
            toast.success('Document status updated to completed');
            navigate('/outliner')
        },
        onError: (error: Error) => {
            toast.error(`Failed to update document status: ${error.message}`);
        },
    });

    function handleStatusUpdate() {
        if (!documentId) {
            toast.error('Document ID not found');
            return;
        }
        if (rejectedCount > 0) {
            toast.error(`Cannot submit: ${rejectedCount} segment(s) are rejected and need revision`);
            return;
        }
        updateStatusMutation.mutate();
    }
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full flex justify-start"
        onClick={(e) => {
          e.stopPropagation();
          handleStatusUpdate()
        }}
      >
        Submit to Review
      </Button>
    );
  }
  
  export default SubmitToReview;