import { useMemo } from 'react';
import type { Document } from '../shared/types';
import type { Annotator } from '../../../hooks/useAnnotators';
import DocumentRow from './DocumentRow';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Annotating' },
  { value: 'completed', label: 'Annotated' },
  { value: 'approved', label: 'Reviewed' },
] as const;

interface DocumentsTabProps {
  documents: Document[];
  isFetching: boolean;
  onDocumentSelect: (document: Document) => void;
  onDocumentDelete: (documentId: string) => void;
  annotators: Annotator[];
  annotatorsLoading: boolean;
  currentStatus?: string;
  currentAnnotator?: string;
  onFilterChange: (status?: string, annotator?: string) => void;
}

function DocumentsTab({
  documents,
  isFetching,
  onDocumentSelect,
  onDocumentDelete,
  annotators,
  annotatorsLoading,
  currentStatus,
  currentAnnotator,
  onFilterChange,
}: DocumentsTabProps) {
  const annotatorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of annotators) {
      map.set(a.id, a.name || a.id);
    }
    return map;
  }, [annotators]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    onFilterChange(value, currentAnnotator);
  };

  const handleAnnotatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    onFilterChange(currentStatus, value);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Document Management</h3>
            <p className="text-gray-600 mt-1">Review and manage outliner documents</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="status-filter"
                value={currentStatus || ''}
                onChange={handleStatusChange}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="annotator-filter" className="text-sm font-medium text-gray-700">
                Annotator
              </label>
              <select
                id="annotator-filter"
                value={currentAnnotator || ''}
                onChange={handleAnnotatorChange}
                disabled={annotatorsLoading}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">All Annotators</option>
                {annotators.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="relative overflow-x-auto">
          {isFetching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] transition-opacity">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Annotator
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Segments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    No documents found for the selected filters.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    document={doc}
                    annotatorName={doc.user_id ? annotatorMap.get(doc.user_id) : undefined}
                    onSelect={onDocumentSelect}
                    onDelete={onDocumentDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DocumentsTab;