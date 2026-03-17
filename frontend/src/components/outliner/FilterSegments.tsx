import { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { SegmentLabel } from './types';
import { SEGMENT_LABEL_OPTIONS } from './segment-label';
import { Button } from '@/components/ui/button';
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export type LabelFilterValue = SegmentLabel | 'none';

/** Filter by completion: all, completed only (status === 'checked'), or not completed. */
export type CompletionFilterValue = 'all' | 'completed' | 'not_completed';

const SHOW_ALL_VALUE = 'all';

const FILTER_OPTIONS = [
  { value: SHOW_ALL_VALUE, label: 'Show all' },
  ...SEGMENT_LABEL_OPTIONS,
];

const COMPLETION_OPTIONS: { value: CompletionFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'not_completed', label: 'Not completed ' },
];

interface FilterSegmentsProps {
  /** Selected labels to show. Empty = show all segments. */
  readonly value: readonly LabelFilterValue[];
  readonly onChange: (value: LabelFilterValue[]) => void;
  /** Filter by completion status. */
  readonly completionFilter: CompletionFilterValue;
  readonly onCompletionFilterChange: (value: CompletionFilterValue) => void;
}

export function FilterSegments({
  value,
  onChange,
  completionFilter,
  onCompletionFilterChange,
}: FilterSegmentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectValue = value.length === 0 ? SHOW_ALL_VALUE : value[0];

  function handleSelect(val: string) {
    if (val === SHOW_ALL_VALUE) {
      onChange([]);
    } else {
      onChange([val as LabelFilterValue]);
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-between px-0 h-8 font-medium text-gray-600 hover:text-gray-900"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="text-xs">Filters</span>
        {isOpen ? (
          <X className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
      </Button>
      <div
        className={`absolute right-0 top-full z-10 mt-1 h-max overflow-hidden border border-gray-200 bg-white shadow-lg transition-[max-height,opacity] duration-300 ease-out ${
          isOpen ? 'h-max opacity-100' : 'max-h-0 opacity-0 pointer-events-none border-r-0 border-l-0 border-t-0'
        }`}
      >
        <div className="space-y-4 p-3 min-w-[200px]">
          <div>
            <p id="filter-label" className="text-xs font-medium text-gray-600 mb-2">Label</p>
            <RadioGroup value={selectValue} onValueChange={handleSelect} aria-labelledby="filter-label">
              {FILTER_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-3">
                  <RadioGroupItem value={opt.value} id={`label-filter-${opt.value}`} />
                  <Label htmlFor={`label-filter-${opt.value}`} className="text-sm font-normal cursor-pointer text-gray-700 hover:text-gray-900">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <p id="filter-completion" className="text-xs font-medium text-gray-600 mb-2">Completion</p>
            <RadioGroup value={completionFilter} onValueChange={(v) => onCompletionFilterChange(v as CompletionFilterValue)} aria-labelledby="filter-completion">
              {COMPLETION_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-3">
                  <RadioGroupItem value={opt.value} id={`completion-filter-${opt.value}`} />
                  <Label htmlFor={`completion-filter-${opt.value}`} className="text-sm font-normal cursor-pointer text-gray-700 hover:text-gray-900">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      </div>
    </div>
  );
}
