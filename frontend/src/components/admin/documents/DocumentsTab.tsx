import { useMemo } from 'react';
import { Search } from 'lucide-react';
import type { Document } from '../shared/types';
import type { OutlinerUser } from '../../../hooks/useOutlinerUsers';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  annotators: OutlinerUser[];
  annotatorsLoading: boolean;
  currentStatus?: string;
  currentAnnotator?: string;
  titleSearch: string;
  debouncedTitle: string;
  onTitleSearchChange: (value: string) => void;
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
  titleSearch,
  debouncedTitle,
  onTitleSearchChange,
  onFilterChange,
}: Readonly<DocumentsTabProps>) {
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

            <div className="relative w-full min-w-[200px] max-w-xs sm:w-64">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none"
                aria-hidden
              />
              <Input
                id="document-title-search"
                type="search"
                placeholder="Search by title…"
                value={titleSearch}
                onChange={(e) => onTitleSearchChange(e.target.value)}
                className="pl-9 h-9 text-sm"
                aria-label="Search documents by title"
              />
            </div>
          </div>
        </div>

        <div className="relative">
          {isFetching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] transition-opacity">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          <Table className="min-w-full divide-y divide-gray-200">
            <TableHeader className="bg-gray-50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Annotator
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Segments
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white divide-y divide-gray-200">
              {documents.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    {debouncedTitle.trim()
                      ? 'No documents match your search.'
                      : 'No documents found for the selected filters.'}
                  </TableCell>
                </TableRow>
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
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default DocumentsTab;