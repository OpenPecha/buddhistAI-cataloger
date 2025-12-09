import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  memo,
} from "react";
import { usePersons } from "@/hooks/usePersons";
import { useBdrcSearch } from "@/hooks/useBdrcSearch";
import type { Person } from "@/types/person";
import type { OpenPechaText } from "@/types/text";
import { Button } from "@/components/ui/button";
import { X, Plus, User, Loader2, AlertTriangle } from "lucide-react";
import { detectLanguage } from "@/utils/languageDetection";
import PersonFormModal from "@/components/PersonFormModal";
import { MultilevelCategorySelector } from "@/components/MultilevelCategorySelector";
import { fetchTextByBdrcId } from "@/api/texts";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/useEnum";
import LanguageSelectorForm from "./formComponent/LanguageSelectorForm";
import RoleSelectionForm from "./formComponent/RoleSelectionForm";
import Copyright from "./formComponent/Copyright";
import { Input } from "./ui/input";

interface TextCreationFormProps {
  onDataChange?: (textData: any) => void;
  getFormData?: () => any;
  onExistingTextFound?: (text: OpenPechaText) => void;
}

export interface TextCreationFormRef {
  addTitle: (text: string, language?: string) => void;
  addAltTitle: (text: string, language?: string) => void;
  setPersonSearch: (text: string) => void;
  openContributorForm: () => void;
  hasTitle: () => boolean;
  setBdrcId: (bdrcId: string, label: string) => void;
  setFormLanguage: (language: string) => void;
  getLanguage: () => string;
  addContributorFromBdrc: (personBdrcId: string, personName: string, role: "translator" | "author") => void;
  initializeForm?: (data: {
    type?: string;
    language?: string;
    date?: string;
    categoryId?: string;
    copyright?: string;
    license?: string;
    bdrc?: string;
    target?: string;
  }) => void;
}

interface Contributor {
  person?: Person;
  role: "translator" | "author";
}

interface TitleEntry {
  language: string;
  value: string;
}



const TextCreationForm = forwardRef<TextCreationFormRef, TextCreationFormProps>(
  ({ onDataChange, onExistingTextFound }, ref) => {
    const { t } = useTranslation();
    const {data: LANGUAGE_OPTIONS,isLoading: isLoadingLanguageOptions} = useLanguage();
    // State declarations
    const [selectedType, setSelectedType] = useState<
      "root" | "translation" | ""
    >("root");
    const [titles, setTitles] = useState<TitleEntry[]>([]);
    const [altTitles, setAltTitles] = useState<TitleEntry[][]>([]);
    const [language, setLanguage] = useState("");
    const [target, setTarget] = useState("");
    const [date, setDate] = useState(() => {
      // Initialize with today's date in YYYY-MM-DD format
      const today = new Date();
      return today.toISOString().split('T')[0];
    });
    const [bdrc, setBdrc] = useState("");
    const [categoryId, setCategoryId] = useState<string>("");
    const [categoryError, setCategoryError] = useState<boolean>(false);
    const [copyright, setCopyright] = useState<string>("Unknown");
    const [license, setLicense] = useState<string>("Unknown");
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
    const [role, setRole] = useState<string | null>(null);

    // Validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Person creation modal
    const [showPersonFormModal, setShowPersonFormModal] = useState(false);

    // BDRC conflict state
    const [showBdrcConflictDialog, setShowBdrcConflictDialog] = useState(false);
    
    const [conflictingText, setConflictingText] = useState<OpenPechaText | null>(null);
    const [pendingBdrcSelection, setPendingBdrcSelection] = useState<{ id: string; label: string } | null>(null);
    const [isCheckingBdrcId, setIsCheckingBdrcId] = useState(false);
    
  

    // Auto-set license to "unknown" when copyright is "Unknown"
    useEffect(() => {
      if (copyright === "Unknown") {
        setLicense("unknown");
      }
      if (copyright === "Public domain") {
        setLicense("Public Domain Mark");
      }
      if (copyright === "In copyright") {
        setLicense("under copyright");
      }
    }, [copyright]);

    // BDRC search hook for instances
    const { results: bdrcResults, isLoading: bdrcLoading } = useBdrcSearch(bdrcSearch);
    
    // BDRC search hook for persons
    const { results: bdrcPersonResults, isLoading: bdrcPersonLoading } = useBdrcSearch(
      debouncedPersonSearch,
      "Person",
      1000
    );

    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedPersonSearch(personSearch);
      }, 300);
      return () => clearTimeout(timer);
    }, [personSearch]);

    // Auto-add title entry with selected language when language is selected
    useEffect(() => {
      if (language && language.trim()) {
        setTitles((prev) => {
          // Check if there's already a title entry with this language
          const hasTitleWithLanguage = prev.some(
            (title) => title.language === language
          );
          
          // If no title exists with this language, add one
          if (!hasTitleWithLanguage) {
            return [...prev, { language: language, value: "" }];
          }
          return prev;
        });
      }
    }, [language]);

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
        setErrors(newErrors);
        return;
      }

      setContributors((prev) => [
        ...prev,
        {
          person: selectedPerson,
          role: role,
        },
      ]);

      // Reset form
      setShowAddContributor(false);
      setSelectedPerson(null);
      setPersonSearch("");
      setErrors({});
    }, [selectedPerson, role, t]);

    const handleRemoveContributor = useCallback((index: number) => {
      setContributors((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // Build form data - can be called on demand
    const buildFormData = useCallback(() => {
      // Validate required fields
      if (!selectedType) {
        throw new Error(t("textForm.typeRequired"));
      }

      if (!language.trim()) {
        throw new Error(t("textForm.languageRequired"));
      }

      // Build title object from titles array (last value wins for duplicate languages)
      const title: Record<string, string> = {};
      titles.forEach((titleEntry) => {
        if (titleEntry.language && titleEntry.value.trim()) {
          title[titleEntry.language] = titleEntry.value.trim();
        }
      });

      if (Object.keys(title).length === 0) {
        throw new Error(t("textForm.titleRequired"));
      }

      if (!categoryId.trim()) {
        setCategoryError(true);
        throw new Error(t("textForm.categoryRequired"));
      } else {
        setCategoryError(false);
      }

      // Build contributions array (only if contributors exist)
      let contributionsArray = contributors?.map((contributor) => {
          // Use bdrc field if available, otherwise fall back to id
          const personBdrcId = contributor.person!.bdrc || contributor.person!.id;
          return {
            person_bdrc_id: personBdrcId,
            role: contributor.role,
          };
        });

      // Build alt_titles array - transform from grouped structure to array of dictionaries
      const altTitlesArray = altTitles
        .map((titleGroup) => {
          const alt: Record<string, string> = {};
          titleGroup.forEach(({ language, value }) => {
            if (language && value.trim()) {
              alt[language] = value.trim();
            }
          });
          return alt;
        })
        .filter((alt) => Object.keys(alt).length > 0);

      // Build final payload
      const textData: any = {
        type: selectedType,
        title,
        language: language.trim(),
        alt_titles: altTitlesArray,
      };

      // Only add contributions if there are any
      if (contributors.length > 0) {
        textData.contributions = contributionsArray;
      }

      // Add target field for translation and commentary types
      if (selectedType === "translation" || selectedType === "commentary") {
        textData.target = target.trim() || "N/A";
      }

      // Add optional fields
      if (date.trim()) textData.date = date.trim();
      if (bdrc.trim()) textData.bdrc = bdrc.trim();
      
      // Add required category
      if (categoryId && categoryId.trim()) {
        textData.category_id = categoryId.trim();
      }

      // Add copyright (optional field)
      if (copyright && copyright.trim()) {
        textData.copyright = copyright.trim();
      }

      // Add license (if copyright is Unknown, send "unknown", otherwise use selected license or default to "CC0")
      if (copyright === "Unknown") {
        textData.license = "unknown";
      } else if (license && license.trim()) {
        textData.license = license.trim();
      } else {
        // If license is empty, send "CC0" as default
        textData.license = "CC0";
      }

      return textData;
    }, [
      selectedType,
      titles,
      altTitles,
      language,
      target,
      contributors,
      date,
      bdrc,
      categoryId,
      copyright,
      license,
      t,
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
        } catch {
          // Form is not yet valid, don't call onDataChange
          onDataChange(null);
        }
      }
    }, [
      buildFormData,
      onDataChange,
    ]);

    // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
      addTitle: (text: string, language?: string) => {
        const langToUse = language || "";
        setTitles((prev) => {
          // Check if there's already a title entry with this language
          const existingIndex = prev.findIndex(
            (title) => title.language === langToUse
          );
          
          if (existingIndex !== -1) {
            // Update existing title
            const updated = [...prev];
            updated[existingIndex].value = text;
            return updated;
          } else {
            // Add new title
            return [...prev, { language: langToUse, value: text }];
          }
        });
      },
      addAltTitle: (text: string, language?: string) => {
        const langToUse = language || "";
        setAltTitles((prev) => {
          // Add to the last group, or create a new group if none exists
          if (prev.length === 0) {
            return [[{ language: langToUse, value: text }]];
          }
          const updated = [...prev];
          const lastGroup = updated[updated.length - 1];
          // Check if language already exists in last group
          const existingIndex = lastGroup.findIndex(
            (t) => t.language === langToUse
          );
          if (existingIndex !== -1) {
            lastGroup[existingIndex].value = text;
          } else {
            lastGroup.push({ language: langToUse, value: text });
          }
          updated[updated.length - 1] = [...lastGroup];
          return updated;
        });
      },
      setPersonSearch: (text: string) => {
        setPersonSearch(text);
      },
      openContributorForm: () => {
        setShowAddContributor(true);
      },
      hasTitle: () => {
        return titles.some((t) => t.value.trim() !== "");
      },
      setBdrcId: (bdrcId: string, label: string) => {
        setBdrc(bdrcId);
        setSelectedBdrc({ id: bdrcId, label });
        setBdrcSearch("");
      },
      setFormLanguage: (lang: string) => {
        setLanguage(lang);
      },
      getLanguage: () => {
        return language;
      },
      addContributorFromBdrc: (personBdrcId: string, personName: string, role: "translator" | "author") => {
        // Create a temporary Person object from BDRC data
        const bdrcPerson: Person = {
          id: personBdrcId,
          name: { bo: personName },
          alt_names: [],
          bdrc: personBdrcId,
          wiki: null
        };
        
        // Add contributor directly
        setContributors((prev) => [
          ...prev,
          {
            person: bdrcPerson,
            role: role as "translator" | "author",
          },
        ]);
        
        // Reset person search form
        setShowAddContributor(false);
        setSelectedPerson(null);
        setPersonSearch("");
        setErrors({});
      },
      initializeForm: (data: {
        type?: string;
        language?: string;
        date?: string;
        categoryId?: string;
        copyright?: string;
        license?: string;
        bdrc?: string;
        target?: string;
      }) => {
        if (data.type) setSelectedType(data.type as any);
        if (data.language) setLanguage(data.language);
        if (data.date) setDate(data.date);
        if (data.categoryId) setCategoryId(data.categoryId);
        if (data.copyright) setCopyright(data.copyright);
        if (data.license) setLicense(data.license);
        if (data.bdrc) {
          setBdrc(data.bdrc);
          setSelectedBdrc({ id: data.bdrc, label: data.bdrc });
        }
        if (data.target) setTarget(data.target);
      },
    }), [language, titles, altTitles, contributors]);

    return (
      <div className="space-y-6 text-lg">
        {/* Type and Language */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="hidden">
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("textForm.type")} <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              value={selectedType}
              disabled={true}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <option value="">{t("textForm.selectType")}</option>
              <option value="root">{t("textForm.root")}</option>
              <option value="translation">{t("textForm.translation")}</option>
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
              {t("textForm.language")} <span className="text-red-500">*</span>
            </label>
           <LanguageSelectorForm language={language} setLanguage={setLanguage} />
            {errors.language && (
              <p className="mt-1 text-sm text-red-600">{errors.language}</p>
            )}
          </div>
        </div>

        {/* Target field - only for commentary/translation */}
        {selectedType === "translation"&& (
          <div>
            <label
              htmlFor="target"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("textForm.targetTextId")}
            </label>
            <Input
              id="target"
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={t("textForm.leaveEmptyNA")}
            />

            {errors.target && (
              <p className="mt-1 text-sm text-red-600">{errors.target}</p>
            )}
          </div>
        )}

        {/* Titles Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 ">
              {t("textForm.title")} <span className="text-red-500">*</span> ({t("textForm.atLeastOneRequired")})
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
              {t("textForm.addTitle")}
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
                   
                  {isLoadingLanguageOptions && (
                    <div className="w-20 sm:w-32 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
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
                    className="w-fit sm:w-32 font-poppins h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">{t("textForm.selectLanguage")}</option>
                    {!isLoadingLanguageOptions && LANGUAGE_OPTIONS && LANGUAGE_OPTIONS.map((lang: LanguageOption) => (
                      <option key={lang.code} value={lang.code} className="capitalize">
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
                      
                      // Check if any titles remain with values
                      const hasRemainingTitle = newTitles.some(t => t.value.trim() !== "");
                      
                      // If no valid title remains, clear alternative titles
                      if (!hasRemainingTitle) {
                        setAltTitles([]);
                      }
                    }}
                    className="flex-1  min-w-0 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder={t("textForm.enterTitle")}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      const updatedTitles = titles.filter((_, i) => i !== index);
                      setTitles(updatedTitles);
                      
                      // Check if there are any remaining titles with values
                      const hasRemainingTitle = updatedTitles.some(t => t.value.trim() !== "");
                      
                      // If no valid title remains, clear alternative titles
                      if (!hasRemainingTitle) {
                        setAltTitles([]);
                      }
                    }}
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

        {/* Alternative Titles Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("textForm.alternativeTitle")}
            </label>
            <Button
              type="button"
              onClick={() => setAltTitles([...altTitles, [{ language: "", value: "" }]])}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              {t("textForm.addAlternativeTitle")}
            </Button>
          </div>

          {altTitles.map((titleGroup, groupIndex) => (
            <div
              key={groupIndex}
              className="border rounded-lg p-4 bg-purple-50 mb-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {t("textForm.alternativeTitle")} {groupIndex + 1}
                </span>
                <Button
                  type="button"
                  onClick={() => setAltTitles(altTitles.filter((_, i) => i !== groupIndex))}
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {titleGroup.map((title, langIndex) => (
                <div key={langIndex} className="flex gap-2 items-start mb-2">
                  <select
                    value={title.language}
                    onChange={(e) => {
                      const selectedLang = e.target.value;
                      
                      // Check if this language already exists in another entry within the same group
                      const existingIndex = altTitles[groupIndex].findIndex(
                        (t, i) => i !== langIndex && t.language === selectedLang
                      );
                      
                      if (existingIndex !== -1 && selectedLang) {
                        // Language exists in another entry within the group - merge/overwrite
                        const updated = [...altTitles];
                        updated[groupIndex] = updated[groupIndex].filter((_, i) => i !== existingIndex);
                        const adjustedLangIndex = langIndex > existingIndex ? langIndex - 1 : langIndex;
                        updated[groupIndex][adjustedLangIndex].language = selectedLang;
                        setAltTitles(updated);
                      } else {
                        // No conflict, just update normally
                        const updated = [...altTitles];
                        updated[groupIndex][langIndex].language = selectedLang;
                        setAltTitles(updated);
                      }
                    }}
                    className="w-20 sm:w-32 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  >
                    <option value="">{t("textForm.lang")}</option>
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
                      const updated = [...altTitles];
                      updated[groupIndex][langIndex].value = e.target.value;
                      
                      // Auto-detect language if not already set
                      if (!updated[groupIndex][langIndex].language && e.target.value.trim()) {
                        const detectedLang = detectLanguage(e.target.value);
                        if (detectedLang) {
                          updated[groupIndex][langIndex].language = detectedLang;
                        }
                      }
                      
                      setAltTitles(updated);
                    }}
                    className="flex-1 min-w-0 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder={t("textForm.enterAlternativeTitle")}
                  />
                  {titleGroup.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => {
                        const updated = [...altTitles];
                        updated[groupIndex] = updated[groupIndex].filter((_, i) => i !== langIndex);
                        setAltTitles(updated);
                      }}
                      variant="outline"
                      size="sm"
                      className="text-red-600 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                onClick={() => {
                  const updated = [...altTitles];
                  updated[groupIndex].push({ language: "", value: "" });
                  setAltTitles(updated);
                }}
                variant="outline"
                size="sm"
                className="mt-2 flex items-center gap-1 text-xs"
              >
                <Plus className="h-3 w-3" />
                {t("textForm.addLanguage")}
              </Button>
            </div>
          ))}
        </div>

        {/* Contributors Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("textForm.contributors")}
            </label>
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
                        {getPersonDisplayName(contributor.person!)}
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

          {errors.contributions && (
            <p className="mt-1 text-sm text-red-600">{errors.contributions}</p>
          )}

          {/* Add Contributor Form */}
          {showAddContributor && (
            <div className="p-4 border border-gray-300 rounded-md bg-gray-50 space-y-4">
                  {/* Person Search */}
                  <div className="relative flex gap-2" >
                  <RoleSelectionForm role={role} setRole={setRole} />
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
                             <BdrcPersonList  bdrcPersonResults={bdrcPersonResults} handlePersonSelect={handlePersonSelect} />
                            ) : debouncedPersonSearch.trim() ? (
                              <div className="px-4 py-2 text-gray-500 text-sm">
                              empty results
                              </div>
                            ) : null}
                          </>
                        )}

                       
                      </div>
                    )}

                
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
                  {t("textForm.add")}
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
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Optional Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 " >
          <div className="hidden">
            <label
              htmlFor="date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("textForm.date")}
            </label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div >
            <label
              htmlFor="bdrc"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("textForm.bdrcWorkId")}
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
                  <span className="text-xs text-blue-600">{t("textForm.clickToChange")}</span>
                </div>
              ) : (
                // Search input
                <>
                  <Input
                    id="bdrc"
                    type="text"
                    value={bdrcSearch}
                    onChange={(e) => {
                      setBdrcSearch(e.target.value);
                      setShowBdrcDropdown(true);
                    }}
                   
                    placeholder={t("textForm.searchBdrcEntries")}
                  />
                  {/* BDRC Dropdown */}
                  {showBdrcDropdown && bdrcSearch.trim() && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {bdrcLoading ? (
                        <div className="px-4 py-8 flex flex-col items-center justify-center">
                          <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                          <div className="text-sm text-gray-500">{t("textForm.searching")}</div>
                        </div>
                      ) : bdrcResults.length > 0 ? (
                        bdrcResults
                          .filter((result) => result.title && result.title !== " - no data - ")
                          .map((result, index) => (
                            <button
                              key={`${result.workId}-${index}`}
                              type="button"
                              onClick={async () => {
                                const workId = result.workId || '';
                                const label = result.title || '';
                                
                                // Show loading state
                                setIsCheckingBdrcId(true);
                                setShowBdrcDropdown(false);
                                
                                // Check if this BDRC ID already exists
                                try {
                                  const existingText = await fetchTextByBdrcId(workId);
                                  
                                  if (existingText) {
                                    // Text already exists - show confirmation dialog
                                    setConflictingText(existingText);
                                    setPendingBdrcSelection({ id: workId, label });
                                    setShowBdrcConflictDialog(true);
                                  } else {
                                    // No conflict - proceed normally
                                    setSelectedBdrc({
                                      id: workId,
                                      label: label,
                                    });
                                    setBdrc(workId);
                                  }
                                } catch (error) {
                                  // Error checking - proceed with selection
                                  console.error('Error checking BDRC ID:', error);
                                  setSelectedBdrc({
                                    id: workId,
                                    label: label,
                                  });
                                  setBdrc(workId);
                                } finally {
                                  setIsCheckingBdrcId(false);
                                }
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100"
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {result.title}
                              </div>
                              <div className="text-xs text-gray-500">{result.workId}</div>
                            </button>
                          ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          {t("textForm.noBdrcEntries")}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Category Selector */}
        <div>
          <MultilevelCategorySelector
            onCategorySelect={(id) => {
              setCategoryId(id);
              if (id.trim()) {
                setCategoryError(false);
              }
            }}
            selectedCategoryId={categoryId}
            error={categoryError}
          />
          {categoryError && (
            <p className="mt-1 text-sm text-red-600">
              {t("textForm.selectCategory")}
            </p>
          )}
        </div>

        {/* Copyright and License Fields */}
        <Copyright
          copyright={copyright}
          setCopyright={setCopyright}
          license={license}
          setLicense={setLicense}
          copyrightLabelKey="textForm.copyright"
          licenseLabelKey="textForm.license"
          required={false}
        />

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

        {/* BDRC Checking Loading Overlay */}
        {isCheckingBdrcId && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 w-full h-full overflow-hidden">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center">
                {/* Animated Icon */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full opacity-20 animate-ping"></div>
                  </div>
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl shadow-2xl flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  </div>
                </div>

                {/* Loading Text */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {t("textForm.checkingBdrcId")}
                </h3>
                <p className="text-sm text-gray-600">
                  {t("textForm.verifyingText")}
                </p>

                {/* Progress Bar */}
                <div className="relative w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BDRC Conflict Dialog */}
        {showBdrcConflictDialog && conflictingText && pendingBdrcSelection && (
          <div className="absolute inset-0  bg-black/30 bg-opacity-50 flex  justify-center z-50 p-4 w-full  h-full  overflow-hidden">
            <div className="bg-white mt-[200px] rounded-lg shadow-xl max-w-md w-full h-fit p-6 animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {t("textForm.textAlreadyExists")}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t("textForm.bdrcAlreadyAssociated")}
                  </p>
                </div>
              </div>

              {/* Existing Text Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="text-sm font-medium text-blue-900 mb-2">
                  {t("textForm.existingText")}
                </div>
                <div className="space-y-1 text-sm text-gray-700">
                  <div>
                    <strong>{t("textForm.bdrcId")}:</strong> {pendingBdrcSelection.id}
                  </div>
                  <div>
                    <strong>{t("text.textTitle")}:</strong>{" "}
                    {conflictingText.title.bo ||
                      conflictingText.title.en ||
                      Object.values(conflictingText.title)[0] ||
                      "Untitled"}
                  </div>
                  <div>
                    <strong>{t("textForm.type")}:</strong> {conflictingText.type}
                  </div>
                  <div>
                    <strong>{t("textForm.language")}:</strong> {conflictingText.language}
                  </div>
                </div>
              </div>

              {/* Question */}
              <p className="text-sm text-gray-700 mb-6">
                {t("textForm.useExistingQuestion")}
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    // User wants to choose another - clear the selection
                    setBdrcSearch("");
                    setSelectedBdrc(null);
                    setBdrc("");
                    setShowBdrcConflictDialog(false);
                    setConflictingText(null);
                    setPendingBdrcSelection(null);
                    setShowBdrcDropdown(true);
                  }}
                >
                  {t("textForm.chooseAnother")}
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    // User wants to use existing text
                    if (onExistingTextFound && conflictingText) {
                      onExistingTextFound(conflictingText);
                    }
                    setShowBdrcConflictDialog(false);
                    setConflictingText(null);
                    setPendingBdrcSelection(null);
                  }}
                >
                  {t("textForm.useExistingText")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

TextCreationForm.displayName = "TextCreationForm";

export default TextCreationForm;




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

function handleClick(result: { bdrc_id?: string; name?: string }){
    handlePersonClick(result)
}

  return (
    <div className="z-50">
      {bdrcPersonResults.map((result) => (
        <button
          key={result.bdrc_id}
          type="button"
          onClick={() => handleClick(result)}
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
