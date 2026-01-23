import React, { useState } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Document, Segment } from '../shared/types';
import SegmentRow from './SegmentRow';
import SegmentSidebar from './SegmentSidebar';

interface SegmentsTabProps {
  readonly selectedDocument: Document | null;
  readonly segments: Segment[];
  readonly loadingSegments: boolean;
  readonly expandedSegments: Set<string>;
  readonly onToggleExpansion: (segmentId: string) => void;
}

function SegmentsTab({
  selectedDocument,
  segments,
  loadingSegments,
  expandedSegments,
  onToggleExpansion,
}: SegmentsTabProps) {
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSegmentClick = (segment: Segment) => {
    setSelectedSegment(segment);
    setIsSidebarOpen(true);
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
    setSelectedSegment(null);
  };
  return (
    <div className="space-y-6">
      {selectedDocument && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Segments for: {selectedDocument.filename || `Document ${selectedDocument.id.slice(0, 8)}`}
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Progress: {selectedDocument.annotated_segments}/{selectedDocument.total_segments} segments annotated
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {loadingSegments ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading segments...</span>
        </div>
      ) : segments.length === 0 && selectedDocument ? (
        <Card className="text-center">
          <CardContent className="py-6">
            <p className="text-gray-600">No segments found for this document.</p>
          </CardContent>
        </Card>
      ) : selectedDocument ? (
        <Card>
          <CardHeader className="px-6 py-4 border-b border-gray-200">
            <CardTitle className="text-xl font-semibold text-gray-900">Segment Management</CardTitle>
            <CardDescription className="text-gray-600 mt-1">View segment details and add comments. Click text preview to expand full content.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-full divide-y divide-gray-200">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Index
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Text Preview
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title & BDRC ID
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Author & BDRC ID
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comment
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white divide-y divide-gray-200">
                  {segments.map((segment) => (
                    <SegmentRow
                      key={segment.id}
                      segment={segment}
                      isExpanded={expandedSegments.has(segment.id)}
                      onToggleExpansion={onToggleExpansion}
                      onSegmentClick={handleSegmentClick}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="text-center">
          <CardContent className="py-6">
            <p className="text-gray-600">Select a document to view its segments.</p>
          </CardContent>
        </Card>
      )}

      {/* Segment Sidebar */}
      <SegmentSidebar
        segment={selectedSegment}
        isOpen={isSidebarOpen}
        onClose={handleSidebarClose}
      />
    </div>
  );
}

export default SegmentsTab;