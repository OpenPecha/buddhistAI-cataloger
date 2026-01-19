import React, { useRef, useEffect } from 'react';
import { Scissors, X } from 'lucide-react';
import type { SplitMenuProps } from './types';

export const SplitMenu: React.FC<SplitMenuProps> = ({ position, onSplit, onCancel, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="split-menu absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[180px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button
        onClick={() => {
          onSplit();
          onClose();
        }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
      >
        <Scissors className="w-4 h-4" />
        Split Here
      </button>
      <button
        onClick={() => {
          onCancel();
          onClose();
        }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2 mt-1 text-gray-600"
      >
        <X className="w-4 h-4" />
        Cancel
      </button>
    </div>
  );
};
