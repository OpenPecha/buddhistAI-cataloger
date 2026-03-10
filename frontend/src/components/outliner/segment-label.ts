import type { SegmentLabel } from './types';

export const SEGMENT_LABEL_OPTIONS: { value: SegmentLabel | 'none'; label: string }[] = [
  { value: 'none', label: 'No label' },
  { value: 'FRONT_MATTER', label: 'Front matter' },
  { value: 'TOC', label: 'TOC' },
  { value: 'TEXT', label: 'Text' },
  { value: 'BACK_MATTER', label: 'Back matter' },
];

export function segmentLabelDisplay(label: SegmentLabel | undefined | null): string {
  if (!label) return '';
  const opt = SEGMENT_LABEL_OPTIONS.find((o) => o.value === label);
  return opt?.label ?? label;
}
