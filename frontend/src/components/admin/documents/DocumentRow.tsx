import type { Document } from '../shared/types';

const STATUS_LABEL: Record<string, string> = {
  active: 'Annotating',
  completed: 'Annotated',
  approved: 'Reviewed',
  rejected: 'Rejected',
};

interface DocumentRowProps {
  readonly document: Document;
  readonly annotatorName?: string;
  readonly onSelect: (document: Document) => void;
  readonly onDelete: (documentId: string) => void;
}

function DocumentRow({ document, annotatorName, onSelect, onDelete }: DocumentRowProps) {
  const statusKey = document.status || 'active';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {document.filename || `Document ${document.id.slice(0, 8)}`}
        </div>
        <div className="text-sm text-gray-500">
          ID: {document.id.slice(0, 8)}...
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {annotatorName}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex px-2 py-1 text-sm font-medium rounded ${
            statusKey === 'completed'
              ? 'bg-green-100 text-green-800'
              : statusKey === 'approved'
              ? 'bg-blue-100 text-blue-800'
              : statusKey === 'rejected'
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {STATUS_LABEL[statusKey] || statusKey}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {document.annotated_segments}/{document.total_segments}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(document.created_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button
          onClick={() => onSelect(document)}
          className="text-blue-600 hover:text-blue-900 mr-4"
        >
          View Segments
        </button>
        <button
          onClick={() => onDelete(document.id)}
          className="text-red-600 hover:text-red-900"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

export default DocumentRow;