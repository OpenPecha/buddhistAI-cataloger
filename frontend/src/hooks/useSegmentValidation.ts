import { useState, useEffect } from "react"
import { validateSegmentLimits } from "@/utils/contentValidation"

export interface SegmentValidationResult {
  invalidSegments: Array<{ index: number; length: number }>
  invalidCount: number
}

/**
 * Debounced segment character limit validation for editor content.
 */
export function useSegmentValidation(
  content: string,
  delayMs: number = 1000
): SegmentValidationResult {
  const [result, setResult] = useState<SegmentValidationResult>({
    invalidSegments: [],
    invalidCount: 0,
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      const validation = validateSegmentLimits(content)
      setResult({
        invalidSegments: validation.invalidSegments.map((seg) => ({
          index: seg.index,
          length: seg.length,
        })),
        invalidCount: validation.invalidCount,
      })
    }, delayMs)
    return () => clearTimeout(timer)
  }, [content, delayMs])

  return result
}
