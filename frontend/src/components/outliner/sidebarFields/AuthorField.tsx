import React, { useEffect, useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BDRC_AUTHOR_DIFFICULT_TO_IDENTIFY, BdrcAuthorSelector } from '@/components/bdrc/BdrcAuthorSelector';
import type { TextSegment } from '../types';
import type { Author, FormDataType, Title } from '../AnnotationSidebar';

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
  disabled?: boolean;
}

export const AuthorField = ({
  segment,
  formData,
  onUpdate,
  resetForm,
  disabled = false,
}: AuthorFieldProps) => {
  const authorSearch = formData?.author?.name || '';
  const setAuthorSearch = (value: string) => {
    onUpdate('author', { name: value, bdrc_id: '' });
  };
  const inputRef = useRef<HTMLInputElement | null>(null);

  const bdrcId = formData?.author?.bdrc_id || segment.author_bdrc_id || '';

  /** Name of the BDRC result when user selected it (for match % display). */
  const [selectedAuthorName, setSelectedAuthorName] = useState<string | null>(null);

 

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
      {matchPercentage !== null &&  authorSearch!=="Difficult to identify" && (
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
        disabled={disabled}
      />
     
    </div>
  );
};
