import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, X } from 'lucide-react';
import type { TextSegment } from './types';

interface TitleFieldProps {
  segment: TextSegment;
  value: string;
  results: Array<{ workId?: string; instanceId?: string; title?: string }>;
  loading: boolean;
  showDropdown: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onFocus: () => void;
  onSelect: (title: { workId?: string; instanceId?: string; title?: string }) => void;
  onBdrcIdClear: () => void;
}

export const TitleField: React.FC<TitleFieldProps> = ({
  segment,
  value,
  results,
  loading,
  showDropdown,
  inputRef,
  onChange,
  onFocus,
  onSelect,
  onBdrcIdClear,
}) => {
  return (
    <div>
      <Label htmlFor="title" className="mb-2">
        Title
        {segment.title_bdrc_id && (
          <span className="ml-2 text-xs text-green-600 font-normal">
            (BDRC: {segment.title_bdrc_id})
          </span>
        )}
      </Label>
      <div className="relative">
        <Input
          ref={inputRef}
          id="title"
          value={value || segment.title || ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder="Enter title"
          className="w-full pr-8"
        />
        {segment.title_bdrc_id && (
          <button
            type="button"
            onClick={onBdrcIdClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 transition-colors"
            title="Reset BDRC ID"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        )}
        {showDropdown && results.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {results.map((title, index) => (
              <button
                key={title.workId || index}
                type="button"
                onClick={() => onSelect(title)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900">{title.title}</div>
                {title.workId && (
                  <div className="text-xs text-gray-500">ID: {title.workId}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
