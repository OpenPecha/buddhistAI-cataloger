import { Link } from 'react-router-dom';
import { Book, Globe, Calendar } from 'lucide-react';
import type { OpenPechaText } from '@/types/text';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

interface TextListCardProps {
  text: OpenPechaText;
}

const TextListCard = ({ text }: TextListCardProps) => {
  const getLanguageLabel = (lang: string): string => {
    const labels: Record<string, string> = {
      bo: 'Tibetan',
      en: 'English',
      sa: 'Sanskrit'
    };
    return labels[lang] || lang.toUpperCase();
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      root: 'Root Text',
      translation: 'Translation',
      commentary: 'Commentary'
    };
    return labels[type] || type;
  };

  const getLanguageColor = (lang: string): string => {
    const colors: Record<string, string> = {
      bo: 'bg-red-100 text-red-800',
      en: 'bg-blue-100 text-blue-800',
      sa: 'bg-orange-100 text-orange-800'
    };
    return colors[lang] || 'bg-gray-100 text-gray-800';
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
    <Card className="hover:shadow-lg transition-shadow duration-200 gap-2">
      <CardHeader>
        <div className="flex items-center gap-2 overflow-hidden">
          <Book className="w-5 h-5 text-gray-500  flex-shrink-0" />
          <CardTitle className="text-lg w-full ">
            <Link 
              to={`/texts/${text.id}/instances`} 
              className="hover:text-blue-600 w-full transition-colors duration-200 truncate"
            >
              {text.title?.[text.language] || 'Untitled'}
            </Link>
          </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge className={`${getLanguageColor(text.language)} flex items-center gap-2`}>
            <Globe className="w-4 h-4" />
            <span className="font-medium">{getLanguageLabel(text.language)}</span>
          </Badge>
          
          <Badge className={`${getTypeColor(text.type)} flex items-center gap-2`}>
            <Book className="w-4 h-4" />
            <span className="font-medium">{getTypeLabel(text.type)}</span>
          </Badge>
        </div>
        
        <div className="space-y-2 text-sm text-gray-600">
          {text.bdrc && (
            <div className="flex items-center gap-2">
              <span className="font-medium">BDRC ID:</span>
              <span className="font-mono text-xs">{text.bdrc}</span>
            </div>
          )}
          
          {text.date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="font-medium">Date:</span>
              <span className="text-xs">{text.date}</span>
            </div>
          )}
        </div>
        
        {/* Contributions */}
        {text.contributions && text.contributions.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-gray-600 text-sm font-medium mb-2">Contributors:</p>
            <div className="space-y-1">
              {text.contributions.slice(0, 2).map((contribution, index) => (
                <div key={`${text.id}-contributor-${contribution.person_id}-${index}`} className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="text-gray-300">•</span>
                  <span className="font-medium">{contribution.role}:</span>
                  <span className="font-mono">{contribution.person_id}</span>
                </div>
              ))}
              {text.contributions.length > 2 && (
                <div className="text-gray-400 italic text-xs">
                  +{text.contributions.length - 2} more contributors...
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TextListCard;
