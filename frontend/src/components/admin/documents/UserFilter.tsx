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
  import { Skeleton } from '@/components/ui/skeleton';
import type { OutlinerUser } from "@/hooks/useOutlinerUsers";

interface UserFilterProps {
   readonly currentAnnotator: string;
   readonly handleAnnotatorChange: (value: string) => void;
   readonly annotators: OutlinerUser[];
   readonly annotatorsLoading: boolean;
}

export function UserFilter({ currentAnnotator, handleAnnotatorChange, annotators, annotatorsLoading }: UserFilterProps)
{
    const annotators_list=[]
    const reviewers=[]
    const admins=[]

    for (const a of annotators) {
      if (a.role === 'annotator') {
        annotators_list.push(a);
      } else if (a.role === 'reviewer') {
        reviewers.push(a);
      } else if (a.role === 'admin') {
        admins.push(a);
      }
    }
    if (annotatorsLoading) {
      return <Skeleton/>;
    }

    const handleChange = (value: string) => {
      if (value === 'all') {
        handleAnnotatorChange("");
        return;
      }
      handleAnnotatorChange(value);
    }
    return (
  
  
      <Select value={currentAnnotator || ''} onValueChange={handleChange}>
        <SelectTrigger className="w-full max-w-48" >
          <SelectValue placeholder="Select a person" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectGroup>
            <SelectLabel>Annotators</SelectLabel>
            {annotators_list.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name || a.id} ({a.email})
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Reviewers</SelectLabel>
            {reviewers.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name || a.id} ({a.email})
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Admins</SelectLabel>
            {admins.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name || a.id} ({a.email})
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }
  
  
  