import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSegment, rejectSegment } from '@/api/outliner';
import { toast } from 'sonner';
import { useBdrcWork, type BdrcWorkInfo } from '@/hooks/useBdrcSearch';
import { AlertCircle, FileText, Hash, Loader2, User } from 'lucide-react';
import type { Segment } from '../shared/types';



interface SegmentRowProps {
  readonly segment: Segment;
  readonly isExpanded: boolean;
  readonly onToggleExpansion: (segmentId: string) => void;
  readonly onSegmentClick?: (segment: Segment) => void;
}

function SegmentRow({
  segment,
  isExpanded,
  onToggleExpansion,
  onSegmentClick,
}: SegmentRowProps) {
  const { documentId } = useParams<{ documentId: string }>();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const statusMutation = useMutation({
    mutationFn: (newStatus: 'approved' | 'unchecked') =>
      updateSegment(segment.id, { status: newStatus }),
    onSuccess: (_data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      toast.success(newStatus === 'approved' ? 'Segment approved' : 'Segment reset');
    },
    onError: (error: Error, newStatus) => {
      toast.error(
        `Failed to ${newStatus === 'approved' ? 'approve' : 'reset'} segment: ${error.message}`
      );
    },
    onSettled: () => setIsSaving(false),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectSegment(segment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      toast.success('Segment rejected');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject segment: ${error.message}`);
    },
    onSettled: () => setIsSaving(false),
  });

  const handleSave = () => {
    setIsSaving(true);
    statusMutation.mutate('approved');
  };

  const handleReject = () => {
    setIsSaving(true);
    rejectMutation.mutate();
  };

  const handleReset = () => {
    setIsSaving(true);
    statusMutation.mutate('unchecked');
  };



  const handleRowClick = (e: React.MouseEvent) => {
    // Prevent opening sidebar if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, input, textarea, [role="button"]')) {
      return;
    }
    onSegmentClick?.(segment);
  };

  return (
    <React.Fragment>
    <TableRow
      className="hover:bg-gray-50 cursor-pointer"
      onClick={handleRowClick}
    >
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {segment.status === 'approved' ? (
          <span
            className="inline-block rounded-full bg-blue-100 text-blue-800 px-2 py-1 text-xs font-semibold"
            title="Segment approved"
          >
            Approved
          </span>
        ) : segment.status === 'rejected' ? (
          <span
            className="inline-block rounded-full bg-red-100 text-red-800 px-2 py-1 text-xs font-semibold"
            title="Segment rejected"
          >
            Rejected{(segment.rejection_count ?? 0) > 1 ? ` (${segment.rejection_count}x)` : ''}
          </span>
        ) : (
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
        )}
      </TableCell>
      <TableCell className="px-6 py-4 max-w-xs">
        <div
          className="text-sm text-gray-900 cursor-pointer hover:text-blue-600"
          onClick={(e) =>{
            e.stopPropagation();
            onToggleExpansion(segment.id)
          }
          } 
        >
          <span className="truncate block">
            {segment.text.substring(0, 100)}...
          </span>
          <span className="text-xs text-blue-500 mt-1">
            {isExpanded ? 'Click to collapse' : 'Click to expand'}
          </span>
        </div>
      </TableCell>
      <TableCell className="px-6 py-4">
        <div className="text-sm flex flex-col gap-1">
          <span className="font-medium text-gray-900 flex gap-1 items-center"><FileText className="w-4 h-4"/>{segment.title || "---"}</span>
          <span className="text-xs text-gray-500 flex gap-1 items-center"><User className="w-4 h-4"/>{segment.author || "---"}</span>
        </div>
      </TableCell>
      <TableCell className="px-6 py-4">
        <div className="text-sm">
           <BDRCInfo workId={segment.title_bdrc_id ?? ''} />
        </div>
      </TableCell>
      <TableCell className="px-6 py-4">
        {segment.comments && segment.comments.length > 0 && (
          <span>{segment.comments.length}</span>
        )}
      </TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        {segment.status === 'checked' ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              variant="outline"
            >
              {isSaving ? 'Saving...' : 'Approve'}
            </Button>
            <Button
              size="sm"
              onClick={handleReject}
              disabled={isSaving}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
            >
              Reject
            </Button>
          </div>
        ) : segment.status === 'approved' ? (
          <Button size="sm" onClick={handleReset} disabled={isSaving} variant="outline">
            Reset
          </Button>
        ) : segment.status === 'rejected' ? (
          <Button size="sm" onClick={handleReset} disabled={isSaving} variant="outline">
            Reset
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
    
    {isExpanded && (
      <TableRow className="bg-gray-50">
        <TableCell colSpan={6} className="px-6 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-900">Full Text:</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {segment.text}
              </div>
            </CardContent>
          </Card>
        </TableCell>
      </TableRow>
    )}
    </React.Fragment>
  );
}

export default SegmentRow;




const BDRCInfo = ({ workId }: { workId: string }) => {
  const { work, isLoading: workLoading } = useBdrcWork(workId);
  const [workDialogId, setWorkDialogId] = useState<string | null>(null);
  if (!workId || workId==="") return null;
  if (workLoading) return <Loader2 className="h-4 w-4 animate-spin shrink-0" />;
  return (
    <>
    <button
    type="button" 
    onClick={(e) => {
      e.stopPropagation();
      setWorkDialogId(workId);
    }}
    className="text-blue-600  hover:text-blue-800 hover:underline font-monlam text-sm"
    >{work?.title}
  </button>
  <Dialog open={!!workDialogId} onOpenChange={(open) => !open && setWorkDialogId(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">BDRC work</DialogTitle>
        </DialogHeader>
        {workDialogId && (
          <BdrcWorkDialogBody
            workId={workDialogId}
            work={work}
            isLoading={workLoading}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}


function BdrcWorkDialogBody({
  workId,
  work,
  isLoading,
}: Readonly<{
  workId: string;
  work: BdrcWorkInfo | null;
  isLoading: boolean;
}>) {
  if (isLoading) {
    return (
      <div className="flex min-h-30 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/90 px-4 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-hidden />
        <p className="text-center text-sm text-gray-600">Loading work details…</p>
      </div>
    );
  }
  if (!work) {
    return (
      <div
        className="flex gap-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
        role="alert"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
        <div>
          <p className="font-medium">Couldn’t load this work</p>
          <p className="mt-1 text-amber-900/85">
            The record may be missing or the request failed. Try again later.
          </p>
        </div>
      </div>
    );
  }

  const authorNames = work.authors.map((a) => a.name).filter(Boolean);
  const authorsWithNames = work.authors.filter((a) => a.name?.trim());

  let authorsBody: React.ReactNode;
  if (authorNames.length === 0) {
    authorsBody = <span className="text-gray-400">—</span>;
  } else if (authorNames.length === 1) {
    authorsBody = authorNames[0];
  } else {
    authorsBody = (
      <ul className="list-disc space-y-1 pl-4 marker:text-gray-300">
        {authorsWithNames.map((author, i) => (
          <li key={author.id ?? `author-${i}`} className="leading-snug">
            {author.name}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <dl className="divide-y divide-gray-100">
        <div className="px-4 py-3 sm:grid sm:grid-cols-[6.5rem_1fr] sm:items-start sm:gap-4">
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Hash className="h-3.5 w-3.5 opacity-70" aria-hidden />
            Work ID
          </dt>
          <dd className="mt-1 break-all font-mono text-sm text-gray-900 sm:mt-0">{workId}</dd>
        </div>
        <div className="px-4 py-3 sm:grid sm:grid-cols-[6.5rem_1fr] sm:items-start sm:gap-4">
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <FileText className="h-3.5 w-3.5 opacity-70" aria-hidden />
            Title
          </dt>
          <dd className="mt-1 text-sm font-medium leading-snug text-gray-900 sm:mt-0">
            {work.title?.trim() ? work.title : <span className="font-normal text-gray-400">—</span>}
          </dd>
        </div>
        <div className="px-4 py-3 sm:grid sm:grid-cols-[6.5rem_1fr] sm:items-start sm:gap-4">
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <User className="h-3.5 w-3.5 opacity-70" aria-hidden />
            {authorNames.length === 1 ? 'Author' : 'Authors'}
          </dt>
          <dd className="mt-1 text-sm text-gray-900 sm:mt-0">{authorsBody}</dd>
        </div>
      </dl>
    </div>
  );
}