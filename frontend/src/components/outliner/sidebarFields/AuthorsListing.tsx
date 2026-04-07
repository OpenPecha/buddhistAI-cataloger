import React from 'react'
import { useTranslation } from 'react-i18next'
import BDRCSeachWrapper from '../BDRCSeachWrapper'
import type { BdrcWorkAuthor } from '@/hooks/useBdrcSearch'
import { User } from 'lucide-react';

function AuthorsListing({authors,isLink=true}: {authors: BdrcWorkAuthor[],isLink?:boolean}) {
    const { t } = useTranslation()
    if (authors.length === 0) return <span className="text-gray-500">{t('outliner.unknownAuthor')}</span>;
    const idText = t('outliner.idLabel', { id: authors[0].id ?? '' })
    if (isLink) {
        return (
            <BDRCSeachWrapper bdrcId={authors[0].id ?? ''}>
                <User className="w-3.5 h-3.5" /> <span className='text-xs flex gap-2'>{authors[0].name ?? authors[0].pref_label_bo ?? ''} <span className="text-xs text-gray-500">{idText}</span></span>
            </BDRCSeachWrapper>
        )
    }
    return <span className='text-xs font-medium text-gray-900 flex gap-2'>{authors[0].name ?? authors[0].pref_label_bo ?? ''} <span className="text-xs text-gray-500">{idText}</span> </span>
}

export default AuthorsListing
