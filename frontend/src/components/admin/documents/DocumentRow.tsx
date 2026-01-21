import type { Document } from '../shared/types';

interface DocumentRowProps {
  document: Document;
  onStatusChange: (documentId: string, newStatus: string) => void;
  onSelect: (document: Document) => void;
  onDelete: (documentId: string) => void;
}

function DocumentRow({ document, onStatusChange, onSelect, onDelete }: DocumentRowProps) {
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
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${document.progress_percentage}%` }}
            ></div>
          </div>
          <span className="text-sm text-gray-600">
            {Math.round(document.progress_percentage)}%
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <select
          value={document.status || 'active'}
          onChange={(e) => onStatusChange(document.id, e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
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