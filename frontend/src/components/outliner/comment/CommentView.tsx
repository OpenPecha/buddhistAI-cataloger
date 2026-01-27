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
            <EachComment key={`comment-${c.timestamp || index}-${index}`} comment={c} index={index} />
          ))}
          {/* Dummy div to scroll into view */}
          <div ref={commentsEndRef} />
        </div>
      </div>
    );
  }



const EachComment = ({ comment, index }: { comment: Comment, index: number }) => {
  const utcDate = new Date(comment.timestamp);
  const istDate = new Date(utcDate.getTime() + (5 * 60 + 30) * 60 * 1000);

  // Heuristic: treat "me" if username is "You" or similar; for real projects, pass currentUser info down
  // For demo, make messages from "You" right-aligned, others left-aligned
  const alignRight = comment.username?.toLowerCase?.() === "you"; 

  // WhatsApp bubble colors (approx. as Tailwind doesn't have WhatsApp, but custom colors used below)
  const whatsappGreen = alignRight ? "#d9fdd3" : "#fff"; // sent / received background
  const whatsappBorder = alignRight ? "#b2efb0" : "#ececec";
  const whatsappText = "#111b21";
  const whatsappTime = "#667781";

  return (
    <div
      key={`comment-${comment.timestamp}-${index}`}
      className={`flex w-full ${alignRight ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`
          relative max-w-[75%] flex flex-col shadow-sm
          ${alignRight
            ? "rounded-tl-xl rounded-bl-xl rounded-tr-md rounded-br-2xl ml-8"
            : "rounded-tr-xl rounded-br-xl rounded-tl-md rounded-bl-2xl mr-8"}
          mb-3
        `}
        style={{
          backgroundColor: whatsappGreen,
          border: `1px solid ${whatsappBorder}`,
        }}
      >
        <div
          className={`flex items-center gap-2 mb-1 px-3 pt-2 ${
            alignRight ? "justify-end flex-row-reverse" : "justify-start"
          }`}
        >
          <span
            className={`
              text-xs font-semibold flex items-center gap-1
              ${alignRight ? "text-[#25d366]" : "text-[#53bdeb]"}
            `}
          >
            <UserIcon className="h-4 w-4 text-gray-400" />
            {comment.username}
          </span>
          <span
            className="text-[0.68rem]"
            style={{ color: whatsappTime }}
          >
            {formatDistanceToNow(istDate, { addSuffix: true })}
          </span>
        </div>
        <div
          className={`
            whitespace-pre-wrap px-3 pb-1 text-[0.98rem]
            ${alignRight ? "text-right" : "text-left"}
          `}
          style={{
            color: whatsappText,
            wordBreak: "break-word",
          }}
        >
          {comment.content}
        </div>
      </div>
    </div>
  );
}


export default CommentView
