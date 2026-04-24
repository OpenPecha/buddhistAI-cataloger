import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useUser } from '../hooks/useUser';
import { SkeletonLarger } from '@/components/ui/skeleton';

function OutlinerAdminDocument() {
  const navigate = useNavigate();
  
  const [titleSearch, setTitleSearch] = useState('');



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
        <SimplePagination
          labelPosition="left"
        />
    </div>
  );
}

export default OutlinerAdminDocument;
