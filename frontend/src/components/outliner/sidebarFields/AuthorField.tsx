import { useEffect, useState, useRef, useCallback, useImperativeHandle, forwardRef, Activity } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, X } from 'lucide-react';
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
  const authorSearch=formData?.author?.name || '';
  const setAuthorSearch=(value:string)=>{
    onUpdate('author', {name:value, bdrc_id:''})
  }
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const bdrcId = formData?.author?.bdrc_id || segment.author_bdrc_id || '';
  // BDRC search hook
  const { results: authorResults, isLoading: authorLoading } = useBdrcSearch(
    authorSearch,
    'Person',
    1000,
    () => {
      inputRef.current?.focus();
    },
    isFocused
  );

  const handleSelect = 
    (author: { bdrc_id?: string; name?: string }) => {
   onUpdate('author', { name:authorSearch,bdrc_id:author?.bdrc_id || ''})
   inputRef.current?.blur();
    } 

  // Handle BDRC ID clear
  const handleBdrcIdClear = ()=>{
   resetForm();
   setAuthorSearch('');
  }

  // Listen for bubble menu author updates
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
      <div className="relative">
        <Input
          ref={inputRef}
          id="author"
          value={authorSearch}
          onChange={(e) => setAuthorSearch(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          placeholder="Search or enter author name"
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
        {authorLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        )}
        <Activity mode={authorResults.length > 0 && isFocused?'visible':'hidden'}>
          <div  className="absolute z-900 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
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
    </div>
  );
});

AuthorField.displayName = 'AuthorField';
