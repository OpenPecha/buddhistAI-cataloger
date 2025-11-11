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
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [pagination, setPagination] = useState({
    limit: 30,
    offset: 0,
    nationality: '',
    occupation: ''
  });

  const { data: persons = [], isLoading, error, refetch } = usePersons(pagination);


  const handleCreate = () => {
    setModalMode('create');
    setSelectedPerson(null);
    setShowModal(true);
  };

  const handleEdit = (person: Person) => {
    setModalMode('edit');
    setSelectedPerson(person);
    setShowModal(true);
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    setSelectedPerson(null);
    refetch();
  };

  const handlePaginationChange = (newPagination: Partial<typeof pagination>) => {
    setPagination(prev => ({ ...prev, ...newPagination }));
  };

  const handleNextPage = () => {
    setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
  };

  const handlePrevPage = () => {
    setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Breadcrumb */}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('personsPage.title')}</h2>
        <Button
          onClick={handleCreate}
          className="w-full sm:w-auto"
        >
          {t('personsPage.createPerson')}
        </Button>
      </div>

      {/* Content */}
      <div className="space-y-4">
          {/* Filters and Controls */}
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
              <div>
                <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">{t('personsPage.limit')}</label>
                <select
                  id="limit"
                  value={pagination.limit}
                  onChange={(e) => handlePaginationChange({ limit: parseInt(e.target.value), offset: 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div>
                <label htmlFor="nationality" className="block text-sm font-medium text-gray-700 mb-1">{t('personsPage.nationality')}</label>
                <input
                  id="nationality"
                  type="text"
                  value={pagination.nationality}
                  onChange={(e) => handlePaginationChange({ nationality: e.target.value, offset: 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('personsPage.filterByNationality')}
                />
              </div>
              <div>
                <label htmlFor="occupation" className="block text-sm font-medium text-gray-700 mb-1">{t('personsPage.occupation')}</label>
                <input
                  id="occupation"
                  type="text"
                  value={pagination.occupation}
                  onChange={(e) => handlePaginationChange({ occupation: e.target.value, offset: 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('personsPage.filterByOccupation')}
                />
              </div>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 pt-4 border-t border-gray-200">
              <Button
                onClick={handlePrevPage}
                disabled={pagination.offset === 0}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {t('personsPage.previous')}
              </Button>
              <span className="text-xs sm:text-sm text-gray-600 text-center">
                {t('personsPage.showing', { 
                  start: pagination.offset + 1, 
                  end: pagination.offset + persons.length 
                })}
              </span>
              <Button
                onClick={handleNextPage}
                disabled={persons.length < pagination.limit}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {persons.map((person: Person) => (
              <PersonCard 
                key={`person-card-${person.id}`} 
                person={person} 
                onEdit={handleEdit}
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