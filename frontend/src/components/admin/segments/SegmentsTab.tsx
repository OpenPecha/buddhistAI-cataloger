import React from 'react';
import type { Document, Segment } from '../shared/types';
import SegmentRow from './SegmentRow';

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
  return (
    <div className="space-y-6">
      {selectedDocument && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Segments for: {selectedDocument.filename || `Document ${selectedDocument.id.slice(0, 8)}`}
          </h3>
          <p className="text-sm text-gray-600">
            Progress: {selectedDocument.annotated_segments}/{selectedDocument.total_segments} segments annotated
          </p>
        </div>
      )}

      {loadingSegments ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading segments...</span>
        </div>
      ) : segments.length === 0 && selectedDocument ? (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-gray-600">No segments found for this document.</p>
        </div>
      ) : selectedDocument ? (
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900">Segment Management</h3>
            <p className="text-gray-600 mt-1">View segment details and add comments. Click text preview to expand full content.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Index
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Text Preview
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title & BDRC ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Author & BDRC ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {segments.map((segment) => (
                  <SegmentRow
                    key={segment.id}
                    segment={segment}
                    isExpanded={expandedSegments.has(segment.id)}
                    onToggleExpansion={onToggleExpansion}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-gray-600">Select a document to view its segments.</p>
        </div>
      )}
    </div>
  );
}

export default SegmentsTab;