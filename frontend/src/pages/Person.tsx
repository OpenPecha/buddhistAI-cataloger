import { useState } from 'react';
import { usePersons } from '@/hooks/usePersons';
import type { Person } from '@/types/person';
import { Button } from '@/components/ui/button';
import PersonCard from '@/components/PersonCard';
import PersonFormModal from '@/components/PersonFormModal';
import { useTranslation } from 'react-i18next';

const PersonCRUD = () => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [modalMode] = useState<'create' | 'edit'>('create');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const LIMIT = 40; // Fixed limit
  const [offset, setOffset] = useState(0);

  const { data: persons = [], isLoading, error, refetch } = usePersons({ limit: LIMIT, offset });

  const handleModalSuccess = () => {
    setShowModal(false);
    setSelectedPerson(null);
    refetch();
  };

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
      <div className="space-y-4">
          {/* Pagination Controls */}
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 ">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
              <Button
                onClick={handlePrevPage}
                disabled={offset === 0}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {t('personsPage.previous')}
              </Button>
              <span className="text-xs sm:text-sm text-gray-600 text-center ">
                {t('personsPage.showing', { 
                  start: offset + 1, 
                  end: offset + persons.length 
                })}
              </span>
              <Button
                onClick={handleNextPage}
                disabled={persons.length < LIMIT}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {t('personsPage.next')}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow-md mx-1 sm:mx-0">
              <div className="text-center px-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-gray-600">{t('personsPage.loadingPersons')}</p>
              </div>
            </div>
          ) : error ? (
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
          ) : persons.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mx-1 sm:mx-0">
              <div className="text-center text-gray-500">
                <p className="text-base sm:text-lg">{t('personsPage.noPersonsFound')}</p>
                <p className="text-xs sm:text-sm mt-2">{t('personsPage.adjustFiltersOrCreate')}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 ">
            {persons.map((person: Person) => (
              <PersonCard 
                key={`person-card-${person.id}`} 
                person={person}
              />
            ))}
            </div>
          )}
        </div>

      {/* Person Form Modal */}
      <PersonFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleModalSuccess}
        mode={modalMode}
        existingPerson={selectedPerson}
      />
    </div>
  );
};

export default PersonCRUD;