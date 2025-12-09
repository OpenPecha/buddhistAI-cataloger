import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Book, Globe, Calendar, Users, Loader2 } from 'lucide-react';
import type { OpenPechaText } from '@/types/text';
import type { Person } from '@/types/person';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { useTranslation } from 'react-i18next';
import { getLanguageColor, getLanguageLabel } from '@/utils/getLanguageLabel';

interface TextListCardProps {
  text: OpenPechaText;
}

import { API_URL } from '@/config/api';

const TextListCard = ({ text }: TextListCardProps) => {
  const { t } = useTranslation();
  const [showContributors, setShowContributors] = useState(false);
  const [contributors, setContributors] = useState<Array<{ person: Person | null; role: string; loading: boolean }>>([]);
  
  // Fetch contributors when popover is opened
  useEffect(() => {
    if (showContributors && text.contributions && text.contributions.length > 0) {
      // Initialize with loading state
      setContributors(text.contributions.map(c => ({ person: null, role: c.role, loading: true })));
      
      // Fetch all contributors in parallel
      Promise.all(
        text.contributions.map(async (contribution) => {
          try {
            const response = await fetch(`${API_URL}/person/${contribution.person_id}`);
            if (response.ok) {
              const person: Person = await response.json();
              return { person, role: contribution.role, loading: false };
            }
            return { person: null, role: contribution.role, loading: false };
          } catch (error) {
            return { person: null, role: contribution.role, loading: false };
          }
        })
      ).then(results => {
        setContributors(results);
      });
    }
  }, [showContributors, text.contributions]);
  
  const getPersonDisplayName = (person: Person | null): string => {
    if (!person) return t('textsPage.nameNotAvailable');
    return person.name?.bo || person.name?.en || t('textsPage.nameNotAvailable');
  };
  


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
    <Card className="hover:shadow-lg transition-shadow duration-200 gap-2 ">
      <CardHeader>
        <div className="flex items-center gap-2 overflow-hidden">
          <Book className="w-5 h-5 text-gray-500  flex-shrink-0" />
          <CardTitle className="text-lg w-full ">
            <Link 
              to={`/texts/${text.id}/instances`} 
              className="w-full transition-colors duration-200 truncate text-2xl text-neutral-700 hover:text-blue-500 "
            >
              {text.title?.[text.language] || t('textsPage.untitled')}
            </Link>
          </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
         
          
          <Badge className={`${getTypeColor(text.type)} flex items-center gap-2`}>
            <Book className="w-4 h-4" />
            <span className="font-medium">{getTypeLabel(text.type)}</span>
          </Badge>
        </div>
        
       
        
        {/* Contributions */}
        {text.language && (
          <div className="pt-3 flex items-center justify-between gap-2 border-t border-gray-100 relative">
             <Badge className={`${getLanguageColor(text.language)} flex items-center gap-2`}>
            <Globe className="w-4 h-4" />
            <span className="font-medium">{getLanguageLabel(text.language)}</span>
          </Badge>
            <button 
            hidden={text.contributions?.length === 0}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
              onClick={() => setShowContributors(!showContributors)}
            >
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 font-medium">
                {text.contributions?.length || 0} 
              </span>
            </button>
            
            {/* Contributors Popover */}
            {showContributors && (
              <>
                {/* Backdrop to close popover */}
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowContributors(false)}
                />
                
                {/* Popover Content */}
                <div className="absolute left-0 top-full mt-2 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[280px] max-w-[320px]">
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
                      {contributors.map((contributor, index) => (
                        <div 
                          key={index}
                          className="flex items-start gap-2 p-2 rounded bg-gray-50"
                        >
                          <div className="flex-1">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TextListCard;
