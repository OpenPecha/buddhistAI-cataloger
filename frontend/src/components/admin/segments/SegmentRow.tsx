import React, { useState, useCallback } from 'react';
import type { Segment } from '../shared/types';
import { Button } from '@/components/ui/button';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { useUser } from '@/hooks/useUser';
import CommentView from '@/components/outliner/CommentView';

interface SegmentRowProps {
 readonly segment: Segment;
 readonly isExpanded: boolean;
 readonly onToggleExpansion: (segmentId: string) => void;
}

function SegmentRow({
  segment,
  isExpanded,
  onToggleExpansion,
}: SegmentRowProps) {
  const [commentContent, setCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const {
    isSaving,
    updateSegment: updateSegmentBackend,
  } = useOutlinerDocument();
  const { user } = useUser();

  // Handle comment submission (separate from save button)
  const handleCommentSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!commentContent.trim()) {
      return;
    }

    const username = user?.name || user?.email || 'Unknown';
    setIsSubmittingComment(true);

    try {
      await updateSegmentBackend(segment.id, {
        comment_content: commentContent.trim(),
        comment_username: username,
      });
      setCommentContent(''); // Clear input after successful submission
    } catch (e) {
      console.warn('Failed to add comment:', e);
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentContent, user, updateSegmentBackend, segment.id]);

  // Handle Enter key in comment textarea
  const handleCommentKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommentSubmit();
    }
  }, [handleCommentSubmit]);

  const handleSave = async () => {
    try {
      await updateSegmentBackend(segment.id, {
        status: 'approved',
      });
    } catch(e) {
      console.warn(e);
    }
  };

  const handleReset = async () => {
    try {
      await updateSegmentBackend(segment.id,{
        status:"unchecked",
      })
    } catch(e){
      console.warn(e)
    }
  };



  return (
    <React.Fragment>
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {segment.status === 'approved' ? (
            <span
              className="inline-block rounded-full bg-blue-100 text-blue-800 px-2 py-1 text-xs font-semibold mr-1"
              title="Segment approved"
            >
              Approved
            </span>
          ):
          <span
            className={
              segment.status === 'checked'
                ? 'inline-block rounded-full bg-green-100 text-green-800 px-2 py-1 text-xs font-semibold'
                : 'inline-block rounded-full bg-yellow-100 text-yellow-800 px-2 py-1 text-xs font-semibold'
            }
            title={
              segment.status === 'checked'
                ? 'Segment done'
                : 'Segment in progress'
            }
          >
            {segment.status === 'checked' ? 'Done' : 'Under Process'}
          </span>
          }
        </td>
        <td className="px-6 py-4 max-w-xs">
          <div
            className="text-sm text-gray-900 cursor-pointer hover:text-blue-600"
            onClick={() => onToggleExpansion(segment.id)}
          >
            <span className="truncate block">
              {segment.text.substring(0, 100)}...
            </span>
            <span className="text-xs text-blue-500 mt-1">
              {isExpanded ? 'Click to collapse' : 'Click to expand'}
            </span>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm">
            {segment.title ? (
              <div>
                <div className="font-medium text-gray-900">{segment.title}</div>
                {segment.title_bdrc_id && (
                  <div className="text-xs text-gray-500">BDRC: {segment.title_bdrc_id}</div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 italic">No title</div>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm">
            {segment.author ? (
              <div>
                <div className="font-medium text-gray-900">{segment.author}</div>
                {segment.author_bdrc_id && (
                  <div className="text-xs text-gray-500">BDRC: {segment.author_bdrc_id}</div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 italic">No author</div>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="space-y-2">
            {/* Show existing comments */}
            <CommentView comment={segment.comment} showFull={true} />
            
            {/* Comment Input */}
            <form onSubmit={handleCommentSubmit} className="mt-2">
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                onKeyDown={handleCommentKeyDown}
                placeholder="Add a comment... (Press Enter to submit)"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                disabled={isSubmittingComment}
              />
              <div className="flex justify-end mt-1">
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  disabled={!commentContent.trim() || isSubmittingComment}
                  className="h-6 text-xs"
                >
                  {isSubmittingComment ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </form>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        {segment.status==='checked' ?<Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving }
              variant="outline"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>:
            segment.status==='approved' && 
        <Button size="sm" onClick={handleReset} disabled={isSaving } variant="outline">
          Reset
        </Button>}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-6 py-4">
            <div className="bg-white border rounded-lg p-4 shadow-sm">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Full Text:</h4>
              <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {segment.text}
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

export default SegmentRow;