import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSearchParams } from "react-router-dom";

const STATUS_OPTIONS = [
  { value: 'active', label: 'Annotating' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'completed', label: 'Annotated' },
  { value: 'approved', label: 'Reviewed' },
] as const;



function DocumentStatusFilter(){
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatus = searchParams.get('status') || undefined;

    const handleChange = (status: string) => {
      const params = new URLSearchParams();
      if (status === 'all') params.delete('status');
      else params.set('status', status);
      params.set('page', '1');
      setSearchParams(params);
  }
  return (
<Select value={currentStatus || ''} onValueChange={handleChange}> 
<SelectTrigger className="w-full max-w-48">
  <SelectValue placeholder="Select Status" />
</SelectTrigger>
<SelectContent>
<SelectItem value="all">All</SelectItem>
    {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
</SelectContent>
</Select>
  )
}

export default DocumentStatusFilter
