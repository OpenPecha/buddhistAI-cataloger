import { ChevronDown, ChevronRight } from 'lucide-react'

function ChevronUporDown({ isExpanded }: { isExpanded: boolean }) {
  return (
    <>
        {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600" aria-hidden />
            ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" aria-hidden />
              )}
    </>
  )
}

export default ChevronUporDown
