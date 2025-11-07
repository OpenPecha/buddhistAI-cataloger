import { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, Check, XCircle, Loader2, Eye, Copy } from "lucide-react";
import { calculateAnnotations } from "@/utils/annotationCalculator";
import { useBdrcValidation } from "@/hooks/useBdrcValidation";

interface InstanceCreationFormProps {
  onSubmit: (instanceData: any) => void;
  isSubmitting: boolean;
  onCancel?: () => void;
  content?: string; // Content from editor for annotation calculation
  isCreatingNewText?: boolean; // Whether we're creating a new text or adding instance to existing text
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
>(({ onSubmit, isSubmitting, onCancel, content = "", isCreatingNewText = false }, ref) => {
  // State declarations
  const [type, setType] = useState<"diplomatic" | "critical">(
    "diplomatic"
  );
  const [copyright, setCopyright] = useState("public");
  const [bdrc, setBdrc] = useState("");
  const [wiki, setWiki] = useState("");
  const [colophon, setColophon] = useState("");

  // Incipit title management
  const [showIncipitTitle, setShowIncipitTitle] = useState(false);
  const [incipitTitles, setIncipitTitles] = useState<TitleEntry[]>([]);

  // Alternative incipit titles management
  const [altIncipitTitles, setAltIncipitTitles] = useState<TitleEntry[][]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [showContentPreview, setShowContentPreview] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // BDRC validation hook
  const { validationStatus: bdrcValidationStatus, resetValidation: resetBdrcValidation } = useBdrcValidation(bdrc);

  // Clear BDRC ID when switching to critical type
  useEffect(() => {
    if (type === "critical" && bdrc) {
      setBdrc("");
      resetBdrcValidation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

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

    // Add content and calculate annotations
    if (content) {
      const { annotations, cleanedContent } = calculateAnnotations(content);
      cleaned.content = cleanedContent; // Content without newlines
      
      // Add reference field for diplomatic type only
      if (type === "diplomatic") {
        cleaned.annotation = annotations.map(ann => ({
          ...ann,
          reference: "temp"
        }));
      } else {
        // Critical type - no reference field
        cleaned.annotation = annotations;
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

    // Validate content is not empty
    if (!content || content.trim().length === 0) {
      setErrors({ content: "Content is required. Please upload and edit a text file first." });
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
                      resetBdrcValidation();
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
                        resetBdrcValidation();
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


      {/* Content validation error */}
      {errors.content && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-center">
          <p className="text-sm font-medium">{errors.content}</p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-center space-x-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setShowContentPreview(true)}
          className="flex items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          Preview Content
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setShowPreview(true)}
          className="flex items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          Preview JSON
        </Button>
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

      {/* JSON Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Request Preview</h3>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setCopySuccess(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body - Scrollable JSON */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isCreatingNewText && (
                <>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">1. Text Metadata (POST /text)</h4>
                    {(() => {
                      try {
                        const textData = (window as any).__getTextFormData?.();
                        return (
                          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                            {JSON.stringify(textData || {}, null, 2)}
                          </pre>
                        );
                      } catch (error: any) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                            <p className="text-sm text-yellow-800">
                              <strong>Form incomplete:</strong> {error.message}
                            </p>
                            <p className="text-xs text-yellow-600 mt-2">
                              Please fill out all required fields in the Text Information form above.
                            </p>
                          </div>
                        );
                      }
                    })()}
                  </div>
                  <div className="border-t border-gray-300 pt-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">2. Instance Data (POST /text/{"{text_id}"}/instances)</h4>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                      {JSON.stringify(cleanFormData(), null, 2)}
                    </pre>
                  </div>
                </>
              )}
              {!isCreatingNewText && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Instance Data (POST /text/{"{text_id}"}/instances)</h4>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                    {JSON.stringify(cleanFormData(), null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              {copySuccess && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  Copied!
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  try {
                    let dataToCopy;
                    if (isCreatingNewText) {
                      const textData = (window as any).__getTextFormData?.() || {};
                      const instanceData = cleanFormData();
                      dataToCopy = JSON.stringify({
                        textData,
                        instanceData
                      }, null, 2);
                    } else {
                      dataToCopy = JSON.stringify(cleanFormData(), null, 2);
                    }
                    navigator.clipboard.writeText(dataToCopy);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  } catch (error) {
                    // If text form is incomplete, copy only the instance data
                    const dataToCopy = JSON.stringify(cleanFormData(), null, 2);
                    navigator.clipboard.writeText(dataToCopy);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }
                }}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy JSON
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowPreview(false);
                  setCopySuccess(false);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content Preview Modal */}
      {showContentPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Content Preview</h3>
              <button
                onClick={() => setShowContentPreview(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {(() => {
                if (!content || content.trim().length === 0) {
                  return (
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        No content available. Please add text in the editor.
                      </p>
                    </div>
                  );
                }

                // Calculate annotations to get cleaned content and spans
                const { annotations, cleanedContent } = calculateAnnotations(content);

                return (
                  <>
                    {/* Cleaned Content Section */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">
                        Cleaned Content (sent to backend)
                      </h4>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Character Count:</strong> {cleanedContent.length} characters
                        </p>
                        <div className="bg-white border border-gray-300 rounded p-3 max-h-60 overflow-y-auto">
                          <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                            {cleanedContent || "(empty)"}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Annotations Section */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">
                        Annotations ({annotations.length} spans)
                      </h4>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-3">
                          Each line with content gets a span annotation:
                        </p>
                        <div className="bg-white border border-gray-300 rounded p-3 max-h-60 overflow-y-auto">
                          <pre className="text-sm font-mono">
                            {JSON.stringify(annotations, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                      <h5 className="font-semibold text-blue-900 mb-2 text-sm">Processing Rules:</h5>
                      <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Empty lines are removed (no span created)</li>
                        <li>Lines with spaces are kept (span created)</li>
                        <li>Trailing empty lines are trimmed</li>
                        <li>All newline characters are removed from content</li>
                        <li>Each span references positions in the cleaned content</li>
                      </ul>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowContentPreview(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
});

InstanceCreationForm.displayName = "InstanceCreationForm";

export default InstanceCreationForm;
