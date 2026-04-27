import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DocumentsTab } from '../components/admin';
import { SimplePagination } from '../components/ui/simple-pagination';
import type { Document } from '../components/admin/shared/types';
import { useDocuments, useDocumentActions } from '../hooks';
import type { DocumentFilters } from '../hooks';

function OutlinerAdminDocument() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const status = searchParams.get('status') || undefined;
  const annotator = searchParams.get('annotator') || undefined;
  const debouncedTitle = searchParams.get('title') || undefined;
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const filters: DocumentFilters = useMemo(
    () => ({
      status,
      userId: annotator,
      title: debouncedTitle || undefined,
      page,
      pageSize: 20,
      excludeOwnAssignedDocuments: true,
    }),
    [status, annotator, debouncedTitle, page]
  );

  const { hasPrevPage, hasNextPage, isFetching,handleNextPage,handlePrevPage } = useDocuments(filters);

  const { deleteDocument } = useDocumentActions();

 


  const handleDocumentSelectAction = (document: Document) => {
    navigate(`/outliner-admin/documents/${document.id}`);
  };

  const handleDocumentDelete = (documentId: string) => {
    deleteDocument(documentId);
  };


  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4  p-4">
      <DocumentsTab
        onDocumentSelect={handleDocumentSelectAction}
        onDocumentDelete={handleDocumentDelete}
      />
      {(hasPrevPage || hasNextPage) && (
        <div className="shrink-0">
          <SimplePagination
            canGoPrev={hasPrevPage}
            canGoNext={hasNextPage}
            onPrev={handlePrevPage}
            onNext={handleNextPage}
            label={`Page ${page}`}
            labelPosition="left"
            isDisabled={isFetching}
          />
        </div>
      )}
    </div>
  );
}

export default OutlinerAdminDocument;
