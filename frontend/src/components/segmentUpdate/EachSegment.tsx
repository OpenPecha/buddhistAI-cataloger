import { useState } from "react";
import { useUpdateSegmentContent } from "@/hooks/useTexts";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface EachSegmentProps {
  readonly segment: string;
  readonly segmentId: string | undefined;
}

export function EachSegment({ segment, segmentId }: EachSegmentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(segment);
  const updateSegmentMutation = useUpdateSegmentContent();

  const isLoading = updateSegmentMutation.isPending;
  const error = updateSegmentMutation.error;
  const isSuccess = updateSegmentMutation.isSuccess;

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(segment);
    updateSegmentMutation.reset();
  };

  const handleUpdate = async () => {
    if (!segmentId) {
      return;
    }

    try {
      await updateSegmentMutation.mutateAsync({
        segmentId,
        content: editValue,
      });
      setIsEditing(false);
    } catch (err) {
      // Error is handled by React Query
      console.error("Failed to update segment:", err);
    }
  };



  if (!segmentId) {
    return (
      <div className="flex items-center gap-2 p-2 border-b border-gray-200 last:border-b-0">
        <span className="text-sm text-gray-700 flex-1">{segment}</span>
        <span className="text-xs text-gray-400">No segment ID</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 border-b border-gray-200 last:border-b-0">
      {isEditing ? (
        <>
          <input
            type="text"
            className="flex-1 px-2 py-1 border rounded"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            disabled={isLoading}
          />
          <Button
            onClick={handleUpdate}
            disabled={isLoading}
            size="sm"
            className="px-2 py-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Updating...
              </>
            ) : (
              "Update"
            )}
          </Button>
          <Button
            onClick={handleCancel}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="px-2 py-1 ml-2"
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span className="text-xl text-gray-700 flex-1">{segment}</span>
          <Button
            onClick={handleEditClick}
            variant="outline"
            size="sm"
            className="px-2 py-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 text-xs"
          >
            Edit
          </Button>
        </>
      )}
      {error && (
        <span className="text-xs text-red-500 ml-2">
          {error instanceof Error ? error.message : "Update failed"}
        </span>
      )}
      {isSuccess && !isEditing && (
        <span className="text-xs text-green-600 ml-2">Updated!</span>
      )}
    </div>
  );
}
