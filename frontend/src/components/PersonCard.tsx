import { User, ExternalLink } from 'lucide-react';
import type { Person } from '@/types/person';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardAction } from './ui/card';

interface PersonCardProps {
  person: Person;
  onEdit?: (person: Person) => void;
}

const PersonCard = ({ person, onEdit }: PersonCardProps) => {
  // Helper function to get the main name
  const getMainName = (person: Person): string => {
    if (person.name.bo) return person.name.bo;
    if (person.name.en) return person.name.en;
    return Object.values(person.name)[0] || 'Unknown';
  };

  // Helper function to get alternative names
  const getAltNames = (person: Person): string[] => {
    return person.alt_names?.map(altName => Object.values(altName)[0]).slice(0, 3) || [];
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 gap-2">
      <CardHeader>
        <div className="flex w-full justify-between items-center gap-2">
          <CardTitle className="text-lg">{getMainName(person)}</CardTitle>
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-smooth">
          <User className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-smooth" />
          </div>   
        </div>

      </CardHeader>
      
      <CardContent className="space-y-3">
        {person.bdrc && (
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-secondary-700 flex items-center gap-2">
              <span className="font-medium">BDRC ID:</span>
              <span className="font-mono text-xs">{person.bdrc}</span>
            </Badge>
          </div>
        )}
        
        {person.wiki && (
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-gray-400" />
            <a 
              href={person.wiki} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:underline text-xs"
            >
              Wikipedia Link
            </a>
          </div>
        )}
        
        {/* Alternative Names */}
        {person.alt_names && person.alt_names.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-gray-800 text-sm font-medium mb-2">Alternative Names:</p>
            <div className="text-sm text-gray-500">
              {getAltNames(person).slice(0, 3).map((altName, index, arr) => (
                <span 
                  key={`alt-display-${person.id}-${index}`} 
                  className="truncate"
                >
                  {altName}{index < arr.length - 1 ? ', ' : ''}
                </span>
              ))}
              {person.alt_names.length > 3 && (
                <span className="text-gray-400 italic">
                  +{person.alt_names.length - 3} more...
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PersonCard;
