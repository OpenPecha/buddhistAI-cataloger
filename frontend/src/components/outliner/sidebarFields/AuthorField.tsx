import React, { useEffect, useState, useRef, forwardRef, Activity } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useBdrcSearch } from '@/hooks/useBdrcSearch';
import Emitter from '@/events';
import type { TextSegment } from '../types';
import type { Author, FormDataType, Title } from '../AnnotationSidebar';

/** Highlights the first occurrence of query in text (for dropdown list). */
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q || !text) return text;
  const i = text.indexOf(q);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-amber-200/80 rounded px-0.5">{q}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/** Levenshtein distance. */
function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  const row = Array.from({ length: bn + 1 }, (_, i) => i);
  for (let i = 1; i <= an; i++) {
    let prev = i;
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = next;
    }
    row[bn] = prev;
  }
  return row[bn];
}

/** Match percentage 0–100 between two strings (1 - normalized Levenshtein). */
function getMatchPercentage(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 100;
  const maxLen = Math.max(a.length, b.length, 1);
  const distance = levenshtein(a.trim(), b.trim());
  const ratio = 1 - distance / maxLen;
  return Math.round(Math.max(0, Math.min(100, ratio * 100)));
}

function getMatchIndicatorClass(pct: number | null): string {
  if (pct === null) return '';
  if (pct >= 80) return 'bg-green-100 text-green-800 border-green-200';
  if (pct >= 40) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (pct > 0) return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

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

  const [isBdrcFocused, setIsBdrcFocused] = useState(false);
  const bdrcInputRef = useRef<HTMLInputElement | null>(null);
  /** Name of the BDRC result when user selected it (for match % display). */
  const [selectedAuthorName, setSelectedAuthorName] = useState<string | null>(null);

  const { results: authorResults, isLoading: authorLoading } = useBdrcSearch(
    authorSearch,
    'Person',
    1000,
    () => { bdrcInputRef.current?.focus(); },
    isBdrcFocused
  );

  const handleSelect = (author: { bdrc_id?: string; name?: string }) => {
    onUpdate('author', { name: authorSearch, bdrc_id: author?.bdrc_id || '' });
    setSelectedAuthorName(author?.name ?? null);
    setIsBdrcFocused(false);
  };

  const handleBdrcIdChange = (value: string) => {
    onUpdate('author', { name: authorSearch, bdrc_id: value });
    if (!value.trim()) setSelectedAuthorName(null);
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

  // Clear selected name when segment changes or bdrc_id is cleared
  useEffect(() => {
    setSelectedAuthorName(null);
  }, [segment?.id]);
  useEffect(() => {
    if (!bdrcId) setSelectedAuthorName(null);
  }, [bdrcId]);

  const matchPercentage =
    bdrcId && selectedAuthorName && authorSearch.trim()
      ? getMatchPercentage(authorSearch.trim(), selectedAuthorName)
      : null;

  const matchIndicatorClass = getMatchIndicatorClass(matchPercentage);

  return (
    <div>
     
      <div className="relative flex items-center gap-2">
      <Label htmlFor="author" className="mb-2">Author</Label>
      {matchPercentage !== null && (
        <div
          className={`mb-1 h-full inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${matchIndicatorClass}`}
          title="Match with selected BDRC author"
        >
          {matchPercentage}% matched
        </div>
      )}
        </div>
      <Input
        ref={inputRef}
        id="author"
        value={authorSearch}
        onChange={(e) => setAuthorSearch(e.target.value)}
        placeholder="Enter author name"
        className="w-full"
      />
      <div className="relative mt-2">
        <Label htmlFor="author-bdrc-id" className="mb-1 text-xs text-gray-500">BDRC ID</Label>
        <div className="relative">
          <Input
            ref={bdrcInputRef}
            id="author-bdrc-id"
            value={bdrcId}
            onChange={(e) => handleBdrcIdChange(e.target.value)}
            onFocus={() => setIsBdrcFocused(true)}
            onBlur={() => setIsBdrcFocused(false)}
            placeholder="Focus to search BDRC..."
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
                <div className="text-sm font-medium text-gray-900">
                  {highlightMatch(author.name ?? '', authorSearch.trim())}
                </div>
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
