
import { Button } from "../ui/button";
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { updateDocumentStatus } from '@/api/outliner';
import { toast } from 'sonner';

function SubmitToReview() {
    const { documentId } = useParams<{ documentId: string }>();
    const navigate=useNavigate();

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