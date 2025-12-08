import React from 'react';
import { useTextSelectionStore } from '../../../stores/textSelectionStore';

interface TypeSelectorProps {
  className?: string;
}

export const TypeSelector: React.FC<TypeSelectorProps> = ({ className = '' }) => {
  const { targetType, isTargetLoaded, targetLoadType, targetTextId, targetText, setTargetType } = useTextSelectionStore();

  // Check if this is an empty target (for annotation creation)
  const isEmptyTarget = targetTextId === 'empty-target' || (isTargetLoaded && targetText === '');
  
  // Determine if the selector should be interactive
  const isInteractive = !isTargetLoaded || targetLoadType === 'file' || isEmptyTarget;
  
  // Show the component when:
  // 1. Target is loaded from database (auto-selected, read-only)
  // 2. Target is loaded from file (user can select)
  // 3. Target is empty (user creating annotation, can select)
  const shouldShow = isTargetLoaded || targetLoadType === 'file' || isEmptyTarget;

  if (!shouldShow) {
    return null;
  }

  const handleTypeSelect = (type: 'translation' | 'commentary') => {
    if (isInteractive) {
      setTargetType(type);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="text-xs font-semibold text-gray-600 uppercase">
       What are you aligning?
      </div>
      
      <div className="flex gap-2">
        {/* Translation Button */}
        <button
          onClick={() => handleTypeSelect('translation')}
          disabled={!isInteractive}
          className={`
            px-3 py-2 text-sm font-medium rounded-md transition-colors
            ${targetType === 'translation'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }
            ${!isInteractive && targetType === 'translation'
              ? 'bg-blue-500 text-white cursor-default'
              : ''
            }
            ${!isInteractive && targetType !== 'translation'
              ? 'bg-gray-50 text-gray-400 cursor-default'
              : ''
            }
            ${isInteractive ? 'cursor-pointer' : 'cursor-default'}
          `}
        >
          Translation
        </button>

        {/* Commentary Button */}
        <button
          onClick={() => handleTypeSelect('commentary')}
          disabled={!isInteractive}
          className={`
            px-3 py-2 text-sm font-medium rounded-md transition-colors
            ${targetType === 'commentary'
              ? 'bg-green-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }
            ${!isInteractive && targetType === 'commentary'
              ? 'bg-green-500 text-white cursor-default'
              : ''
            }
            ${!isInteractive && targetType !== 'commentary'
              ? 'bg-gray-50 text-gray-400 cursor-default'
              : ''
            }
            ${isInteractive ? 'cursor-pointer' : 'cursor-default'}
          `}
        >
          Commentary
        </button>
      </div>

      {/* Status indicator */}
      {!isInteractive && (
        <div className="text-xs text-gray-500 italic">
          Auto-selected based on target source
        </div>
      )}
      
      {isInteractive && !targetType && (
        <div className="text-xs text-orange-600">
          {isEmptyTarget ? 'Please select type for annotation' : 'Please select a type'}
        </div>
      )}
      
      {isInteractive && targetType && isEmptyTarget && (
        <div className="text-xs text-green-600">
          Selected for annotation creation
        </div>
      )}
    </div>
  );
};

export default TypeSelector;
