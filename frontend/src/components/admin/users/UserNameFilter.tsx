import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

type UserNameFilterProps = Readonly<{
  value: string;
  onChange: (name: string) => void;
}>;

function UserNameFilter({
  value,
  onChange,
}: UserNameFilterProps) {

  return (
    <div className="relative w-full min-w-[200px] max-w-xs sm:w-64">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        aria-hidden
      />
      <Input
        id="user-name-search"
        type="search"
        placeholder="Search by name or email…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-9 text-sm"
        aria-label="Search users by name or email"
      />
    </div>
  );
}

export default UserNameFilter;
