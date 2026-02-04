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

export { Skeleton, SkeletonLarger }
