import type { Document } from '../shared/types';
import { TableCell, TableRow } from '@/components/ui/table';
import { getStatusBadgeClass, STATUS_DIVIDER_COLORS } from './utils';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { OutlinerUser } from '@/hooks';

const STATUS_LABEL: Record<string, string> = {
  active: 'Annotating',
  completed: 'Annotated',
  approved: 'Reviewed',
  rejected: 'Rejected',
};

interface DocumentRowProps {
  readonly document: Document;
  readonly onSelect: (document: Document) => void;
  readonly canReview: boolean;
  readonly annotator?: OutlinerUser;
}

function DocumentRow({ document,annotator, onSelect, canReview }: DocumentRowProps) {
  const statusKey = document.status || 'active';
  /** Prefer server join of rejections → segment status; fall back to rejected-status segment count on older APIs. */
  const openRejectionSegments =
    document.rejection_open_segment_count ?? document.rejection_count ?? 0;
  const needsRejectionAttention = openRejectionSegments > 0;
  /** Prefer total rejection rows; fall back to rejected-segment count when the list API is older. */
  const commentCount = document.rejection_comment_count ?? document.rejection_count ?? 0;
  /** Light orange: rejection history exists and every linked segment is checked or approved. */
  const useLightOrange =
    !needsRejectionAttention &&
    (commentCount > 0 || document.rejection_resolved === true);
  const badgeClass = needsRejectionAttention
    ? 'bg-red-100 text-red-700 border border-red-200'
    : useLightOrange
      ? 'bg-orange-50 text-orange-700 border border-orange-100'
      : 'bg-gray-100 text-gray-600 border border-gray-200';
  const iconClass = needsRejectionAttention
    ? 'text-red-400'
    : useLightOrange
      ? 'text-orange-400'
      : 'text-gray-400';
  const badgeTitle = needsRejectionAttention
    ? 'Rejection comments on segments not yet checked or approved'
    : commentCount > 0
      ? 'Rejection history; every linked segment is checked or approved'
      : document.rejection_resolved
        ? 'Reviewer rejection addressed (segment checked, latest rejection resolved)'
        : 'Rejection comments on segments in this document';
  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="px-6 py-4 whitespace-nowrap flex items-center gap-2">
   <div className="flex flex-col gap-1">

        <div className="text-sm font-medium text-gray-900">
          {document.filename || `Document ${document.id.slice(0, 8)}`}
        </div>
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <img
            src={annotator?.picture ?? undefined}
            alt={annotator?.name ?? annotator?.email ?? 'Annotator'}
            className="w-4 h-4 rounded-full"
          />
        {annotator?.name}
        </div>
   </div>
      </TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap align-middle">
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-sm font-semibold rounded-full transition-colors border ${getStatusBadgeClass(statusKey)}`}
            title={STATUS_LABEL[statusKey] || statusKey}
          >
            <span className={`w-2 h-2 rounded-full mr-2 animate-pulse ${STATUS_DIVIDER_COLORS[statusKey]}`}
            ></span>
            {STATUS_LABEL[statusKey] || statusKey}
          </span>
          {commentCount>0&&<span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${badgeClass}`}
            title={badgeTitle}
          >
           <MessageCircle className={`w-3 h-3 animate-bounce shrink-0 ${iconClass}`}/>
            {commentCount}
          </span>}
        </div>
      </TableCell>
      <TableCell
        className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900"
        title="Checked or approved segments / total segments"
      >
        <Progress value={(document.checked_segments ?? 0)/(document.total_segments ?? 0)*100}  title={`${document.checked_segments ?? 0}/${document.total_segments ?? 0}`}/>
        <span className="text-xs text-gray-600 font-medium ml-2 whitespace-nowrap">
            {(document.checked_segments ?? 0)}/{document.total_segments}
          </span>
      </TableCell>
     
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        {canReview ? (
          <button
            onClick={() => onSelect(document)}
            className="group text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md px-2 py-1 cursor-pointer flex items-center gap-2"
          >
            Review
            <ArrowRight
              className="w-3 h-3 shrink-0 opacity-0 translate-x-[-8px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
            />
          </button>
        ) : (
          <span className="text-gray-400">-</span>
        )}
  
      </TableCell>
    </TableRow>
  );
}

export default DocumentRow;