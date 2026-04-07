import type { SegmentLabel } from './types'

/** Ordered values for label dropdowns and filters (includes `none` for “no type”). */
export const SEGMENT_LABEL_VALUES: (SegmentLabel | 'none')[] = [
  'none',
  'FRONT_MATTER',
  'TOC',
  'TEXT',
  'BACK_MATTER',
]

/** i18n key under `outliner.segmentLabels.*` */
export function segmentLabelI18nKey(
  value: SegmentLabel | 'none' | undefined | null
): string {
  const v = value == null || value === '' ? 'none' : value
  return `outliner.segmentLabels.${v}`
}
