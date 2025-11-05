import { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, Check, XCircle, Loader2 } from "lucide-react";

interface InstanceCreationFormProps {
  onSubmit: (instanceData: any) => void;
  isSubmitting: boolean;
  onCancel?: () => void;
}

export interface InstanceCreationFormRef {
  addColophon: (text: string) => void;
  addIncipit: (text: string, language?: string) => void;
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

const InstanceCreationForm = forwardRef<
  InstanceCreationFormRef,
  InstanceCreationFormProps
>(({ onSubmit, isSubmitting, onCancel }, ref) => {
  // State declarations
  const [type, setType] = useState<"diplomatic" | "critical">(
    "diplomatic"
  );
  const [copyright, setCopyright] = useState("public");
  const [bdrc, setBdrc] = useState("");
  const [bdrcValidationStatus, setBdrcValidationStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [wiki, setWiki] = useState("");
  const [colophon, setColophon] = useState("");

  // Incipit title management
  const [showIncipitTitle, setShowIncipitTitle] = useState(false);
  const [incipitTitles, setIncipitTitles] = useState<TitleEntry[]>([]);

  // Alternative incipit titles management
  const [altIncipitTitles, setAltIncipitTitles] = useState<TitleEntry[][]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Clear BDRC ID when switching to critical type
  useEffect(() => {
    if (type === "critical" && bdrc) {
      setBdrc("");
      setBdrcValidationStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // BDRC ID validation with debounce
  useEffect(() => {
    if (!bdrc.trim()) {
      setBdrcValidationStatus("idle");
      return;
    }

    // Set to validating immediately when user types
    setBdrcValidationStatus("validating");

    // Debounce API call
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("https://autocomplete.bdrc.io/autosuggest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: bdrc.trim() }),
        });

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          setBdrcValidationStatus("valid");
        } else {
          setBdrcValidationStatus("invalid");
        }
      } catch (error) {
        console.error("Error validating BDRC ID:", error);
        setBdrcValidationStatus("invalid");
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [bdrc]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    addColophon: (text: string) => {
      setColophon(text);
    },
    addIncipit: (text: string, language?: string) => {
      setShowIncipitTitle(true);
      
      // Check if the detected language is in the LANGUAGE_OPTIONS array
      const isValidLanguage = language && LANGUAGE_OPTIONS.some(
        (option) => option.code === language
      );
      
      // Only set the language if it's found in the options, otherwise leave it empty
      setIncipitTitles([
        ...incipitTitles,
        { language: isValidLanguage ? language : "", value: text },
      ]);
    },
  }));

  // Helper functions for incipit titles
  const addIncipitTitle = () => {
    setShowIncipitTitle(true);
    if (incipitTitles.length === 0) {
      setIncipitTitles([{ language: "", value: "" }]);
    }
  };

  const removeIncipitTitleSection = () => {
    setShowIncipitTitle(false);
    setIncipitTitles([]);
    setAltIncipitTitles([]); // Also remove alternatives
  };

  const addIncipitLanguage = () => {
    setIncipitTitles([...incipitTitles, { language: "", value: "" }]);
  };

  const updateIncipitTitle = (
    index: number,
    field: "language" | "value",
    value: string
  ) => {
    const updated = [...incipitTitles];
    updated[index][field] = value;
    setIncipitTitles(updated);
  };

  const removeIncipitLanguage = (index: number) => {
    setIncipitTitles(incipitTitles.filter((_, i) => i !== index));
  };

  // Helper functions for alternative incipit titles
  const addAltIncipitTitle = () => {
    setAltIncipitTitles([...altIncipitTitles, [{ language: "", value: "" }]]);
  };

  const removeAltIncipitTitle = (groupIndex: number) => {
    setAltIncipitTitles(altIncipitTitles.filter((_, i) => i !== groupIndex));
  };

  const addAltLanguage = (groupIndex: number) => {
    const updated = [...altIncipitTitles];
    updated[groupIndex].push({ language: "", value: "" });
    setAltIncipitTitles(updated);
  };

  const updateAltTitle = (
    groupIndex: number,
    langIndex: number,
    field: "language" | "value",
    value: string
  ) => {
    const updated = [...altIncipitTitles];
    updated[groupIndex][langIndex][field] = value;
    setAltIncipitTitles(updated);
  };

  const removeAltLanguage = (groupIndex: number, langIndex: number) => {
    const updated = [...altIncipitTitles];
    updated[groupIndex] = updated[groupIndex].filter((_, i) => i !== langIndex);
    setAltIncipitTitles(updated);
  };

  // Data cleaning function
  const cleanFormData = () => {
    const cleaned: any = {
      metadata: {
        type: type,
      },
    };

    // Add optional metadata fields only if non-empty
    if (copyright) {
      cleaned.metadata.copyright = copyright;
    }

    if (bdrc?.trim()) {
      cleaned.metadata.bdrc = bdrc.trim();
    }

    if (wiki?.trim()) {
      cleaned.metadata.wiki = wiki.trim();
    }

    if (colophon?.trim()) {
      cleaned.metadata.colophon = colophon.trim();
    }

    // Build incipit_title only if has non-empty values
    const incipitTitle: Record<string, string> = {};
    incipitTitles.forEach(({ language, value }) => {
      if (language && value.trim()) {
        incipitTitle[language] = value.trim();
      }
    });
    if (Object.keys(incipitTitle).length > 0) {
      cleaned.metadata.incipit_title = incipitTitle;
    }

    // Build alt_incipit_titles only if incipit_title exists
    if (cleaned.metadata.incipit_title && altIncipitTitles.length > 0) {
      const altTitles = altIncipitTitles
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

      if (altTitles.length > 0) {
        cleaned.metadata.alt_incipit_titles = altTitles;
      }
    }

    return cleaned;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate required fields
    if (!type) {
      setErrors({ type: "Type is required" });
      return;
    }

    // Validate BDRC ID for diplomatic type
    if (type === "diplomatic" && !bdrc?.trim()) {
      setErrors({ bdrc: "BDRC ID is required when type is Diplomatic" });
      return;
    }

    // Validate alt_incipit_titles requires incipit_title
    const hasIncipitTitle = incipitTitles.some(
      (t) => t.language && t.value.trim()
    );
    const hasAltTitles = altIncipitTitles.some((group) =>
      group.some((t) => t.language && t.value.trim())
    );

    if (hasAltTitles && !hasIncipitTitle) {
      setErrors({
        alt_incipit_titles:
          "Alternative incipit titles can only be set when incipit title is also provided",
      });
      return;
    }

    const cleanedData = cleanFormData();
    onSubmit(cleanedData);
  };

  const hasIncipitTitle = incipitTitles.some(
    (t) => t.language && t.value.trim()
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Metadata Section */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Metadata</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Type */}
          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="diplomatic">Diplomatic</option>
              <option value="critical">Critical</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type}</p>
            )}
          </div>

          {/* Copyright */}
          <div>
            <label
              htmlFor="copyright"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Copyright
            </label>
            <select
              id="copyright"
              value={copyright}
              onChange={(e) => setCopyright(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="public">Public</option>
              <option value="copyrighted">Copyrighted</option>
            </select>
          </div>

          {/* BDRC ID - Only shown for diplomatic type */}
          {type === "diplomatic" && (
            <div>
              <label
                htmlFor="bdrc"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                BDRC ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="bdrc"
                  type="text"
                  value={bdrc}
                  onChange={(e) => setBdrc(e.target.value)}
                  onBlur={() => {
                    // Clear the field if invalid when user leaves the input
                    if (bdrcValidationStatus === "invalid") {
                      setBdrc("");
                      setBdrcValidationStatus("idle");
                    }
                  }}
                  required
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., MW23703_4010"
                />
                {/* Validation Icons */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                  {bdrcValidationStatus === "validating" && (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  )}
                  {bdrcValidationStatus === "valid" && (
                    <Check className="w-5 h-5 text-green-600" />
                  )}
                  {bdrcValidationStatus === "invalid" && (
                    <button
                      type="button"
                      onClick={() => {
                        setBdrc("");
                        setBdrcValidationStatus("idle");
                      }}
                      className="hover:opacity-70 transition-opacity"
                      title="Clear BDRC ID"
                    >
                      <XCircle className="w-5 h-5 text-red-600" />
                    </button>
                  )}
                </div>
              </div>
              {errors.bdrc && (
                <p className="mt-1 text-sm text-red-600">{errors.bdrc}</p>
              )}
            </div>
          )}

          {/* Wiki */}
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

          {/* Colophon */}
          <div className="md:col-span-2">
            <label
              htmlFor="colophon"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Colophon
            </label>
            <input
              id="colophon"
              type="text"
              value={colophon}
              onChange={(e) => setColophon(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Colophon text"
            />
          </div>
        </div>

        {/* Incipit Title Section */}
        <div className="mt-4">
          {!showIncipitTitle ? (
            <Button
              type="button"
              onClick={addIncipitTitle}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Incipit Title
            </Button>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Incipit Title
                </label>
                <Button
                  type="button"
                  onClick={removeIncipitTitleSection}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 mb-4">
                {incipitTitles.map((title, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-start p-3 bg-gray-50 border border-gray-200 rounded-md"
                  >
                    <select
                      value={title.language}
                      onChange={(e) =>
                        updateIncipitTitle(index, "language", e.target.value)
                      }
                      className="w-20 sm:w-32 px-2 sm:px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                      onChange={(e) =>
                        updateIncipitTitle(index, "value", e.target.value)
                      }
                      className="flex-1 min-w-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Enter incipit title"
                    />
                    <Button
                      type="button"
                      onClick={() => removeIncipitLanguage(index)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                onClick={addIncipitLanguage}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Language
              </Button>
            </div>
          )}
        </div>

        {/* Alternative Incipit Titles Section */}
        {hasIncipitTitle && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Alternative Incipit Titles
              </label>
              <Button
                type="button"
                onClick={addAltIncipitTitle}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Alternative Title
              </Button>
            </div>

            {altIncipitTitles.map((titleGroup, groupIndex) => (
              <div
                key={groupIndex}
                className="border rounded-lg p-4 bg-blue-50 mb-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Alternative {groupIndex + 1}
                  </span>
                  <Button
                    type="button"
                    onClick={() => removeAltIncipitTitle(groupIndex)}
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
                      onChange={(e) =>
                        updateAltTitle(
                          groupIndex,
                          langIndex,
                          "language",
                          e.target.value
                        )
                      }
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      onChange={(e) =>
                        updateAltTitle(
                          groupIndex,
                          langIndex,
                          "value",
                          e.target.value
                        )
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter alternative title"
                    />
                    {titleGroup.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeAltLanguage(groupIndex, langIndex)}
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  onClick={() => addAltLanguage(groupIndex)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 mt-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Language
                </Button>
              </div>
            ))}

            {errors.alt_incipit_titles && (
              <p className="mt-1 text-sm text-red-600">
                {errors.alt_incipit_titles}
              </p>
            )}
          </div>
        )}
      </div>


      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Creating...
            </>
          ) : (
            "Create"
          )}
        </Button>
      </div>
    </form>
  );
});

InstanceCreationForm.displayName = "InstanceCreationForm";

export default InstanceCreationForm;
