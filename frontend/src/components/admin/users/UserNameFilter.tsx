import { useEffect, useState } from 'react';
import { useDebounce } from '@uidotdev/usehooks';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

function UserNameFilter() {
  const [searchParams, setParams] = useSearchParams();
  const [name, setName] = useState(() => searchParams.get('username') || '');

  const debounced = useDebounce(name, 500);

  
  useEffect(() => {
    const trimmed = debounced.trim();
    setParams((params) => {
      const inUrl = (params.get('username') || '').trim();
      if (trimmed === inUrl) {
        return params;
      }
      if (trimmed) {
        params.set('username', trimmed);
      } else {
        params.delete('username');
      }
      params.set('page', '1');
      return params;
    });
  }, [debounced, setParams]);

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
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9 pl-9 text-sm"
        aria-label="Search users by name or email"
      />
    </div>
  );
}

export default UserNameFilter;
