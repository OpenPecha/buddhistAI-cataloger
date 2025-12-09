import React from 'react';
import type { OpenPechaTextInstanceListItem } from '@/types/text';
import { Link, useParams } from 'react-router-dom';

interface TextInstanceCardProps {
  instance: OpenPechaTextInstanceListItem;
}

const TextInstanceCard: React.FC<TextInstanceCardProps> = ({ instance }) => {


  const {text_id}=useParams();

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
    <Link to={`/texts/${text_id}/instances/${instance.id}`} className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-shadow duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0 mb-0 sm:mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900  break-words">
            {title}
          </h3>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <span className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium border ${getTypeColor(instance.type || '')}`}>
            {instance.type}
          </span>
        </div>
      </div>
     
    </Link>
  );
};

export default TextInstanceCard;
