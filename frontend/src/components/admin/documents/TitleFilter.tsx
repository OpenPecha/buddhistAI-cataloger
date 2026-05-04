import { Input } from '@/components/ui/input';
import {  Search } from 'lucide-react';

type TitleFilterProps = Readonly<{
  value: string;
  onChange: (title: string) => void;
}>;

function TitleFilter({
  value,
  onChange,
}: TitleFilterProps) {
  return (
    <>
       <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden
            />
            <Input
              id="document-title-search"
              type="search"
              placeholder="Search by title…"
              value={value}
              
              onChange={(e) => onChange(e.target.value)}
              className="pl-9 h-9 text-sm"
              aria-label="Search documents by title"
            />
    </>
  )
}

export default TitleFilter
