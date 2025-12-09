import { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Plus, X, Loader2, AlertTriangle } from "lucide-react";
import { calculateAnnotations } from "@/utils/annotationCalculator";
import { useBdrcSearch } from "@/hooks/useBdrcSearch";
import { useBibliographyAPI } from "@/hooks/useBibliographyAPI";
import { useTranslation } from "react-i18next";
import FormsubmitSection from "./FormsubmitSection";
import SourceSelection from "./formComponent/SourceSelection";
import { Input } from "./ui/input";

interface InstanceData {
  metadata: {
    type: string;
    source: string;
    colophon?: string;
    incipit_title?: Record<string, string>;
    alt_incipit_titles?: Record<string, string>[];
    bdrc?: string;
    wiki?: string | null;
  };
  annotation?: Array<{
    span: { start: number; end: number };
    reference?: string;
  }>;
  biblography_annotation?: Array<{
    span: { start: number; end: number };
    type: string;
  }>;
  content?: string;
}

interface InstanceCreationFormProps {
  onSubmit: (instanceData: InstanceData) => void;
  isSubmitting: boolean;
  onCancel?: () => void;
  content?: string; // Content from editor for annotation calculation
  disableSubmit?: boolean; // Additional condition to disable submit button
}

export interface InstanceCreationFormRef {
  addColophon: (text: string) => void;
  addIncipit: (text: string, language?: string) => void;
  addAltIncipit: (text: string, language?: string) => void;
  hasIncipit: () => boolean;
  getFormData: () => InstanceData | null;
  initializeForm?: (data: {
    type?: string;
    source?: string;
    bdrc?: string;
    wiki?: string;
    colophon?: string;
  }) => void;
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
>(({ onSubmit, isSubmitting, onCancel, content = "", disableSubmit = false }, ref) => {
  const { t } = useTranslation();
  
  // State declarations
  const [type, setType] = useState<"diplomatic" | "critical">(
    "critical"
  );
  const [source, setSource] = useState("");
  const [bdrc, setBdrc] = useState("");
  const [wiki, setWiki] = useState("");
  const [colophon, setColophon] = useState("");

  // BDRC search state
  const [bdrcSearch, setBdrcSearch] = useState("");
  const [showBdrcDropdown, setShowBdrcDropdown] = useState(false);
  const [selectedBdrc, setSelectedBdrc] = useState<{ id: string; label: string } | null>(null);

  // Incipit title management
  const [showIncipitTitle, setShowIncipitTitle] = useState(false);
  const [incipitTitles, setIncipitTitles] = useState<TitleEntry[]>([]);

  // Alternative incipit titles management
  const [altIncipitTitles, setAltIncipitTitles] = useState<TitleEntry[][]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // BDRC search hook
  const { results: bdrcResults, isLoading: bdrcLoading } = useBdrcSearch(bdrcSearch);

  // Bibliography annotations hook
  const { getAPIAnnotations, hasAnnotations } = useBibliographyAPI();

  // Clear BDRC ID when switching to critical type
  useEffect(() => {
    if (type === "critical" && bdrc) {
      setBdrc("");
      setSelectedBdrc(null);
      setBdrcSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showConfirmModal) {
        setShowConfirmModal(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showConfirmModal]);

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
      
      const detectedLang = isValidLanguage ? language : "";
      
      // Check if this language already exists in incipitTitles
      const existingIndex = incipitTitles.findIndex(
        (t) => t.language === detectedLang && detectedLang !== ""
      );
      
      if (existingIndex !== -1 && detectedLang) {
        // Language exists - update the existing entry
        const updated = [...incipitTitles];
        updated[existingIndex].value = text;
        setIncipitTitles(updated);
      } else {
        // Language doesn't exist or is empty - add new entry
        setIncipitTitles([
          ...incipitTitles,
          { language: detectedLang, value: text },
        ]);
      }
    },
    addAltIncipit: (text: string, language?: string) => {
      setShowIncipitTitle(true); // Ensure incipit section is visible
      
      // Check if the detected language is in the LANGUAGE_OPTIONS array
      const isValidLanguage = language && LANGUAGE_OPTIONS.some(
        (option) => option.code === language
      );
      
      const detectedLang = isValidLanguage ? language : "";
      
      // Check if this language already exists in any alternative incipit group
      let foundInGroup = false;
      let groupIndex = -1;
      let langIndex = -1;
      
      if (detectedLang) {
        for (let i = 0; i < altIncipitTitles.length; i++) {
          const idx = altIncipitTitles[i].findIndex((t) => t.language === detectedLang);
          if (idx !== -1) {
            foundInGroup = true;
            groupIndex = i;
            langIndex = idx;
            break;
          }
        }
      }
      
      if (foundInGroup && detectedLang) {
        // Language exists in an alternative group - update that entry
        const updated = [...altIncipitTitles];
        updated[groupIndex][langIndex].value = text;
        setAltIncipitTitles(updated);
      } else {
        // Language doesn't exist - add a new alternative incipit title group
        const newAltGroup = [{ 
          language: detectedLang, 
          value: text 
        }];
        setAltIncipitTitles([...altIncipitTitles, newAltGroup]);
      }
    },
    hasIncipit: () => {
      // Check if incipit section is shown and has at least one entry with a value
      return showIncipitTitle && incipitTitles.length > 0 && incipitTitles.some(t => t.value.trim() !== "");
    },
    getFormData: () => {
      // Return null if content is empty (form not ready)
      if (!content || content.trim().length === 0) {
        return null;
      }
      return cleanFormData();
    },
    initializeForm: (data: {
      type?: string;
      source?: string;
      bdrc?: string;
      wiki?: string;
      colophon?: string;
    }) => {
      if (data.type) setType(data.type as "diplomatic" | "critical");
      if (data.source) setSource(data.source);
      if (data.bdrc) {
        setBdrc(data.bdrc);
        setSelectedBdrc({ id: data.bdrc, label: data.bdrc });
      }
      if (data.wiki) setWiki(data.wiki);
      if (data.colophon) setColophon(data.colophon);
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
    
    // If value field is being cleared, check if any incipit titles remain
    if (field === "value") {
      const hasRemainingIncipit = updated.some(t => t.value.trim() !== "");
      
      // If no valid incipit remains, clear alternative incipit titles
      if (!hasRemainingIncipit) {
        setAltIncipitTitles([]);
      }
    }
  };

  const removeIncipitLanguage = (index: number) => {
    const updatedTitles = incipitTitles.filter((_, i) => i !== index);
    setIncipitTitles(updatedTitles);
    
    // Check if there are any remaining incipit titles with values
    const hasRemainingIncipit = updatedTitles.some(t => t.value.trim() !== "");
    
    // If no valid incipit remains, clear alternative incipit titles
    if (!hasRemainingIncipit) {
      setAltIncipitTitles([]);
    }
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
  const cleanFormData = (): InstanceData => {
    const cleaned: InstanceData = {
      metadata: {
        type: type,
        source: source.trim(),
      },
    };

    // Add optional metadata fields only if non-empty
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

    // Add bibliography annotations if they exist
    if (hasAnnotations()) {
      cleaned.biblography_annotation = getAPIAnnotations();
    }

    return cleaned;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show confirmation modal before submitting
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = () => {
    setShowConfirmModal(false);
    setErrors({});

    // Validate required fields
    if (!type) {
      setErrors({ type: t("instance.typeRequired") });
      return;
    }

    // Validate source is not empty
    if (!source || source.trim().length === 0) {
      setErrors({ source: t("instance.sourceRequired") });
      return;
    }

    // Validate content is not empty
    if (!content || content.trim().length === 0) {
      setErrors({ content: t("instance.contentRequired") });
      return;
    }

    // Validate BDRC ID for diplomatic type
    if (type === "diplomatic" && !bdrc?.trim()) {
      setErrors({ bdrc: t("instance.bdrcIdRequired") });
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
        alt_incipit_titles: t("instance.altIncipitRequiresIncipit"),
      });
      return;
    }

    const cleanedData = cleanFormData();
    // Submit the form
    onSubmit(cleanedData);
  };

  const hasIncipitTitle = incipitTitles.some(
    (t) => t.language && t.value.trim()
  );

  const modalContent = showConfirmModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowConfirmModal(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 border-2 border-red-500">
        {/* Header with warning styling */}
        <div className="px-6 py-4 border-b border-red-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <h3 className="text-lg font-bold text-red-900">
              {t("common.confirm")}
            </h3>
          </div>
        </div>
        
        {/* Content */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-gray-800 font-medium leading-relaxed">
              {t("instance.confirmCreate")}
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-red-200 bg-red-50/50 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowConfirmModal(false)}
            className="border-gray-300 hover:bg-gray-50"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirmSubmit}
            disabled={isSubmitting}
            className="bg-red-600 hover:bg-red-700 text-white border-red-700"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t("instance.creating")}
              </>
            ) : (
              t("common.continue")
            )}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Confirmation Modal - Rendered via Portal to document.body */}
      {modalContent && createPortal(modalContent, document.body)}

      <form onSubmit={handleSubmit} className="space-y-4">
      {/* Metadata Section */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       

          {/* Source */}
          <div className="md:col-span-2">
            <label
              htmlFor="source"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("instance.source")} <span className="text-red-500">*</span>
            </label>
         <SourceSelection source={source} setSource={setSource} />
            {errors.source && (
              <p className="mt-1 text-sm text-red-600">{errors.source}</p>
            )}
          </div>

          {/* BDRC ID - Only shown for diplomatic type */}
          {type === "diplomatic" && (
            <div>
              <label
                htmlFor="bdrc"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("instance.bdrcInstanceId")} <span className="text-red-500">*</span>
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
                      required
                      placeholder={t("instance.searchBdrcEntries")}
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
                                key={`${result.instanceId}-${index}`}
                                type="button"
                                onClick={() => {
                                  setSelectedBdrc({
                                    id: result.instanceId ?? "",
                                    label: result.title ?? "",
                                  });
                                  setBdrc(result.instanceId ?? "");
                                  setShowBdrcDropdown(false);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-gray-200 border-b border-gray-100"
                              >
                                <div className="text-sm font-medium text-gray-900">
                                  {result.title}
                                </div>
                                <div className="text-xs text-gray-500">{result.instanceId}</div>
                              </button>
                            ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            {t("instance.noBdrcEntries")}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {errors.bdrc && (
                <p className="mt-1 text-sm text-red-600">{errors.bdrc}</p>
              )}
            </div>
          )}

  

          {/* Colophon */}
          <div className="md:col-span-2">
            <label
              htmlFor="colophon"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("instance.colophon")}
            </label>
            <Input
              id="colophon"
              type="text"
              value={colophon}
              onChange={(e) => setColophon(e.target.value)}
              placeholder={t("instance.colophonText")}
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
              {t("instance.addIncipitTitle")}
            </Button>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  {t("instance.incipitTitle")}
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
                      onChange={(e) => {
                        const selectedLang = e.target.value;
                        
                        // Check if this language already exists in another incipit title entry
                        const existingIndex = incipitTitles.findIndex(
                          (t, i) => i !== index && t.language === selectedLang
                        );
                        
                        if (existingIndex !== -1 && selectedLang) {
                          // Language exists in another entry - merge/overwrite
                          const updatedTitles = incipitTitles.filter((_, i) => i !== existingIndex);
                          updatedTitles[index === existingIndex ? index : (index > existingIndex ? index - 1 : index)].language = selectedLang;
                          setIncipitTitles(updatedTitles);
                        } else {
                          // No conflict, just update normally
                          const newTitles = [...incipitTitles];
                          newTitles[index].language = selectedLang;
                          setIncipitTitles(newTitles);
                        }
                      }}
                      className="w-20 sm:w-32 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                      onChange={(e) =>
                        updateIncipitTitle(index, "value", e.target.value)
                      }
                      className="flex-1 min-w-0 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder={t("instance.enterIncipitTitle")}
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
                {t("textForm.addLanguage")}
              </Button>
            </div>
          )}
        </div>

        {/* Alternative Incipit Titles Section */}
        {hasIncipitTitle && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {t("instance.alternativeIncipitTitles")}
              </label>
              <Button
                type="button"
                onClick={addAltIncipitTitle}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                {t("textForm.add")}
              </Button>
            </div>

            {altIncipitTitles.map((titleGroup, groupIndex) => (
              <div
                key={groupIndex}
                className="border rounded-lg p-4 bg-blue-50 mb-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {t("instance.alternative")} {groupIndex + 1}
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
                      onChange={(e) => {
                        const selectedLang = e.target.value;
                        
                        // Check if this language already exists in another entry within the same group
                        const existingIndex = altIncipitTitles[groupIndex].findIndex(
                          (t, i) => i !== langIndex && t.language === selectedLang
                        );
                        
                        if (existingIndex !== -1 && selectedLang) {
                          // Language exists in another entry within the group - merge/overwrite
                          const updated = [...altIncipitTitles];
                          updated[groupIndex] = updated[groupIndex].filter((_, i) => i !== existingIndex);
                          const adjustedLangIndex = langIndex > existingIndex ? langIndex - 1 : langIndex;
                          updated[groupIndex][adjustedLangIndex].language = selectedLang;
                          setAltIncipitTitles(updated);
                        } else {
                          // No conflict, just update normally
                          const updated = [...altIncipitTitles];
                          updated[groupIndex][langIndex].language = selectedLang;
                          setAltIncipitTitles(updated);
                        }
                      }}
                      className="w-20 sm:w-32 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                      onChange={(e) =>
                        updateAltTitle(
                          groupIndex,
                          langIndex,
                          "value",
                          e.target.value
                        )
                      }
                      className="flex-1 min-w-0 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder={t("instance.enterAlternativeTitle")}
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
                  {t("textForm.addLanguage")}
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
    <FormsubmitSection onSubmit={handleSubmit} onCancel={onCancel} isSubmitting={isSubmitting} disableSubmit={disableSubmit} />
    </form>
    </>
  );
});

InstanceCreationForm.displayName = "InstanceCreationForm";

export default InstanceCreationForm;
