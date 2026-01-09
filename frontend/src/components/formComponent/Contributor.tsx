import React, { useState, useCallback, memo } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { useTranslation } from 'react-i18next';
import { Plus, X, User } from 'lucide-react';
import type { Person } from '@/types/person';
import { useBdrcSearch } from '@/hooks/useBdrcSearch';
import { usePersons } from '@/hooks/usePersons';
import { useThrottledValue } from '@tanstack/react-pacer';
import RoleSelectionForm from './RoleSelectionForm';
import PersonFormModal from '../PersonFormModal';

export interface ContributorItem {
  person?: Person;
  role: "translator" | "author";
}

interface ContributorProps {
  contributors: ContributorItem[];
  setContributors: React.Dispatch<React.SetStateAction<ContributorItem[]>>;
  errors?: {
    contributors?: string;
    contributor?: string;
    contributions?: string;
  };
}

const Contributor: React.FC<ContributorProps> = ({
  contributors,
  setContributors,
  errors = {},
}) => {
  const { t } = useTranslation();

  // Contributor form state
  const [showAddContributor, setShowAddContributor] = useState(false);
  const [personSearch, setPersonSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  // Person creation modal
  const [showPersonFormModal, setShowPersonFormModal] = useState(false);

  // BDRC search hook for persons
  const [debouncedPersonSearch] = useThrottledValue(personSearch, { wait: 1000 });
  const { results: bdrcPersonResults, isLoading: bdrcPersonLoading } = useBdrcSearch(
    debouncedPersonSearch,
    "Person",
    1000
  );

  const { isLoading: personsLoading } = usePersons({
    limit: 100,
    offset: 0,
  });

  const getPersonDisplayName = useCallback((person: Person): string => {
    // Safety check in case name is undefined
    if (!person.name) {
      return person.id || t("textForm.unknown");
    }
    return (
      person.name.bo ||
      person.name.en ||
      Object.values(person.name)[0] ||
      t("textForm.unknown")
    );
  }, [t]);

  const handlePersonSelect = useCallback((person: Person) => {
    setSelectedPerson(person);
    setPersonSearch(getPersonDisplayName(person));
    setShowPersonDropdown(false);
  }, [getPersonDisplayName]);

  const handlePersonSearchChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setPersonSearch(e.target.value);
    setShowPersonDropdown(true);
    if (!e.target.value) {
      setSelectedPerson(null);
    }
  }, []);

  const handleAddContributor = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!selectedPerson) {
      newErrors.contributor = t("textForm.selectPerson");
      setLocalErrors(newErrors);
      return;
    }

    if (!role) {
      newErrors.contributor = t("textForm.selectRole");
      setLocalErrors(newErrors);
      return;
    }

    setContributors((prev) => [
      ...prev,
      {
        person: selectedPerson,
        role: role as "translator" | "author",
      },
    ]);

    // Reset form
    setShowAddContributor(false);
    setSelectedPerson(null);
    setPersonSearch("");
    setRole(null);
    setLocalErrors({});
  }, [selectedPerson, role, t, setContributors]);

  const handleRemoveContributor = useCallback((index: number) => {
    setContributors((prev) => prev.filter((_, i) => i !== index));
  }, [setContributors]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label htmlFor="contributors" className="mb-2">
          {t("textForm.contributors")}
        </Label>
        <Button
          type="button"
          onClick={() => setShowAddContributor(!showAddContributor)}
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          {t("textForm.addContributor")}
        </Button>
      </div>

      {/* Existing Contributors List */}
      {contributors.length > 0 && (
        <div className="space-y-2 mb-4">
          {contributors.map((contributor, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md"
            >
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">
                    {contributor.person ? getPersonDisplayName(contributor.person) : t("textForm.unknown")}
                  </div>
                  <div className="text-sm text-gray-500">
                    {t("textForm.role")}: {t(`textForm.${contributor.role}`)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveContributor(index)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {(errors.contributions || errors.contributors) && (
        <p className="mt-1 text-sm text-red-600">{errors.contributions || errors.contributors}</p>
      )}

      {/* Add Contributor Form */}
      {showAddContributor && (
        <div className="p-4 border border-gray-300 rounded-md bg-gray-50 space-y-4">
          {/* Person Search */}
          <div className="relative flex gap-2">
            <RoleSelectionForm role={role || ""} setRole={setRole} />
            <input
              type="text"
              value={personSearch}
              onChange={handlePersonSearchChange}
              onFocus={() => setShowPersonDropdown(true)}
              onBlur={() =>
                setTimeout(() => setShowPersonDropdown(false), 2000)
              }
              className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base leading-relaxed"
              placeholder={t("textForm.searchForPerson")}
            />

            {personsLoading && (
              <div className="absolute right-3 top-9">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              </div>
            )}

            {showPersonDropdown && (
              <div className="absolute z-10 top-full w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
                {/* BDRC Person Results Section */}
                {debouncedPersonSearch.trim() && (
                  <>
                    <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                      <span className="text-xs font-semibold text-gray-700 uppercase">
                        {t("textForm.bdrcCatalogPerson")}
                      </span>
                    </div>
                    {bdrcPersonLoading ? (
                      <div className="px-4 py-4 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        <div className="text-sm text-gray-500">{t("textForm.searchingBdrcPerson")}</div>
                      </div>
                    ) : bdrcPersonResults.length > 0 ? (
                      <BdrcPersonList
                        bdrcPersonResults={bdrcPersonResults}
                        handlePersonSelect={handlePersonSelect}
                      />
                    ) : debouncedPersonSearch.trim() ? (
                      <div className="px-4 py-2 text-gray-500 text-sm">
                        {t("textForm.noResults")}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </div>

          {(errors.contributor || localErrors.contributor) && (
            <p className="text-sm text-red-600">{errors.contributor || localErrors.contributor}</p>
          )}

          {/* Add/Cancel Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleAddContributor}
              className="flex-1"
            >
              {t("textForm.add")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowAddContributor(false);
                setLocalErrors({});
                setSelectedPerson(null);
                setPersonSearch("");
                setRole(null);
              }}
              variant="outline"
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Person Creation Modal */}
      <PersonFormModal
        isOpen={showPersonFormModal}
        onClose={() => setShowPersonFormModal(false)}
        onSuccess={(createdPerson) => {
          // Select the newly created person
          setSelectedPerson(createdPerson);
          setPersonSearch(getPersonDisplayName(createdPerson));
        }}
      />
    </div>
  );
};

// BdrcPersonList component
interface BdrcPersonListProps {
  bdrcPersonResults: Array<{ bdrc_id?: string; name?: string }>;
  handlePersonSelect: (person: Person) => void;
}

const BdrcPersonList = memo(({ bdrcPersonResults, handlePersonSelect }: BdrcPersonListProps) => {
  const handlePersonClick = useCallback((result: { bdrc_id?: string; name?: string }) => {
    // Create a temporary Person object from BDRC data
    const bdrcPerson: Person = {
      id: result.bdrc_id || '',
      name: { bo: result.name || '' },
      alt_names: [],
      bdrc: result.bdrc_id || '',
      wiki: null
    };
    handlePersonSelect(bdrcPerson);
  }, [handlePersonSelect]);

  return (
    <div className="z-50">
      {bdrcPersonResults.map((result) => (
        <button
          key={result.bdrc_id}
          type="button"
          onClick={() => handlePersonClick(result)}
          className="w-full px-4 py-2 z-50 text-left hover:bg-purple-50 border-b border-gray-100"
        >
          <div className="flex items-start gap-2">
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              BDRC
            </span>
            <div className="flex-1">
              <div className="font-medium text-sm">
                {result.name || "Untitled"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {result.bdrc_id}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
});

BdrcPersonList.displayName = "BdrcPersonList";

export default Contributor;
