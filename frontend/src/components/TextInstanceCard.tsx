import React from 'react';
import type { OpenPechaTextInstanceListItem } from '@/types/text';
import { Link, useParams } from 'react-router-dom';
import { editionLink } from '@/utils/links';
import { useDeleteEdition } from '@/hooks/useTexts';
import { toast } from 'sonner';

interface TextInstanceCardProps {
  instance: OpenPechaTextInstanceListItem;
}

const TextInstanceCard: React.FC<TextInstanceCardProps> = ({ instance }) => {
  const { text_id } = useParams();
  const deleteMutation = useDeleteEdition();

  const handleDelete = () => {
    if (!text_id) return;
    if (
      !globalThis.confirm(
        'Delete this edition? This cannot be undone.'
      )
    ) {
      return;
    }
    deleteMutation.mutate(
      { editionId: instance.id, textId: text_id },
      {
        onSuccess: () => toast.success('Edition deleted'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to delete edition'),
      }
    );
  };

  const getTypeColor = (type: string) => {
    if (!type) return 'bg-gray-100 text-gray-800 border-gray-200';
    switch (type.toLowerCase()) {
      case 'critical':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'base':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'edition':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Title logic: 
  // 1. Try Tibetan incipit title
  // 2. If not, try first available language in incipit_title
  // 3. If no incipit_title, show "Text Instance (colophon)"
  let title = "Version";
  
  if (instance.incipit_title && typeof instance.incipit_title === 'object') {
    const incipitObj = instance.incipit_title as Record<string, string>;
    if (incipitObj.bo) {
      title = incipitObj.bo;
    } else {
      // Get first available language from incipit_title
      const firstLanguage = Object.keys(incipitObj)[0];
      if (firstLanguage) {
        title = incipitObj[firstLanguage];
      }
    }
  }
  
  // If no incipit_title, format with colophon
  if (!title) {
    title = instance.colophon 
      ? `Text Instance (${instance.colophon})` 
      : "Text Instance";
  }
  return (
    <div className="relative bg-white rounded-xl shadow-lg border border-gray-200 p-6 group transition-all hover:shadow-xl hover:border-blue-300 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <Link to={editionLink(text_id || '', instance.id)} className="no-underline">
            <h3 className="text-lg font-bold text-gray-900 break-words group-hover:text-blue-700 transition-colors">
              {title}
            </h3>
          </Link>
        </div>
        <span className={`px-3 py-1 rounded-full border text-xs font-semibold capitalize shadow-sm mt-2 sm:mt-0 ${getTypeColor(instance.type || '')}`}>
          {instance.type}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 mt-2 items-center">
        <Link
          to={`/texts/${text_id}/create?type=translation&edition_id=${instance.id}`}
          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-md text-sm font-medium border border-blue-100 hover:bg-blue-100 hover:text-blue-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add translation
        </Link>
        <Link
          to={`/texts/${text_id}/create?type=commentary&edition_id=${instance.id}`}
          className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-50 text-yellow-800 rounded-md text-sm font-medium border border-yellow-100 hover:bg-yellow-100 hover:text-yellow-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add commentary
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending || !text_id}
          className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded-md text-sm font-medium border border-red-100 hover:bg-red-100 hover:text-red-800 transition-colors disabled:opacity-50 disabled:pointer-events-none ml-auto"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
};

export default TextInstanceCard;
