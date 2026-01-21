interface StatsCardProps {
  icon: string;
  title: string;
  value: number;
  colorClass: string;
}

function StatsCard({ icon, title, value, colorClass }: StatsCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center">
        <div className="text-3xl">{icon}</div>
        <div className="ml-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export default StatsCard;