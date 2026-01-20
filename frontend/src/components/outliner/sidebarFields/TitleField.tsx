import { useEffect, useState, useRef, useCallback, Activity, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, X } from 'lucide-react';
import { useBdrcSearch } from '@/hooks/useBdrcSearch';
import Emitter from '@/events';
import type { TextSegment } from '../types';
import type { FormDataType ,Title, Author} from '../AnnotationSidebar';

interface TitleFieldProps {
  segment: TextSegment;
  activeSegmentId: string | null;
  formData: FormDataType;
  onUpdate: (field: 'title' | 'author', value: Title | Author) => void;
  resetForm: () => void;
}

export interface TitleFieldRef {
  setValueWithoutUpdate: (value: string) => void;
  getValue: () => string;
}

export const TitleField = forwardRef<TitleFieldRef, TitleFieldProps>(({
  segment,
  activeSegmentId,
  formData,
  onUpdate,
  resetForm,
}, ref) => {
  const titleSearch=formData?.title?.name || '';
  const setTitleSearch=(value:string)=>{
    onUpdate('title', {name:value, bdrc_id:''})
  }
  const bdrcId = formData?.title?.bdrc_id || segment.title_bdrc_id || '';
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // BDRC search hook
  const { results: titleResults, isLoading: titleLoading } = useBdrcSearch(
    titleSearch,
    'Instance',
    2000,
    () => {
      inputRef.current?.focus();
    }
  );
  // Handle title selection from BDRC search
  const handleSelect = 
    (title: { workId?: string; instanceId?: string; title?: string }) => {
   onUpdate('title', {name: titleSearch|| '', bdrc_id:title?.workId || ''})
   inputRef.current?.blur();
    }

  // Handle BDRC ID clear
  const handleBdrcIdClear = useCallback(() => {
    if (activeSegmentId) {
      // Clear BDRC ID immediately (this is a metadata change)
      resetForm();
      // Clear title text locally
      setTitleSearch('');
    }
  }, [activeSegmentId, onUpdate]);

  // Listen for bubble menu title updates
  useEffect(() => {
    const handleBubbleMenuUpdate = (value: string) => {
      setTitleSearch(value);
    };

    Emitter.on('bubbleMenu:updateTitle', handleBubbleMenuUpdate);
    return () => {
      Emitter.off('bubbleMenu:updateTitle', handleBubbleMenuUpdate);
    };
  }, [setTitleSearch]);


  return (
    <div>
      <Label htmlFor="title" className="mb-2">
        Title
        {bdrcId && (
          <span className="ml-2 text-xs text-green-600 font-normal">
            (BDRC: {bdrcId})
          </span>
        )}
      </Label>
      <div className="relative">
        <Input
          ref={inputRef}
          id="title"
          value={titleSearch}
          onChange={(e) => setTitleSearch(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          placeholder="Enter title"
          className="w-full pr-8"
        />
        {segment.title_bdrc_id && (
          <button
            type="button"
            onClick={handleBdrcIdClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 transition-colors"
            title="Reset BDRC ID"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {titleLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        )}
        <Activity mode={titleResults.length > 0 && isFocused?'visible':'hidden'}>
          <div  className="absolute z-900 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {titleResults.map((title, index) => (
              <button
                key={title.workId || index}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(title);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900">{title.title}</div>
                {title.workId && (
                  <div className="text-xs text-gray-500">ID: {title.workId}</div>
                )}
              </button>
            ))}
          </div>
        </Activity>
      </div>
    </div>
  );
});

TitleField.displayName = 'TitleField';
