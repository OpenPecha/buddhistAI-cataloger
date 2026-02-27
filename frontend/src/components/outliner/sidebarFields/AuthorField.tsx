import { useEffect, useState, useRef, forwardRef, Activity } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBdrcSearch } from '@/hooks/useBdrcSearch';
import Emitter from '@/events';
import type { TextSegment } from '../types';
import type { Author, FormDataType, Title } from '../AnnotationSidebar';

interface AuthorFieldProps {
  segment: TextSegment;
  formData: FormDataType;
  onUpdate: (field: 'title' | 'author', value: Title | Author) => void;
  resetForm: () => void;
}

export interface AuthorFieldRef {
  setValueWithoutUpdate: (value: string) => void;
  getValue: () => string;
}

export const AuthorField = forwardRef<AuthorFieldRef, AuthorFieldProps>(({
  segment,
  formData,
  onUpdate,
  resetForm,
}, ref) => {
  const authorSearch = formData?.author?.name || '';
  const setAuthorSearch = (value: string) => {
    onUpdate('author', { name: value, bdrc_id: '' });
  };
  const inputRef = useRef<HTMLInputElement | null>(null);

  const bdrcId = formData?.author?.bdrc_id || segment.author_bdrc_id || '';

  const [showBdrcSearch, setShowBdrcSearch] = useState(false);
  const [bdrcQuery, setBdrcQuery] = useState('');
  const [isBdrcFocused, setIsBdrcFocused] = useState(false);
  const bdrcInputRef = useRef<HTMLInputElement | null>(null);

  const { results: authorResults, isLoading: authorLoading } = useBdrcSearch(
    bdrcQuery,
    'Person',
    1000,
    () => { bdrcInputRef.current?.focus(); },
    isBdrcFocused
  );

  const handleSelect =
    (author: { bdrc_id?: string; name?: string }) => {
      onUpdate('author', { name: authorSearch, bdrc_id: author?.bdrc_id || '' });
      setShowBdrcSearch(false);
      setBdrcQuery('');
    };

  const handleBdrcIdClear = () => {
    resetForm();
    setAuthorSearch('');
  };

  const handleOpenBdrcSearch = () => {
    setBdrcQuery(authorSearch);
    setShowBdrcSearch(true);
    setTimeout(() => bdrcInputRef.current?.focus(), 0);
  };

  const handleCloseBdrcSearch = () => {
    setShowBdrcSearch(false);
    setBdrcQuery('');
  };

  useEffect(() => {
    const handleBubbleMenuUpdate = (value: string) => {
      setAuthorSearch(value);
      inputRef.current?.focus();
    };

    Emitter.on('bubbleMenu:updateAuthor', handleBubbleMenuUpdate);
    return () => {
      Emitter.off('bubbleMenu:updateAuthor', handleBubbleMenuUpdate);
    };
  }, [setAuthorSearch]);

  return (
    <div>
      <Label htmlFor="author" className="mb-2">
        Author
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
            id="author"
            value={authorSearch}
            onChange={(e) => setAuthorSearch(e.target.value)}
            placeholder="Enter author name"
            className="w-full pr-8"
          />
          {segment.author_bdrc_id && (
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
          disabled={!authorSearch.trim()}
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
              placeholder="Search BDRC authors..."
              className="w-full pr-8 text-sm"
            />
            {authorLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>
          <Activity mode={authorResults.length > 0 && isBdrcFocused ? 'visible' : 'hidden'}>
            <div className="absolute z-900 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {authorResults.map((author, index) => (
                <button
                  key={author.bdrc_id || index}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(author);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-sm font-medium text-gray-900">{author.name}</div>
                  {author.bdrc_id && (
                    <div className="text-xs text-gray-500">ID: {author.bdrc_id}</div>
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

AuthorField.displayName = 'AuthorField';
