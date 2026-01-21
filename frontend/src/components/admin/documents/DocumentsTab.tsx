import type { Document } from '../shared/types';
import DocumentRow from './DocumentRow';

interface DocumentsTabProps {
  documents: Document[];
  onDocumentStatusChange: (documentId: string, newStatus: string) => void;
  onDocumentSelect: (document: Document) => void;
  onDocumentDelete: (documentId: string) => void;
}

function DocumentsTab({
  documents,
  onDocumentStatusChange,
  onDocumentSelect,
  onDocumentDelete
}: DocumentsTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">Document Management</h3>
          <p className="text-gray-600 mt-1">Review and manage outliner documents</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
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
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onStatusChange={onDocumentStatusChange}
                  onSelect={onDocumentSelect}
                  onDelete={onDocumentDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DocumentsTab;