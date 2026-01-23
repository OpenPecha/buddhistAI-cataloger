import React, { useRef, useEffect } from 'react';
import { MessageCircle, UserIcon } from 'lucide-react';
import type { Comment } from '@/api/outliner';
import { formatDistanceToNow } from 'date-fns';

interface CommentViewProps {
  readonly comments: Comment[];
  readonly showFull?: boolean;
}


function CommentView({ comments, showFull = false }: CommentViewProps) {
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  // Always scroll to the last message on load or when comments change (for full view)
  useEffect(() => {
    if (showFull && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [comments, showFull]);

  if (!comments || comments.length === 0) return null;

  return (
      <div className="flex-1 h-full">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
          <span className="text-xs text-gray-500">({comments.length})</span>
        </div>
        <div className="space-y-3 max-h-[30vh] overflow-y-auto" style={{ position: 'relative' }}>
          {comments.map((c, index) => (
            <div key={`comment-${c.timestamp || index}-${index}`} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-gray-700 flex"><UserIcon className="h-4 w-4 text-gray-500" /> {c.username}</span>
                <span className="text-xs text-gray-500">
                  {c.timestamp ? formatDistanceToNow(new Date(c.timestamp).toUTCString(),{ addSuffix: true }) : ''}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
          {/* Dummy div to scroll into view */}
          <div ref={commentsEndRef} />
        </div>
      </div>
    );
  }

export default CommentView
