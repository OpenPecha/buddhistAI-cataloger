import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DocumentsTab } from '../components/admin';
import { SimplePagination } from '../components/ui/simple-pagination';
import type { Document } from '../components/admin/shared/types';
import {
  useDocuments,
  useDocumentActions,
  useOutlinerUsers,
} from '../hooks';
import type { DocumentFilters } from '../hooks';

function OutlinerAdminDocument() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') || undefined;
  const annotator = searchParams.get('annotator') || undefined;
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);

  const [titleSearch, setTitleSearch] = useState('');
  const [debouncedTitle, setDebouncedTitle] = useState('');
  const isFirstTitleDebounce = useRef(true);

  useEffect(() => {
    const t = globalThis.setTimeout(() => setDebouncedTitle(titleSearch.trim()), 400);
    return () => globalThis.clearTimeout(t);
  }, [titleSearch]);

  useEffect(() => {
    if (isFirstTitleDebounce.current) {
      isFirstTitleDebounce.current = false;
      return;
    }
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('page', '1');
      return p;
    });
  }, [debouncedTitle, setSearchParams]);

  const filters: DocumentFilters = useMemo(
    () => ({
      status,
      userId: annotator,
      title: debouncedTitle || undefined,
      page,
      pageSize: 20,
    }),
    [status, annotator, debouncedTitle, page]
  );

  const {
    documents,
    isLoading,
    isFetching,
    page: currentPage,
    hasNextPage,
    hasPrevPage,
  } = useDocuments(filters);
  const { deleteDocument } = useDocumentActions();
  const { users: annotators, isLoading: annotatorsLoading } = useOutlinerUsers();

  const handleFilterChange = useCallback(
    (newStatus?: string, newAnnotator?: string) => {
      const params = new URLSearchParams();
      if (newStatus) params.set('status', newStatus);
      if (newAnnotator) params.set('annotator', newAnnotator);
      params.set('page', '1');
      setSearchParams(params);
    },
    [setSearchParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(newPage));
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handleDocumentSelectAction = (document: Document) => {
    navigate(`/outliner-admin/documents/${document.id}`);
  };

  const handleDocumentDelete = (documentId: string) => {
    deleteDocument(documentId);
  };

  if (isLoading && !documents.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DocumentsTab
        documents={documents}
        isFetching={isFetching}
        onDocumentSelect={handleDocumentSelectAction}
        onDocumentDelete={handleDocumentDelete}
        annotators={annotators}
        annotatorsLoading={annotatorsLoading}
        currentStatus={status}
        currentAnnotator={annotator}
        titleSearch={titleSearch}
        debouncedTitle={debouncedTitle}
        onTitleSearchChange={setTitleSearch}
        onFilterChange={handleFilterChange}
      />
      {(hasPrevPage || hasNextPage) && (
        <SimplePagination
          canGoPrev={hasPrevPage}
          canGoNext={hasNextPage}
          onPrev={() => handlePageChange(currentPage - 1)}
          onNext={() => handlePageChange(currentPage + 1)}
          label={`Page ${currentPage}`}
          labelPosition="left"
          isDisabled={isFetching}
        />
      )}
    </div>
  );
}

export default OutlinerAdminDocument;
