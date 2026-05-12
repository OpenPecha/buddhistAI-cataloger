
import type { Document } from '../shared/types';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';



import DocumentRow from './DocumentRow';
import { UserFilter } from './UserFilter';
import DocumentStatusFilter from './DocumentStatusFilter';
import { useDocuments, useOutlinerUsers, type DocumentFilters } from '@/hooks';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TitleFilter from './TitleFilter';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';



interface DocumentsTabProps {
  onDocumentSelect: (document: Document) => void;
  onDocumentDelete: (documentId: string) => void;
}

function DocumentsTab({
  onDocumentSelect,
  onDocumentDelete,
}: Readonly<DocumentsTabProps>) {
 
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || undefined;
  const annotator = searchParams.get('annotator') || undefined;
  const debouncedTitle=searchParams.get('title') || undefined
  const includeApproved = searchParams.get('include_approved') === 'true';
  const includeSkipped = searchParams.get('include_skipped') === 'true';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);

  const [draftStatus, setDraftStatus] = useState(status ?? 'all');
  const [draftAnnotator, setDraftAnnotator] = useState(annotator ?? 'all');
  const [draftTitle, setDraftTitle] = useState(debouncedTitle ?? '');
  const [draftIncludeApproved, setDraftIncludeApproved] = useState(includeApproved);
  const [draftIncludeSkipped, setDraftIncludeSkipped] = useState(includeSkipped);

  useEffect(() => {
    setDraftStatus(status ?? 'all');
    setDraftAnnotator(annotator ?? 'all');
    setDraftTitle(debouncedTitle ?? '');
    setDraftIncludeApproved(includeApproved);
    setDraftIncludeSkipped(includeSkipped);
  }, [status, annotator, debouncedTitle, includeApproved, includeSkipped]);
  const filters:DocumentFilters = useMemo(
    () => ({
      status,
      userId: annotator,
      title: debouncedTitle || undefined,
      page,
      pageSize: 20,
      includeApproved,
      includeSkipped,
      excludeOwnAssignedDocuments: true,
    }),
    [status, annotator, debouncedTitle, page, includeApproved, includeSkipped]
  );

  
  const {
    documents,
    isFetching,
  } = useDocuments(filters);

  const applyFilters = () => {
    setSearchParams((params) => {
      if (draftStatus === 'all') params.delete('status');
      else params.set('status', draftStatus);

      if (draftAnnotator === 'all') params.delete('annotator');
      else params.set('annotator', draftAnnotator);

      const trimmedTitle = draftTitle.trim();
      if (trimmedTitle) params.set('title', trimmedTitle);
      else params.delete('title');
      if (draftIncludeApproved) params.set('include_approved', 'true');
      else params.delete('include_approved');
      if (draftIncludeSkipped) params.set('include_skipped', 'true');
      else params.delete('include_skipped');

      params.set('page', '1');
      return params;
    });
  };
  const isApplyDisabled =
    draftStatus === (status ?? 'all') &&
    draftAnnotator === (annotator ?? 'all') &&
    draftTitle.trim() === (debouncedTitle ?? '').trim() &&
    draftIncludeApproved === includeApproved &&
    draftIncludeSkipped === includeSkipped;

  const { users: outlinerUsers } = useOutlinerUsers();
  const getAnnotator = (userId: string) => {
    return outlinerUsers.find((user) => user.id === userId) || null;
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0  pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Document Management</h3>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <DocumentStatusFilter value={draftStatus} onChange={setDraftStatus} />
          </div>

          <div className="flex items-center gap-2">
            <UserFilter value={draftAnnotator} onChange={setDraftAnnotator} />
          </div>

          <div className="relative w-full min-w-[200px] max-w-xs sm:w-64">
            <TitleFilter value={draftTitle} onChange={setDraftTitle} />
          </div>
          <div className="flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2">
            <span className='text-sm text-gray-700'>include statuses</span>
            <label htmlFor="admin-include-approved" className="flex items-center gap-2 text-sm text-gray-700">
              <Checkbox
                id="admin-include-approved"
                checked={draftIncludeApproved}
                onCheckedChange={(checked) => setDraftIncludeApproved(checked === true)}
              />
              Approved
            </label>
            <label htmlFor="admin-include-skipped" className="flex items-center gap-2 text-sm text-gray-700">
              <Checkbox
                id="admin-include-skipped"
                checked={draftIncludeSkipped}
                onCheckedChange={(checked) => setDraftIncludeSkipped(checked === true)}
              />
              Skipped
            </label>
          </div>
          <Button disabled={isApplyDisabled} onClick={applyFilters}>Apply Filters</Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable] rounded-md border border-gray-200 bg-white">
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] transition-opacity">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        <Table
          wrapperClassName="min-w-0 overflow-visible"
          className="min-w-full divide-y divide-gray-200"
        >
          <TableHeader className="sticky top-0 z-1 bg-gray-50 shadow-sm">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Filename
              </TableHead>

              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Checked / total
              </TableHead>

              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200">
            {documents.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                  {debouncedTitle?.trim()
                    ? 'No documents match your search.'
                    : 'No documents found for the selected filters.'}
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  annotator={getAnnotator(doc?.user_id ?? '')}
                  onSelect={onDocumentSelect}
                  onDelete={onDocumentDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default DocumentsTab;

