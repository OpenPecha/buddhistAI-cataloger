interface StatsCardProps {
  readonly icon: string
  readonly title: string
  readonly value: number
  readonly colorClass: string
}

function StatsCard({ icon, title, value, colorClass }: StatsCardProps) {
  return (
    <div className="bg-white border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl opacity-80" aria-hidden>{icon}</span>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
          <p className={`text-xl font-semibold tabular-nums ${colorClass}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export default StatsCard;