import React, { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input';
import {  Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from "@uidotdev/usehooks";
function TitleFilter() {
    const [title,setTitle] = useState('');
    const [, setParams] = useSearchParams();
    const debounceTitleSearch = React.useCallback((value: string) => {
        setParams(params=>{
          params.set('title', value);
          params.set('page', '1');
          return params;
        });
    }, [setParams]);

    
    const debouncedTitle = useDebounce(title, 1000);

    useEffect(() => {
        debounceTitleSearch(debouncedTitle);
    }, [debouncedTitle,debounceTitleSearch]);
  

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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="pl-9 h-9 text-sm"
              aria-label="Search documents by title"
            />
    </>
  )
}

export default TitleFilter
