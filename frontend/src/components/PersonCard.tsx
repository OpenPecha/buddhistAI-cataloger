import { User, ExternalLink } from 'lucide-react';
import type { Person } from '@/types/person';
import { Badge } from './ui/badge';
import { TableRow, TableCell } from './ui/table';
import { useTranslation } from 'react-i18next';
import { getBdrclink } from '@/lib/bdrclink';

interface PersonCardProps {
  person: Person;
}

const PersonCard = ({ person }: PersonCardProps) => {
  const { t, i18n } = useTranslation();

  const getMainName = (person: Person): string => {
    if (person.name.bo) return person.name.bo;
    if (person.name.en) return person.name.en;
    return Object.values(person.name)[0] || t('personsPage.unknown');
  };

  const getAltNames = (person: Person): string[] => {
    if (!person.alt_names) return [];
    return person.alt_names
      .slice(0, 3)
      .map(altName => {
        const currentLang = i18n.language as 'en' | 'bo';
        if (altName[currentLang]) return altName[currentLang];
        if (altName.bo) return altName.bo;
        if (altName.en) return altName.en;
        return Object.values(altName).find(val => val !== null) || '';
      })
      .filter(name => name !== '');
  };


  return (
    <TableRow>
      {/* Name */}
      <TableCell className="font-medium text-lg flex items-center gap-2">
        <User className="w-5 h-5 ml-1 text-gray-400" />
        <span>{getMainName(person)}</span>
      </TableCell>

      {/* Type (Placeholder) */}
      <TableCell>
      {person.bdrc && (
            <div className="flex flex-wrap gap-2 items-center font-sans">
                  <a href={getBdrclink(person.bdrc)} target="_blank" rel="noopener noreferrer">
              <Badge className="bg-secondary-700 flex items-center gap-2">
              {person.bdrc}</Badge></a>
            </div>
          )}
      </TableCell>

      {/* Language (Placeholder) */}
      <TableCell>
      {person.alt_names && person.alt_names.length > 0 && (
            <div className="mt-2">
              <span className="block text-gray-700 text-xs font-medium mb-1">
                {t('personsPage.alternativeNames')}
              </span>
              <span className="text-xs text-gray-500">
                {getAltNames(person).map((altName, index, arr) => (
                  <span key={`alt-display-${person.id}-${index}`}>
                    {altName}
                    {index < arr.length - 1 && ', '}
                  </span>
                ))}
                {person.alt_names.length > 3 && (
                  <span className="text-gray-400 italic ml-1">
                    {t('personsPage.more', { count: person.alt_names.length - 3 })}
                  </span>
                )}
              </span>
            </div>
          )}
      </TableCell>

      {/* Actions & Other Info */}
      <TableCell>
        <div className="flex flex-col space-y-2">
          {/* Wiki Link */}
          {person.wiki && (
            <div className="flex items-center gap-2 mt-1">
              <ExternalLink className="w-4 h-4 text-gray-400" />
              <a
                href={person.wiki}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs"
              >
                {t('personsPage.wikipediaLink')}
              </a>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default PersonCard;
