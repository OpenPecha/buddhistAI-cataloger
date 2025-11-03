import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useNavigate } from "react-router-dom";
import { usePersons } from "@/hooks/usePersons";
import type { Person } from "@/types/person";
import { Button } from "@/components/ui/button";
import { X, Plus, User, Bot } from "lucide-react";

interface TextCreationFormProps {
  onDataChange?: (textData: any) => void;
  getFormData?: () => any;
}

export interface TextCreationFormRef {
  addTitle: (text: string, language?: string) => void;
}

type ContributorType = "human" | "ai";

interface HumanContributor {
  type: "human";
  person?: Person;
  role: "translator" | "reviser" | "author" | "scholar";
}

interface AIContributor {
  type: "ai";
  ai_id: string;
  role: "translator" | "reviser" | "author" | "scholar";
}

type Contributor = HumanContributor | AIContributor;

interface TitleEntry {
  language: string;
  value: string;
}

const TextCreationForm = forwardRef<TextCreationFormRef, TextCreationFormProps>(
  ({ onDataChange }, ref) => {
    const navigate = useNavigate();

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      addTitle: (text: string, language?: string) => {
        setTitles([...titles, { language: language || "", value: text }]);
      },
    }));

    const [selectedType, setSelectedType] = useState<
      "root" | "commentary" | "translation" | ""
    >("");
    const [titles, setTitles] = useState<TitleEntry[]>([]);
    const [language, setLanguage] = useState("");
    const [parent, setParent] = useState("");
    const [date, setDate] = useState("");
    const [bdrc, setBdrc] = useState("");
    const [wiki, setWiki] = useState("");

    // Contributor management
    const [contributors, setContributors] = useState<Contributor[]>([]);
    const [showAddContributor, setShowAddContributor] = useState(false);
    const [contributorType, setContributorType] =
      useState<ContributorType>("human");

    // Human contributor fields
    const [personSearch, setPersonSearch] = useState("");
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [showPersonDropdown, setShowPersonDropdown] = useState(false);
    const [debouncedPersonSearch, setDebouncedPersonSearch] = useState("");
    const [humanRole, setHumanRole] = useState<
      "translator" | "reviser" | "author" | "scholar"
    >("author");

    // AI contributor fields
    const [aiId, setAiId] = useState("");
    const [aiRole, setAiRole] = useState<
      "translator" | "reviser" | "author" | "scholar"
    >("translator");

    // Validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Reset contributor type to human when root type is selected
    useEffect(() => {
      if (selectedType === "root") {
        setContributorType("human");
      }
    }, [selectedType]);

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

      if (contributorType === "human") {
        if (!selectedPerson) {
          newErrors.contributor = "Please select a person";
          setErrors(newErrors);
          return;
        }

        const newContributor: HumanContributor = {
          type: "human",
          person: selectedPerson,
          role: humanRole,
        };

        setContributors([...contributors, newContributor]);
      } else {
        if (!aiId.trim()) {
          newErrors.contributor = "Please enter an AI model ID";
          setErrors(newErrors);
          return;
        }

        const newContributor: AIContributor = {
          type: "ai",
          ai_id: aiId.trim(),
          role: aiRole,
        };

        setContributors([...contributors, newContributor]);
      }

      // Reset form
      setShowAddContributor(false);
      setSelectedPerson(null);
      setPersonSearch("");
      setAiId("");
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

      // Build title object from titles array
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
        if (contributor.type === "human") {
          // Always use person_id
          return {
            person_id: contributor.person!.id,
            role: contributor.role,
          };
        } else {
          return {
            ai_id: contributor.ai_id,
            role: contributor.role,
          };
        }
      });

      // Build final payload
      const textData: any = {
        type: selectedType,
        title,
        language: language.trim(),
        contributions:
          contributionsArray.length > 0 ? contributionsArray : undefined,
      };

      // Add parent for commentary/translation
      if (selectedType === "commentary" || selectedType === "translation") {
        textData.parent = parent.trim() || "N/A";
      }

      // Add optional fields
      if (date.trim()) textData.date = date.trim();
      if (bdrc.trim()) textData.bdrc = bdrc.trim();
      if (wiki.trim()) textData.wiki = wiki.trim();

      return textData;
    }, [
      selectedType,
      titles,
      language,
      parent,
      contributors,
      date,
      bdrc,
      wiki,
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
      parent,
      contributors,
      date,
      bdrc,
      wiki,
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
              <option value="bo">Tibetan (bo)</option>
              <option value="en">English (en)</option>
              <option value="sa">Sanskrit (sa)</option>
              <option value="zh">Chinese (zh)</option>
              <option value="lzh">Literary Chinese (lzh)</option>
              <option value="hi">Hindi (hi)</option>
              <option value="it">Italian (it)</option>
              <option value="cmg">Classical Mongolian (cmg)</option>
            </select>
            {errors.language && (
              <p className="mt-1 text-sm text-red-600">{errors.language}</p>
            )}
          </div>
        </div>

        {/* Parent field - only for commentary/translation */}
        {(selectedType === "commentary" || selectedType === "translation") && (
          <div>
            <label
              htmlFor="parent"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Parent Text ID
            </label>
            <input
              id="parent"
              type="text"
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Leave empty for N/A"
            />

            {errors.parent && (
              <p className="mt-1 text-sm text-red-600">{errors.parent}</p>
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
                      const newTitles = [...titles];
                      newTitles[index].language = e.target.value;
                      setTitles(newTitles);
                    }}
                    className="w-20 sm:w-32 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Lang</option>
                    <option value="bo">bo</option>
                    <option value="en">en</option>
                    <option value="sa">sa</option>
                    <option value="zh">zh</option>
                    <option value="lzh">lzh</option>
                    <option value="hi">hi</option>
                    <option value="it">it</option>
                    <option value="cmg">cmg</option>
                  </select>
                  <input
                    type="text"
                    value={title.value}
                    onChange={(e) => {
                      const newTitles = [...titles];
                      newTitles[index].value = e.target.value;
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
                    {contributor.type === "human" ? (
                      <User className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Bot className="h-5 w-5 text-purple-600" />
                    )}
                    <div>
                      {contributor.type === "human" ? (
                        <>
                          <div className="font-medium">
                            {getPersonDisplayName(contributor.person!)}
                          </div>
                          <div className="text-sm text-gray-500">
                            Person ID: {contributor.person!.id} • Role:{" "}
                            {contributor.role}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-medium">
                            AI: {contributor.ai_id}
                          </div>
                          <div className="text-sm text-gray-500">
                            Role: {contributor.role}
                          </div>
                        </>
                      )}
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
              {/* Contributor Type Toggle - Hide AI option for root type */}
              {selectedType !== "root" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contributor Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setContributorType("human")}
                      className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 ${
                        contributorType === "human"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-700 border border-gray-300"
                      }`}
                    >
                      <User className="h-4 w-4" />
                      Human
                    </button>
                    <button
                      type="button"
                      onClick={() => setContributorType("ai")}
                      className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 ${
                        contributorType === "ai"
                          ? "bg-purple-600 text-white"
                          : "bg-white text-gray-700 border border-gray-300"
                      }`}
                    >
                      <Bot className="h-4 w-4" />
                      AI
                    </button>
                  </div>
                </div>
              )}

              {contributorType === "human" ? (
                <>
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
                          onClick={() => navigate("/persons")}
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
                                <div className="text-sm text-gray-500">
                                  {person.id}
                                </div>
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
                        <div className="text-blue-500 text-xs mt-1">
                          ID: {selectedPerson.id}
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
                      value={humanRole}
                      onChange={(e) => setHumanRole(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="author">Author</option>
                      <option value="translator">Translator</option>
                      <option value="reviser">Reviser</option>
                      <option value="scholar">Scholar</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* AI ID Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      AI Model ID
                    </label>
                    <input
                      type="text"
                      value={aiId}
                      onChange={(e) => setAiId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., gpt-4, claude-3, llm-01"
                    />
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      value={aiRole}
                      onChange={(e) => setAiRole(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="translator">Translator</option>
                      <option value="reviser">Reviser</option>
                      <option value="author">Author</option>
                      <option value="scholar">Scholar</option>
                    </select>
                  </div>
                </>
              )}

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              BDRC ID
            </label>
            <input
              id="bdrc"
              type="text"
              value={bdrc}
              onChange={(e) => setBdrc(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., W123456"
            />
          </div>

          <div>
            <label
              htmlFor="wiki"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Wiki
            </label>
            <input
              id="wiki"
              type="text"
              value={wiki}
              onChange={(e) => setWiki(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Wiki reference"
            />
          </div>
        </div>
      </div>
    );
  }
);

TextCreationForm.displayName = "TextCreationForm";

export default TextCreationForm;
