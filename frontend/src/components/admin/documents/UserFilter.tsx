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
import { useOutlinerUsers } from "@/hooks";
import { useSearchParams } from "react-router-dom";

export function UserFilter()
{
  const [searchParams, setSearchParams] = useSearchParams();
  const { users: annotators, isLoading } = useOutlinerUsers();

    const currentAnnotator = searchParams.get('annotator') || undefined;

    
    if (isLoading) {
      return <Skeleton/>;
    }

    const handleChange = (newAnnotator: string) => {
      setSearchParams((searchParams) => {
        if (newAnnotator === 'all') searchParams.delete('annotator');
        else searchParams.set('annotator', newAnnotator);
        searchParams.set('page', '1');
        return searchParams;
      });
    }

    function AvatarImage({src,alt}:{src:string,alt:string}){
      return <img src={src} alt={alt} className="w-4 h-4 rounded-full" />
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
                <AvatarImage src={a.picture} alt={a.name || a.id}  />
                {a.name || a.id} ({a.email})
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Reviewers</SelectLabel>
            {annotators.filter((a) => a.role === 'reviewer').map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <AvatarImage src={a.picture} alt={a.name || a.id}  />
                {a.name || a.id} ({a.email})
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Admins</SelectLabel>
            {annotators.filter((a) => a.role === 'admin').map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <AvatarImage src={a.picture} alt={a.name || a.id}  />
                {a.name || a.id} ({a.email})
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }
  
  
  