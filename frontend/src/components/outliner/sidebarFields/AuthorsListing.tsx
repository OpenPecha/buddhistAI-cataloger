import React from 'react'
import BDRCSeachWrapper from '../BDRCSeachWrapper'
import type { BdrcWorkAuthor } from '@/hooks/useBdrcSearch'
import { User } from 'lucide-react';

function AuthorsListing({authors}: {authors: BdrcWorkAuthor[]}) {
    if (authors.length === 0) return <span className="text-gray-500">unknown author</span>;
  return (
    <>
     {(authors ?? []).map((a, idx, arr) => (
        <React.Fragment key={a.id ?? idx}>
          <BDRCSeachWrapper bdrcId={a.id ?? ''}>
          <User className="w-3.5 h-3.5" /> <span className='text-xs'>{a?.name ?? a?.pref_label_bo ?? ''}</span>
          </BDRCSeachWrapper>
          {idx < arr.length - 1 ? ', ' : ''}
        </React.Fragment>
      ))}
    </>
  )
}

export default AuthorsListing
