import { useEffect, useState, useRef, useCallback, Activity, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  const [showBdrcSearch, setShowBdrcSearch] = useState(false);
  const [bdrcQuery, setBdrcQuery] = useState('');
  const [isBdrcFocused, setIsBdrcFocused] = useState(false);
  const bdrcInputRef = useRef<HTMLInputElement | null>(null);

  const { results: titleResults, isLoading: titleLoading } = useBdrcSearch(
    bdrcQuery,
    'Instance',
    1000,
    () => { bdrcInputRef.current?.focus(); },
    isBdrcFocused
  );

  const handleSelect =
    (title: { workId?: string; instanceId?: string; title?: string }) => {
      onUpdate('title', { name: titleSearch || '', bdrc_id: title?.workId || '' });
      setShowBdrcSearch(false);
      setBdrcQuery('');
    };

  const handleBdrcIdClear = useCallback(() => {
    if (activeSegmentId) {
      resetForm();
      setTitleSearch('');
    }
  }, [activeSegmentId, onUpdate]);

  const handleOpenBdrcSearch = () => {
    setBdrcQuery(titleSearch);
    setShowBdrcSearch(true);
    setTimeout(() => bdrcInputRef.current?.focus(), 0);
  };

  const handleCloseBdrcSearch = () => {
    setShowBdrcSearch(false);
    setBdrcQuery('');
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
      <Label htmlFor="title" className="mb-2">
        Title
        {bdrcId && (
          <span className="ml-2 text-xs text-green-600 font-normal">
            (BDRC: {bdrcId})
          </span>
        )}
      </Label>
      <div className="flex gap-1">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            id="title"
            value={titleSearch}
            onChange={(e) => setTitleSearch(e.target.value)}
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
        </div>
        <Button
          type="button"
          size="icon"
          variant={showBdrcSearch ? 'secondary' : 'ghost'}
          onClick={showBdrcSearch ? handleCloseBdrcSearch : handleOpenBdrcSearch}
          disabled={!titleSearch.trim()}
          title="Search BDRC"
          className="shrink-0"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {showBdrcSearch && (
        <div className="relative mt-2">
          <div className="relative">
            <Input
              ref={bdrcInputRef}
              value={bdrcQuery}
              onChange={(e) => setBdrcQuery(e.target.value)}
              onFocus={() => setIsBdrcFocused(true)}
              onBlur={() => setIsBdrcFocused(false)}
              placeholder="Search BDRC titles..."
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
      )}
    </div>
  );
});

TitleField.displayName = 'TitleField';
