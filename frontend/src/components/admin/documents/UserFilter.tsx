import AvatarWrapper from "@/components/AvatarWrapper";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton";
import { useOutlinerUsers } from "@/hooks";

type UserFilterProps = Readonly<{
  value: string;
  onChange: (userId: string) => void;
}>;

export function UserFilter({
  value,
  onChange,
}: UserFilterProps)
{
  const { users: annotators, isLoading } = useOutlinerUsers();
    

    const handleChange = (newAnnotator: string) => {
      onChange(newAnnotator);
   
    }

   
    if(isLoading){
   return <Skeleton/>
    }
    return (
  
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="w-full max-w-48" >
          <SelectValue placeholder="Select a person" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Users</SelectItem>
          <SelectGroup>
            <SelectLabel>Annotators</SelectLabel>
            {annotators.filter((a) => a.role === 'annotator').map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <AvatarWrapper src={a?.picture || ''} alt={a.name || a.id}  />
                {a.name || a.id} ({a.email})
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Reviewers</SelectLabel>
            {annotators.filter((a) => a.role === 'reviewer').map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <AvatarWrapper src={a?.picture || ''} alt={a.name || a.id}  />
                {a.name || a.id} ({a.email})
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Admins</SelectLabel>
            {annotators.filter((a) => a.role === 'admin').map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <AvatarWrapper src={a?.picture || ''} alt={a.name || a.id}  />
                {a.name || a.id} ({a.email})
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }
  
  
  