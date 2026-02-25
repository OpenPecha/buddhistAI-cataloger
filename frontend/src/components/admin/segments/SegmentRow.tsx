import React from 'react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
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
  const {
    isSaving,
    updateSegment: updateSegmentBackend,
  } = useOutlinerDocument();

 

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
            className="inline-block rounded-full bg-blue-100 text-blue-800 px-2 py-1 text-xs font-semibold mr-1"
            title="Segment approved"
          >
            Approved
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
      </TableCell>
      <TableCell className="px-6 py-4">
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
      </TableCell>
      <TableCell className="px-6 py-4">
        {segment.comments && segment.comments.length > 0 && (
          <span>{segment.comments.length}</span>
        )}
      </TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        {segment.status === 'checked' ? (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            variant="outline"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        ) : (segment.status === 'approved' &&
          <Button size="sm" onClick={handleReset} disabled={isSaving} variant="outline">
            Reset
          </Button>
        )}
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