import { useEffect, useState, useRef, Activity, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useBdrcSearch } from '@/hooks/useBdrcSearch';
import Emitter from '@/events';
import type { TextSegment } from '../types';
import type { FormDataType, Title, Author } from '../AnnotationSidebar';

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
  const titleSearch = formData?.title?.name || '';
  const setTitleSearch = (value: string) => {
    onUpdate('title', { name: value, bdrc_id: '' });
  };
  const bdrcId = formData?.title?.bdrc_id || segment.title_bdrc_id || '';
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isBdrcFocused, setIsBdrcFocused] = useState(false);
  const bdrcInputRef = useRef<HTMLInputElement | null>(null);

  const { results: titleResults, isLoading: titleLoading } = useBdrcSearch(
    titleSearch,
    'Instance',
    1000,
    () => { bdrcInputRef.current?.focus(); },
    isBdrcFocused
  );

  const handleSelect = (title: { workId?: string; instanceId?: string; title?: string }) => {
    onUpdate('title', { name: titleSearch || '', bdrc_id: title?.workId || '' });
    setIsBdrcFocused(false)
  };

  const handleBdrcIdChange = (value: string) => {
    onUpdate('title', { name: titleSearch, bdrc_id: value });
  };

  useEffect(() => {
    const handleBubbleMenuUpdate = (value: string) => {
      setTitleSearch(value);
      inputRef.current?.focus();
    };

    Emitter.on('bubbleMenu:updateTitle', handleBubbleMenuUpdate);
    return () => {
      Emitter.off('bubbleMenu:updateTitle', handleBubbleMenuUpdate);
    };
  }, [setTitleSearch]);

  return (
    <div>
      <Label htmlFor="title" className="mb-2">Title</Label>
      <Input
        ref={inputRef}
        id="title"
        value={titleSearch}
        onChange={(e) => setTitleSearch(e.target.value)}
        placeholder="Enter title"
        className="w-full"
      />
      <div className="relative mt-2">
        <Label htmlFor="title-bdrc-id" className="mb-1 text-xs text-gray-500">BDRC ID</Label>
        <div className="relative">
          <Input
            ref={bdrcInputRef}
            id="title-bdrc-id"
            value={bdrcId}
            onChange={(e) => handleBdrcIdChange(e.target.value)}
            onFocus={() => setIsBdrcFocused(true)}
            onBlur={() => setIsBdrcFocused(false)}
            placeholder="Focus to search BDRC..."
            className="w-full pr-8 text-sm"
          />
          {titleLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>
        <Activity mode={titleResults.length > 0 && isBdrcFocused ? 'visible' : 'hidden'}>
          <div className="absolute z-900 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
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
