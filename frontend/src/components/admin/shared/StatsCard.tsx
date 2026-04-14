import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  readonly icon: ReactNode
  readonly title: string
  readonly value: number | string
  readonly colorClass: string
  readonly hint?: string
  readonly footer?: ReactNode
  readonly className?: string
}

function StatsCard({ icon, title, value, colorClass, hint, footer, className }: StatsCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex shrink-0 opacity-90" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${colorClass}`}>{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
          {footer ? <div className="mt-3">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}

export default StatsCard
