import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_OPTIONS = [
  { value: 'active', label: 'Annotating' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'completed', label: 'Annotated' },
  { value: 'approved', label: 'Reviewed' },
] as const;

interface DocumentStatusFilterProps {
  readonly currentStatus: string;
  readonly handleStatusChange: (e: string) => void;
}

function DocumentStatusFilter({ currentStatus, handleStatusChange }: DocumentStatusFilterProps) {
  const handleChange = (value: string) => {
    if (value === 'all') {
      handleStatusChange("");
      return;
    }
    handleStatusChange(value);
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
