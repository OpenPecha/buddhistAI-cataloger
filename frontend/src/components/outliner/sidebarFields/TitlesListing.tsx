import BDRCSeachWrapper from '../BDRCSeachWrapper'
import type { BdrcSearchResult } from '@/hooks/useBdrcSearch'
import { User } from 'lucide-react';

function TitlesListing({bdrc_data ,isLink=true}:{bdrc_data: BdrcSearchResult,isLink?:boolean}) {

    const title = bdrc_data?.title;

    if (!title ) return <span className="text-gray-500">unknown author</span>;
    if (isLink) {
        return (
            <BDRCSeachWrapper bdrcId={bdrc_data?.workId ?? ''}>
                <User className="w-3.5 h-3.5" /> <span className='text-xs flex gap-2 font-monlam'>{title} <span className="text-xs text-gray-500">ID: {bdrc_data?.workId}</span></span>
            </BDRCSeachWrapper>
        )
    }
    return <div className='flex gap-2 font-monlam'>
    <span className='text-xs font-medium text-gray-900'>{title}</span>
    {bdrc_data?.workId && <span className="text-xs text-gray-500">ID: {bdrc_data?.workId}</span>}
    </div>
}

export default TitlesListing
