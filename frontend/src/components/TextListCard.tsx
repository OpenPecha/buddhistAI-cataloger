import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Book, Globe, Users, Loader2 } from 'lucide-react';
import type { OpenPechaText } from '@/types/text';
import type { Person, PersonName } from '@/types/person';
import { Badge } from './ui/badge';
import { TableRow, TableCell } from './ui/table';
import { useTranslation } from 'react-i18next';
import { getLanguageColor, getLanguageLabel } from '@/utils/getLanguageLabel';




import { API_URL } from '@/config/api';
import { getBdrclink } from '@/lib/bdrclink';

interface TextListCardProps {
  text: OpenPechaText;
}

const TextListCard = ({ text }: TextListCardProps) => {
  const { t,i18n} = useTranslation();
  const [showContributors, setShowContributors] = useState(false);
  

  const contributors = text.contributions.map(c => ({ person: c.person_name, role: c.role }));
  const getPersonDisplayName = (person_name: PersonName): string => {
    if (!person_name) return t('textsPage.nameNotAvailable');
    return person_name?.bo || person_name?.en || t('textsPage.nameNotAvailable');
  };
  
  function getTitle(text: OpenPechaText){
    const currentLanguage = i18n.language;
    const title = text.title[currentLanguage];
    if (title) return title;
    return text.title?.[text.language] || t('textsPage.untitled');
  }

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      root: t('textsPage.rootText'),
      translation: t('textsPage.translation'),
      commentary: t('textsPage.commentary'),
      none:"No Aligned Text"
    };
    return labels[type] || type;
  };

  

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      root: 'bg-purple-100 text-purple-800',
      translation: 'bg-green-100 text-green-800',
      commentary: 'bg-yellow-100 text-yellow-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };
  
  return (
    <TableRow>
      {/* Text Column */}
      <TableCell className=" flex gap-2 items-center font-medium text-xl font-monlam relative group">
      <Book className="w-4 h-4 text-yellow-500 "  />
        
        <Link 
          to={`/texts/${text.id}/instances`} 
          title={getTitle(text)}
          className="transition-colors duration-200 text-neutral-700 hover:text-blue-500 truncate max-w-[350px] line-clamp-1"
        >
          {getTitle(text)}
        </Link>
        {/* Show all available titles on hover if there's more than 1 */}
        {(Object.keys(text.title).length > 1) && (
          <div className="absolute left-0 top-full z-20 mt-2 min-w-[200px] bg-white border border-gray-200 shadow-lg rounded-md p-3 hidden group-hover:block">
            <ul>
              {Object.entries(text.title).map(([lang, titleStr]) => (
                <li key={lang} className="mb-1 last:mb-0">
                  <span className="font-semibold uppercase text-gray-400">{lang}: </span>
                  <span className="font-monlam text-gray-700">{titleStr}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </TableCell>
      
      <TableCell>
        <a href={getBdrclink(text.bdrc)} target="_blank" rel="noopener noreferrer">
          <Badge className="bg-secondary-700 flex items-center gap-2">
            {text.bdrc}
          </Badge>
        </a>
      </TableCell>
      
      {/* Type Column */}
      <TableCell>
        <Badge className={`${getTypeColor(text.type)} flex items-center gap-2 w-fit`}>
          <Book className="w-4 h-4" />
          <span className="font-medium">{getTypeLabel(text.type)}</span>
        </Badge>
      </TableCell>
      
      {/* Language Column */}
      <TableCell>
        {text.language && (
          <Badge className={`${getLanguageColor(text.language)} flex items-center gap-2 w-fit`}>
            <Globe className="w-4 h-4" />
            <span className="font-medium">{getLanguageLabel(text.language)}</span>
          </Badge>
        )}
      </TableCell>
      
      {/* Contributors Column */}
      <TableCell className="text-right relative">
        {text.contributions && text.contributions.length > 0 ? (
          <>
            <button 
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors ml-auto"
              onClick={() => setShowContributors(!showContributors)}
            >
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 font-medium">
                {text.contributions.length} 
              </span>
            </button>
            
            {/* Contributors Popover */}
            {showContributors && (
              <>
                {/* Backdrop to close popover */}
                <button
                  type="button"
                  className="fixed inset-0 z-10 bg-transparent border-0 p-0 cursor-pointer"
                  onClick={() => setShowContributors(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowContributors(false);
                    }
                  }}
                  aria-label="Close contributors popover"
                />
                
                {/* Popover Content */}
                <div className="absolute right-0 top-full mt-2 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[280px] max-w-[320px]">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                    <Users className="w-5 h-5 text-gray-600" />
                    <h4 className="font-semibold text-gray-800">
                      {t('textsPage.contributors', { count: text.contributions.length })}
                    </h4>
                  </div>
                  
                  {contributors.length === 0 || contributors.some(c => c.loading) ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      <span className="ml-2 text-sm text-gray-500">{t('textsPage.loading')}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contributors.map((contributor) => (
                        <div 
                          key={`${contributor.role}-${contributor.person?.id || 'unknown'}`}
                          className="flex items-start gap-2 p-2 rounded bg-gray-50"
                        >
                          <div className="flex-1 space-y-1">
                            <div className="text-sm font-medium text-gray-900">
                              {getPersonDisplayName(contributor.person)}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {contributor.role}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <span className="text-gray-400">0</span>
        )}
      </TableCell>
    </TableRow>
  );
};

export default TextListCard;
