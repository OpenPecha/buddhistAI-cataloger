import React from 'react'

function Skeleton() {
  return (
    <div className="flex items-center gap-2 p-2 min-h-[48px] border-b border-gray-200 last:border-b-0 animate-pulse">
    <div className="flex-1 h-6 bg-gray-200 rounded" />
    <div className="w-24 h-7 bg-gray-200 rounded ml-2" />
    <div className="w-16 h-7 bg-gray-100 rounded ml-2" />
  </div>
  )
}

function SkeletonLarger() {
  return (
    <div className="flex flex-col gap-4 p-6 h-full">
           <div className="bg-white rounded-lg shadow px-6 py-8 w-full animate-pulse">
             <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
             <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
             <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>

             <div className="h-5 bg-gray-200 rounded w-full mb-4"></div>
             <div className="h-10 bg-gray-200 rounded w-full mb-6"></div>

             <div className="h-5 bg-gray-200 rounded w-2/3 mb-4"></div>
             <div className="h-10 bg-gray-200 rounded w-full mb-6"></div>

             <div className="h-7 bg-gray-200 rounded w-24 mb-4"></div>
             <div className="h-12 bg-gray-200 rounded w-full"></div>
           </div>
         </div>
  )
}


const ImageSkeleton = (

) => {
  return (
    <div role="status"
     className="h-[700px] space-y-8 animate-pulse md:space-y-0 md:space-x-8 rtl:space-x-reverse md:flex md:items-center">
    <div className="flex items-center justify-center w-full h-48 bg-neutral-quaternary rounded-base sm:w-96">
        <svg className="w-11 h-11 text-fg-disabled" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m3 16 5-7 6 6.5m6.5 2.5L16 13l-4.286 6M14 10h.01M4 19h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Z"/></svg>
    </div>
    <span className="sr-only">Loading...</span>
</div>
  )
}

export { Skeleton, SkeletonLarger, ImageSkeleton }
