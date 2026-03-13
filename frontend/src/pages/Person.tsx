import { useState } from 'react';
import { usePersons } from '@/hooks/usePersons';
import type { Person } from '@/types/person';
import { SimplePagination } from '@/components/ui/simple-pagination';
import PersonCard from '@/components/PersonCard';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PersonCRUD = () => {
  const { t } = useTranslation();
  const LIMIT = 40; // Fixed limit
  const [offset, setOffset] = useState(0);

  const { data: persons = [], isLoading, error, refetch } = usePersons({ limit: LIMIT, offset });

  

  const handleNextPage = () => {
    setOffset(prev => prev + LIMIT);
  };

  const handlePrevPage = () => {
    setOffset(prev => Math.max(0, prev - LIMIT));
  };

  return (
    <div className="container mx-auto py-16  space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Breadcrumb */}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 ">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('personsPage.title')}</h2>
      </div>

      {/* Content */}
      <div className="space-y-4 bg-white rounded-lg shadow-md mx-1 sm:mx-0">
         

          {isLoading && (
            <div className="bg-white rounded-lg shadow-md mx-1 sm:mx-0">
              <Table>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-4 px-2">
                        <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 w-20 bg-gray-100 rounded"></div>
                      </td>
                      <td className="py-4 px-2">
                        <div className="h-4 w-24 bg-gray-200 rounded"></div>
                      </td>
                      <td className="py-4 px-2">
                        <div className="h-4 w-36 bg-gray-200 rounded"></div>
                      </td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          { error && (
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mx-1 sm:mx-0">
              <div className="text-center">
                <p className="text-sm sm:text-base text-red-500 mb-4">{t('personsPage.errorLoadingPersons')}</p>
                <button
                  onClick={() => refetch()}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors text-sm sm:text-base"
                >
                  {t('personsPage.retry')}
                </button>
              </div>
            </div>
          )} 
          { !isLoading && persons.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mx-1 sm:mx-0">
              <div className="text-center text-gray-500">
                <p className="text-base sm:text-lg">{t('personsPage.noPersonsFound')}</p>
                <p className="text-xs sm:text-sm mt-2">{t('personsPage.adjustFiltersOrCreate')}</p>
              </div>
            </div>
          )} 
          { persons.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-extrabold text-neutral-700">Name</TableHead>
                  <TableHead className="font-extrabold text-neutral-700">BDRC ID</TableHead>
                  <TableHead className="font-extrabold text-neutral-700">Alternative Names</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {persons.map((person: Person) => (
                  <PersonCard 
                    key={`person-card-${person.id}`} 
                    person={person}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {/* Pagination Controls */}
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <SimplePagination
            canGoPrev={offset > 0}
            canGoNext={persons.length >= LIMIT}
            onPrev={handlePrevPage}
            onNext={handleNextPage}
            label={t('personsPage.showing', {
              start: offset + 1,
              end: offset + persons.length,
            })}
            labelPosition="center"
          />
        </div>
      </div>
  );
};

export default PersonCRUD;