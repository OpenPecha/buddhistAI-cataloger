import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSearchParams } from 'react-router-dom';

const ROLES = [
  { value: 'annotator', label: 'Annotator' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'admin', label: 'Admin' },
] as const;

function UserRoleFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = searchParams.get('role') || 'all';

  const handleChange = (role: string) => {
    setSearchParams((params) => {
      if (role === 'all') params.delete('role');
      else params.set('role', role);
      params.set('page', '1');
      return params;
    });
  };

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-full max-w-48">
        <SelectValue placeholder="All roles" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Roles</SelectItem>
        {ROLES.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default UserRoleFilter;
