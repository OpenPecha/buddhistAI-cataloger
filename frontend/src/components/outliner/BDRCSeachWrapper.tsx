import React from 'react'

function BDRCSeachWrapper({bdrcId, children}: {bdrcId: string, children: React.ReactNode}) {
   const BDRC_SEARCH_URL = import.meta.env.VITE_BDRC_SEARCH_PAGE
   const searchUrl = BDRC_SEARCH_URL +bdrcId.trim();
    return (
    <a target='_blank' href={searchUrl} className="flex flex-col gap-2">
        {children}
    </a>
  )
}

export default BDRCSeachWrapper
