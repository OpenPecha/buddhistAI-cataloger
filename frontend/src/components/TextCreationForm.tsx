import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { usePersons } from "@/hooks/usePersons";
import { useBdrcSearch } from "@/hooks/useBdrcSearch";
import type { Person } from "@/types/person";
import { Button } from "@/components/ui/button";
import { X, Plus, User, Loader2 } from "lucide-react";
import { detectLanguage } from "@/utils/languageDetection";
import PersonFormModal from "@/components/PersonFormModal";

interface TextCreationFormProps {
  onDataChange?: (textData: any) => void;
  getFormData?: () => any;
}

export interface TextCreationFormRef {
  addTitle: (text: string, language?: string) => void;
  setPersonSearch: (text: string) => void;
  openContributorForm: () => void;
  addFilenameAsTitle: (filename: string) => void;
}

interface Contributor {
  person?: Person;
  role: "translator" | "reviser" | "author" | "scholar";
}

interface TitleEntry {
  language: string;
  value: string;
}

const LANGUAGE_OPTIONS = [
  { code: "bo", name: "Tibetan" },
  { code: "en", name: "English" },
  { code: "zh", name: "Chinese" },
  { code: "sa", name: "Sanskrit" },
  { code: "fr", name: "French" },
  { code: "mn", name: "Mongolian" },
  { code: "pi", name: "Pali" },
  { code: "cmg", name: "Classical Mongolian" },
  { code: "ja", name: "Japanese" },
  { code: "ru", name: "Russian" },
  { code: "lzh", name: "Literary Chinese" },
];

const TextCreationForm = forwardRef<TextCreationFormRef, TextCreationFormProps>(
  ({ onDataChange }, ref) => {
    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      addTitle: (text: string, language?: string) => {
        // Check if the detected language is in the LANGUAGE_OPTIONS array
        const isValidLanguage = language && LANGUAGE_OPTIONS.some(
          (option) => option.code === language
        );
        
        const finalLanguage = isValidLanguage ? language : "";
        
        setTitles((prevTitles) => {
          // Check if this language already exists
          const existingIndex = prevTitles.findIndex(
            (t) => t.language === finalLanguage && finalLanguage !== ""
          );
          
          if (existingIndex !== -1) {
            // Update the existing entry instead of adding a new one
            const updatedTitles = [...prevTitles];
            updatedTitles[existingIndex].value = text;
            return updatedTitles;
          } else {
            // Add new entry
            return [...prevTitles, { language: finalLanguage, value: text }];
          }
        });
      },
      setPersonSearch: (text: string) => {
        // Set the person search field and show the dropdown
        setPersonSearch(text);
        setShowPersonDropdown(true);
      },
      openContributorForm: () => {
        // Open the Add Contributor form
        setShowAddContributor(true);
      },
      addFilenameAsTitle: (filename: string) => {
        // Remove file extension from filename
        const nameWithoutExtension = filename.replace(/\.[^/.]+$/, "");
        
        // Detect language from filename
        const detectedLanguage = detectLanguage(nameWithoutExtension);
        
        // Add as a title using functional update to avoid stale state
        setTitles((prevTitles) => {
          // Check if this language already exists
          const existingIndex = prevTitles.findIndex(
            (t) => t.language === detectedLanguage && detectedLanguage !== ""
          );
          
          if (existingIndex !== -1) {
            // Update the existing entry instead of adding a new one
            const updatedTitles = [...prevTitles];
            updatedTitles[existingIndex].value = nameWithoutExtension;
            return updatedTitles;
          } else {
            // Add new entry
            return [...prevTitles, { 
              language: detectedLanguage, 
              value: nameWithoutExtension 
            }];
          }
        });
      },
    }));

    const [selectedType, setSelectedType] = useState<
      "root" | "commentary" | "translation" | ""
    >("");
    const [titles, setTitles] = useState<TitleEntry[]>([]);
    const [language, setLanguage] = useState("");
    const [target, setTarget] = useState("");
    const [date, setDate] = useState(() => {
      // Initialize with today's date in YYYY-MM-DD format
      const today = new Date();
      return today.toISOString().split('T')[0];
    });
    const [bdrc, setBdrc] = useState("");
    
    // BDRC search state
    const [bdrcSearch, setBdrcSearch] = useState("");
    const [showBdrcDropdown, setShowBdrcDropdown] = useState(false);
    const [selectedBdrc, setSelectedBdrc] = useState<{ id: string; label: string } | null>(null);

    // Contributor management
    const [contributors, setContributors] = useState<Contributor[]>([]);
    const [showAddContributor, setShowAddContributor] = useState(false);

    // Contributor fields
    const [personSearch, setPersonSearch] = useState("");
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [showPersonDropdown, setShowPersonDropdown] = useState(false);
    const [debouncedPersonSearch, setDebouncedPersonSearch] = useState("");
    const [role, setRole] = useState<
      "translator" | "reviser" | "author" | "scholar"
    >("author");

    // Validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Person creation modal
    const [showPersonFormModal, setShowPersonFormModal] = useState(false);

    // BDRC search hook
    const { results: bdrcResults, isLoading: bdrcLoading } = useBdrcSearch(bdrcSearch);

    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedPersonSearch(personSearch);
      }, 300);
      return () => clearTimeout(timer);
    }, [personSearch]);

    const { data: persons = [], isLoading: personsLoading } = usePersons({
      limit: 50,
      offset: 0,
    });

    const filteredPersons = useMemo(() => {
      if (!debouncedPersonSearch.trim()) return persons.slice(0, 10);

      return persons
        .filter((person) => {
          const mainName =
            person.name.bo ||
            person.name.en ||
            Object.values(person.name)[0] ||
            "";
          const altNames = person.alt_names
            .map((alt) => Object.values(alt)[0])
            .join(" ");
          const searchLower = debouncedPersonSearch.toLowerCase();

          return (
            mainName.toLowerCase().includes(searchLower) ||
            altNames.toLowerCase().includes(searchLower) ||
            person.id.toLowerCase().includes(searchLower)
          );
        })
        .slice(0, 10);
    }, [persons, debouncedPersonSearch]);

    const getPersonDisplayName = (person: Person): string => {
      return (
        person.name.bo ||
        person.name.en ||
        Object.values(person.name)[0] ||
        "Unknown"
      );
    };

    const handlePersonSelect = (person: Person) => {
      setSelectedPerson(person);
      setPersonSearch(getPersonDisplayName(person));
      setShowPersonDropdown(false);
    };

    const handlePersonSearchChange = (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      setPersonSearch(e.target.value);
      setShowPersonDropdown(true);
      if (!e.target.value) {
        setSelectedPerson(null);
      }
    };

    const handleAddContributor = () => {
      const newErrors: Record<string, string> = {};

      if (!selectedPerson) {
        newErrors.contributor = "Please select a person";
        setErrors(newErrors);
        return;
      }

      const newContributor: Contributor = {
        person: selectedPerson,
        role: role,
      };

      setContributors([...contributors, newContributor]);

      // Reset form
      setShowAddContributor(false);
      setSelectedPerson(null);
      setPersonSearch("");
      setErrors({});
    };

    const handleRemoveContributor = (index: number) => {
      setContributors(contributors.filter((_, i) => i !== index));
    };

    // Build form data - can be called on demand
    const buildFormData = useCallback(() => {
      // Validate required fields
      if (!selectedType) {
        throw new Error("Type is required");
      }

      if (!language.trim()) {
        throw new Error("Language is required");
      }

      // Build title object from titles array (last value wins for duplicate languages)
      const title: Record<string, string> = {};
      titles.forEach((titleEntry) => {
        if (titleEntry.language && titleEntry.value.trim()) {
          title[titleEntry.language] = titleEntry.value.trim();
        }
      });

      if (Object.keys(title).length === 0) {
        throw new Error("At least one title is required");
      }

      if (contributors.length === 0) {
        throw new Error("At least one contributor is required");
      }

      // Build contributions array
      const contributionsArray = contributors.map((contributor) => {
        return {
          person_id: contributor.person!.id,
          role: contributor.role,
        };
      });

      // Build final payload
      const textData: any = {
        type: selectedType,
        title,
        language: language.trim(),
        contributions: contributionsArray,
        alt_titles: [], // Empty for now, will be populated when user adds alt titles
      };

      // Add target field for translation and commentary types
      if (selectedType === "translation" || selectedType === "commentary") {
        textData.target = target.trim() || "N/A";
      }

      // Add optional fields
      if (date.trim()) textData.date = date.trim();
      if (bdrc.trim()) textData.bdrc = bdrc.trim();

      return textData;
    }, [
      selectedType,
      titles,
      language,
      target,
      contributors,
      date,
      bdrc,
    ]);

    // Expose buildFormData to parent via window object
    useEffect(() => {
      // Store the function reference so parent can call it
      (window as any).__getTextFormData = buildFormData;
    }, [buildFormData]);

    // Call onDataChange when form data changes
    useEffect(() => {
      if (onDataChange) {
        try {
          const data = buildFormData();
          onDataChange(data);
        } catch (error) {
          // Form is not yet valid, don't call onDataChange
          onDataChange(null);
        }
      }
    }, [
      selectedType,
      titles,
      language,
      target,
      contributors,
      date,
      bdrc,
      onDataChange,
      buildFormData,
    ]);

    return (
      <div className="space-y-6">
        {/* Type and Language */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select type</option>
              <option value="root">Root</option>
              <option value="translation">Translation</option>
              <option value="commentary">Commentary</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="language"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Language <span className="text-red-500">*</span>
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select language</option>
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            {errors.language && (
              <p className="mt-1 text-sm text-red-600">{errors.language}</p>
            )}
          </div>
        </div>

        {/* Target field - only for commentary/translation */}
        {(selectedType === "commentary" || selectedType === "translation") && (
          <div>
            <label
              htmlFor="target"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Target Text ID
            </label>
            <input
              id="target"
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Leave empty for N/A"
            />

            {errors.target && (
              <p className="mt-1 text-sm text-red-600">{errors.target}</p>
            )}
          </div>
        )}

        {/* Titles Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span> (at least one
              required)
            </label>
            <Button
              type="button"
              onClick={() =>
                setTitles([...titles, { language: "", value: "" }])
              }
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Title
            </Button>
          </div>

          {/* Existing Titles List */}
          {titles.length > 0 && (
            <div className="space-y-3 mb-4">
              {titles.map((title, index) => (
                <div
                  key={index}
                  className="flex gap-2 items-start p-3 bg-gray-50 border border-gray-200 rounded-md"
                >
                  <select
                    value={title.language}
                    onChange={(e) => {
                      const selectedLang = e.target.value;
                      
                      // Check if this language already exists in another title entry
                      const existingIndex = titles.findIndex(
                        (t, i) => i !== index && t.language === selectedLang
                      );
                      
                      if (existingIndex !== -1 && selectedLang) {
                        // Language exists in another entry - merge/overwrite
                        const updatedTitles = titles.filter((_, i) => i !== existingIndex);
                        updatedTitles[index === existingIndex ? index : (index > existingIndex ? index - 1 : index)].language = selectedLang;
                        setTitles(updatedTitles);
                      } else {
                        // No conflict, just update normally
                        const newTitles = [...titles];
                        newTitles[index].language = selectedLang;
                        setTitles(newTitles);
                      }
                    }}
                    className="w-20 sm:w-32 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Lang</option>
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={title.value}
                    onChange={(e) => {
                      const newTitles = [...titles];
                      newTitles[index].value = e.target.value;
                      
                      // Auto-detect language if not already set
                      if (!newTitles[index].language && e.target.value.trim()) {
                        const detectedLang = detectLanguage(e.target.value);
                        if (detectedLang) {
                          // Check if this detected language already exists in another title entry
                          const existingIndex = titles.findIndex(
                            (t, i) => i !== index && t.language === detectedLang
                          );
                          
                          if (existingIndex !== -1) {
                            // Language exists in another entry - remove the other one
                            const updatedTitles = newTitles.filter((_, i) => i !== existingIndex);
                            const adjustedIndex = index > existingIndex ? index - 1 : index;
                            updatedTitles[adjustedIndex].language = detectedLang;
                            setTitles(updatedTitles);
                            return;
                          } else {
                            newTitles[index].language = detectedLang;
                          }
                        }
                      }
                      
                      setTitles(newTitles);
                    }}
                    className="flex-1 min-w-0 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Enter title"
                  />
                  <Button
                    type="button"
                    onClick={() =>
                      setTitles(titles.filter((_, i) => i !== index))
                    }
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
        </div>

        {/* Contributors Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Contributors <span className="text-red-500">*</span> (at least one
              required)
            </label>
            <Button
              type="button"
              onClick={() => setShowAddContributor(!showAddContributor)}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Contributor
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
                        {getPersonDisplayName(contributor.person!)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Role: {contributor.role}
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

          {errors.contributions && (
            <p className="mt-1 text-sm text-red-600">{errors.contributions}</p>
          )}

          {/* Add Contributor Form */}
          {showAddContributor && (
            <div className="p-4 border border-gray-300 rounded-md bg-gray-50 space-y-4">
                  {/* Person Search */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search Person
                    </label>
                    <input
                      type="text"
                      value={personSearch}
                      onChange={handlePersonSearchChange}
                      onFocus={() => setShowPersonDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowPersonDropdown(false), 200)
                      }
                      className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base leading-relaxed"
                      placeholder="Search for person..."
                    />

                    {personsLoading && (
                      <div className="absolute right-3 top-9">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      </div>
                    )}

                    {showPersonDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {/* Create Person Button - Always at top */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowPersonFormModal(true);
                            setShowPersonDropdown(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b-2 border-blue-200 bg-blue-50/50 flex items-center gap-2 text-blue-600 font-medium"
                        >
                          <Plus className="w-4 h-4" />
                          Create New Person
                        </button>

                        {filteredPersons.length > 0 ? (
                          <>
                            {filteredPersons.map((person) => (
                              <button
                                key={person.id}
                                type="button"
                                onClick={() => handlePersonSelect(person)}
                                className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100"
                              >
                                <div className="font-medium">
                                  {getPersonDisplayName(person)}
                                </div>
                                {person.alt_names && person.alt_names.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {person.alt_names.slice(0, 3).map((altName, idx) => (
                                      altName.bo && (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                                        >
                                          {altName.bo}
                                        </span>
                                      )
                                    ))}
                                    {person.alt_names.length > 3 && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">
                                        +{person.alt_names.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </button>
                            ))}
                          </>
                        ) : (
                          <div className="px-4 py-2 text-gray-500 text-sm">
                            No persons found
                          </div>
                        )}
                      </div>
                    )}

                    {selectedPerson && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        <div className="text-blue-600 font-medium">
                          Selected: {getPersonDisplayName(selectedPerson)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="author">Author</option>
                      <option value="translator">Translator</option>
                      <option value="reviser">Reviser</option>
                      <option value="scholar">Scholar</option>
                    </select>
                  </div>

              {errors.contributor && (
                <p className="text-sm text-red-600">{errors.contributor}</p>
              )}

              {/* Add/Cancel Buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleAddContributor}
                  className="flex-1"
                >
                  Add
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddContributor(false);
                    setErrors({});
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Optional Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="bdrc"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              BDRC Work ID
            </label>
            <div className="relative">
              {selectedBdrc ? (
                // Display selected BDRC (read-only, click to change)
                <div
                  onClick={() => {
                    setSelectedBdrc(null);
                    setBdrc("");
                    setBdrcSearch("");
                    setShowBdrcDropdown(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-gray-900">{selectedBdrc.id}</span>
                  <span className="text-xs text-blue-600">Click to change</span>
                </div>
              ) : (
                // Search input
                <>
                  <input
                    id="bdrc"
                    type="text"
                    value={bdrcSearch}
                    onChange={(e) => {
                      setBdrcSearch(e.target.value);
                      setShowBdrcDropdown(true);
                    }}
                    onFocus={() => setShowBdrcDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowBdrcDropdown(false);
                        // Clear search if nothing was actually selected
                        if (!selectedBdrc) {
                          setBdrcSearch("");
                        }
                      }, 200);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Search BDRC entries..."
                  />
                  {/* BDRC Dropdown */}
                  {showBdrcDropdown && bdrcSearch.trim() && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {bdrcLoading ? (
                        <div className="px-4 py-8 flex flex-col items-center justify-center">
                          <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                          <div className="text-sm text-gray-500">Searching...</div>
                        </div>
                      ) : bdrcResults.length > 0 ? (
                        bdrcResults
                          .filter((result) => result.prefLabel && result.prefLabel !== " - no data - ")
                          .map((result, index) => (
                            <button
                              key={`${result.workId}-${index}`}
                              type="button"
                              onClick={() => {
                                setSelectedBdrc({
                                  id: result.workId,
                                  label: result.prefLabel,
                                });
                                setBdrc(result.workId);
                                setShowBdrcDropdown(false);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100"
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {result.prefLabel}
                              </div>
                              <div className="text-xs text-gray-500">{result.workId}</div>
                            </button>
                          ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No BDRC entries found
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

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
  }
);

TextCreationForm.displayName = "TextCreationForm";

export default TextCreationForm;
