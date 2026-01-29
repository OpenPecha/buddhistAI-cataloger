import { useComment } from '@/hooks/useComment';
import React from 'react'
import CommentForm from './CommentForm';
import CommentView from './CommentView';

function Comments({ segmentId }: { segmentId: string }) {

      // Fetch comments separately using useComment hook
  const { comments, isLoading: isLoadingComments } = useComment(segmentId, {
    enabled: !!segmentId,
  });
if (!segmentId ||segmentId.length === 0) return null;
return (
    <div className="flex flex-col justify-end h-full flex-1  pt-4 ">
      {isLoadingComments ? (
        <div className="text-sm text-gray-500">Loading comments...</div>
      ) : (
        <CommentView comments={comments} showFull={true} />
      )}
      <CommentForm segmentId={segmentId} />
    </div>
  )
}

export default Comments
