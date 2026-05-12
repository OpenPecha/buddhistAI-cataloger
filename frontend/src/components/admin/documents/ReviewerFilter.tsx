import AvatarWrapper from "@/components/AvatarWrapper";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useOutlinerUsers } from "@/hooks";

type ReviewerFilterProps = Readonly<{
  value: string;
  onChange: (userId: string) => void;
}>;

export function ReviewerFilter({ value, onChange }: ReviewerFilterProps) {
  const { users, isLoading } = useOutlinerUsers();

  if (isLoading) {
    return <Skeleton />;
  }

  const reviewers = users.filter((u) => u.role === "reviewer");

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full max-w-48">
        <SelectValue placeholder="Select reviewer" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Reviewers</SelectItem>
        <SelectGroup>
          <SelectLabel>Reviewers</SelectLabel>
          {reviewers.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              <AvatarWrapper src={r.picture || ""} alt={r.name || r.id} />
              {r.name || r.id} ({r.email})
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
