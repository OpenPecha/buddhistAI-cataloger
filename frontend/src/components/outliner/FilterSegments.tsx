'use client';

import type { SegmentLabel } from './types';
import { SEGMENT_LABEL_OPTIONS } from './segment-label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type LabelFilterValue = SegmentLabel | 'none';

const SHOW_ALL_VALUE = 'all';

const FILTER_OPTIONS = [
  { value: SHOW_ALL_VALUE, label: 'Show all' },
  ...SEGMENT_LABEL_OPTIONS,
];

interface FilterSegmentsProps {
  /** Selected labels to show. Empty = show all segments. */
  readonly value: readonly LabelFilterValue[];
  readonly onChange: (value: LabelFilterValue[]) => void;
}

export function FilterSegments({ value, onChange }: FilterSegmentsProps) {
  const selectValue = value.length === 0 ? SHOW_ALL_VALUE : value[0];

  function handleSelect(val: string) {
    if (val === SHOW_ALL_VALUE) {
      onChange([]);
    } else {
      onChange([val as LabelFilterValue]);
    }
  }

  return (
    <div className="space-y-2 pb-3 border-b border-gray-200 mb-3">
      <p className="text-xs font-medium text-gray-600">Show segments by label</p>
      <Select value={selectValue} onValueChange={handleSelect}>
        <SelectTrigger className="w-full" size="default">
          <SelectValue placeholder="Show all" />
        </SelectTrigger>
        <SelectContent>
          {FILTER_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
