import React from 'react';
import { MessageCircle } from 'lucide-react';
import type { CommentsData, Comment } from '@/api/outliner';

interface CommentViewProps {
  readonly comment: string | CommentsData | null | undefined;
  readonly showFull?: boolean;
}

function CommentView({ comment, showFull = false }: CommentViewProps) {
  if (!comment) return null;

  // Parse comment - handle both old string format and new CommentsData format
  let comments: Comment[] = [];
  
  if (typeof comment === 'string') {
    // Old format: single string comment
    if (comment.trim()) {
      comments = [{
        content: comment,
        username: 'Unknown',
        timestamp: new Date().toISOString()
      }];
    }
  } else if (comment && typeof comment === 'object' && 'comments' in comment) {
    // New format: CommentsData with comments array
    comments = comment.comments || [];
  }

  if (comments.length === 0) return null;

  if (showFull) {
    // Full conversation view for sidebar
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
          <span className="text-xs text-gray-500">({comments.length})</span>
        </div>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.map((c, index) => (
            <div key={`comment-${c.timestamp || index}-${index}`} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-gray-700">{c.username}</span>
                <span className="text-xs text-gray-500">
                  {c.timestamp ? new Date(c.timestamp).toLocaleString() : ''}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Compact view for segment items (tooltip)
  return (
    <div className="relative inline-flex items-center group float-right">
      {/* Icon */}
      <MessageCircle className="h-4 w-4 text-red-400 cursor-pointer" />
      
      {/* Tooltip - aligned to the right of the icon */}
      <div
        className="
          absolute right-full top-1/2 z-50 ml-2 w-max max-w-xs
          -translate-y-1/2
          rounded-md bg-gray-900 px-3 py-2
          text-xs text-white
          opacity-0 group-hover:opacity-100
          pointer-events-none
          transition-opacity
        "
        style={{ whiteSpace: 'pre-line' }}
      >
        <div className="space-y-2">
          {comments.map((c, index) => (
            <div key={`comment-tooltip-${c.timestamp || index}-${index}`}>
              <div className="font-semibold text-white mb-1">{c.username}:</div>
              <div className="text-gray-200">{c.content}</div>
              {index < comments.length - 1 && <div className="border-t border-gray-700 mt-2 pt-2" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CommentView;
