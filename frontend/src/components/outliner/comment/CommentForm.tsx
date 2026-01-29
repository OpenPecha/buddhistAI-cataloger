import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { useUser } from '@/hooks/useUser';
import React, { useCallback, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {  Send } from 'lucide-react';



function CommentForm({ segmentId }: { segmentId: string }) {
    const { createCommentMutation } = useOutlinerDocument();
    const [commentContent, setCommentContent] = useState('');
    const { user } = useUser();


 // Handle comment submission (separate from save button)
 const handleCommentSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!segmentId || !commentContent.trim()) {
      return;
    }

    const username = user?.name || user?.email || 'Unknown';

    try {
      await createCommentMutation.mutateAsync({
        segmentId,
        comment: {
          content: commentContent.trim(),
          username,
        },
      });

      setCommentContent(''); // Clear input after successful submission
    } catch (error) {
      // Error is already handled by the mutation's onError
      console.warn('Failed to add comment:', error);
    }
  }, [commentContent, user, segmentId, createCommentMutation]);


  return (
    <form onSubmit={handleCommentSubmit} className="mt-4 space-y-2">
   

    <Field orientation="horizontal">
      <Input className='w-full bg-white'  value={commentContent} onChange={(e) => setCommentContent(e.target.value)} type="type"  placeholder="type your comment here..." />
      <Button onClick={handleCommentSubmit}
      disabled={createCommentMutation.isPending} >        <Send />
      </Button>
    </Field>
  </form>
  )
}

export default CommentForm
