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
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

export function UserFilter({onChange}: {onChange: (userId: string) => void})
{
  const [searchParams, setSearchParams] = useSearchParams();
  const { users: annotators, isLoading } = useOutlinerUsers();

    const currentAnnotator_param = searchParams.get('annotator') || undefined;
  const [currentAnnotator, setCurrentAnnotator] = useState(currentAnnotator_param);
    

    const handleChange = (newAnnotator: string) => {
      setCurrentAnnotator(newAnnotator);
      onChange(newAnnotator);
   
    }

   
    if(isLoading){
   return <Skeleton/>
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
  
  
  