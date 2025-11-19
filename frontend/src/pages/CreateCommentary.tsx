import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertCircle, X, Upload, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import TextEditorView from '@/components/text-creation/TextEditorView';
import { createCommentary } from '@/api/texts';
import { calculateAnnotations } from '@/utils/annotationCalculator';
import { useTranslation } from 'react-i18next';
import { useBdrcSearch } from '@/hooks/useBdrcSearch';
import { MultilevelCategorySelector } from '@/components/MultilevelCategorySelector';
import type { Person } from '@/types/person';
import { useInstance } from '@/hooks/useTexts';
import type { OpenPechaTextInstance } from '@/types/text';
import { useBibliography } from '@/contexts/BibliographyContext';
import { useBibliographyAPI } from '@/hooks/useBibliographyAPI';
import TextCreationSuccessModal from '@/components/text-creation/TextCreationSuccessModal';
import { useAuth0 } from '@auth0/auth0-react';
import { validateContentEndsWithTsheg, validateSegmentLimits } from '@/utils/contentValidation';


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

const CreateCommentary = () => {
  const { text_id, instance_id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth0();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch instance data
  const { data: instance, isLoading: instanceLoading } = useInstance(instance_id || '');

  // Form state
  const [language, setLanguage] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [altTitles, setAltTitles] = useState<string[]>([]);
  const [copyright, setCopyright] = useState<string>('Public domain');
  const [license, setLicense] = useState<string>('CC0');
  const [categoryId, setCategoryId] = useState<string>('');
  const [content, setContent] = useState('');
  const [uploadedFilename, setUploadedFilename] = useState('');

  // Person search state
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [debouncedPersonSearch, setDebouncedPersonSearch] = useState('');

  // BDRC person search (external API)
  const { results: bdrcPersonResults, isLoading: bdrcPersonLoading } = useBdrcSearch(debouncedPersonSearch, 'Person', 1000);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdInstanceId, setCreatedInstanceId] = useState<string | null>(null);

  // Bibliography annotations
  const { clearAnnotations } = useBibliography();
  const { getAPIAnnotations, hasAnnotations } = useBibliographyAPI();

  // Content validation - check if content ends with ། (only for Tibetan language)
  const contentValidationError = useMemo(() => {
    // Only validate if content is not empty
    if (!content || content.trim() === '') {
      return null; // No validation needed for empty content
    }
    
    // Only validate when language is explicitly "bo" (Tibetan)
    if (language !== 'bo') {
      return null; // No validation needed for non-Tibetan languages
    }
    
    const isValid = validateContentEndsWithTsheg(content);
    return isValid ? null : t("create.contentMustEndWithTsheg");
  }, [content, language, t]);

  // Segment character limit validation with debouncing (1000ms)
  const [segmentValidation, setSegmentValidation] = useState<{
    invalidSegments: Array<{ index: number; length: number }>;
    invalidCount: number;
  }>({ invalidSegments: [], invalidCount: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      const validation = validateSegmentLimits(content);
      setSegmentValidation({
        invalidSegments: validation.invalidSegments.map(seg => ({ index: seg.index, length: seg.length })),
        invalidCount: validation.invalidCount,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [content]);

  // Clear annotations when component mounts (to clear any stale annotations from previous visits)
  useEffect(() => {
    clearAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce person search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPersonSearch(personSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [personSearch]);

  // Auto-set license to "unknown" when copyright is "Unknown"
  useEffect(() => {
    if (copyright === "Unknown") {
      setLicense("unknown");
    }
  }, [copyright]);

  // Extract instance title with fallback logic (same as TextInstanceCard)
  const getInstanceTitle = (instance: OpenPechaTextInstance | undefined): string => {
    if (!instance || !instance.metadata) return t('header.instances');

    let title = "";
    
    if (instance.metadata.incipit_title && typeof instance.metadata.incipit_title === 'object') {
      const incipitObj = instance.metadata.incipit_title as Record<string, string>;
      if (incipitObj.bo) {
        title = incipitObj.bo;
      } else {
        // Get first available language from incipit_title
        const firstLanguage = Object.keys(incipitObj)[0];
        if (firstLanguage) {
          title = incipitObj[firstLanguage];
        }
      }
    }
    
    // If no incipit_title, format with colophon
    if (!title) {
      title = instance.metadata.colophon 
        ? `Text Instance (${instance.metadata.colophon})` 
        : "Text Instance";
    }

    return title;
  };

  const getPersonDisplayName = (person: Person): string => {
    if (!person.name) {
      return person.id || t("textForm.unknown");
    }
    return (
      person.name.bo ||
      person.name.en ||
      Object.values(person.name)[0] ||
      t("textForm.unknown")
    );
  };

  const handlePersonSelect = (person: Person) => {
    setSelectedPerson(person);
    setPersonSearch(getPersonDisplayName(person));
    setShowPersonDropdown(false);
  };

  const handlePersonSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPersonSearch(e.target.value);
    setShowPersonDropdown(true);
    if (!e.target.value) {
      setSelectedPerson(null);
    }
  };

  const handleFileUpload = (content: string, filename: string) => {
    // Clean content
 
    

    let lines = content.split('\n');
    
    lines = lines.filter(line => line.trim() !== '');

    const cleanedContent = lines.join('\n');

    
    setContent(cleanedContent);
    setUploadedFilename(filename);
  };

  // Handle text selection from editor (Title, Alt Title, and Person)
  const handleEditorTextSelect = (
    text: string,
    type: "title" | "alt_title" | "colophon" | "incipit" | "alt_incipit" | "person"
  ) => {
    switch (type) {
      case "title":
        // Fill the title field in the form
        setTitle(text);
        break;
      case "alt_title":
        // Add to alt titles array
        setAltTitles(prev => [...prev, text]);
        break;
      case "person":
        // Fill the person search field
        setPersonSearch(text);
        setShowPersonDropdown(true);
        break;
      default:
        // Ignore other types (they won't be shown in menu anyway)
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!language) {
        throw new Error(t('textForm.languageRequired'));
      }
      if (!title || title.trim() === '') {
        throw new Error(t('textForm.titleRequired'));
      }
      if (!source || source.trim() === '') {
        throw new Error(t('commentary.sourceRequired'));
      }
      if (!content || content.trim() === '') {
        throw new Error(t('instance.contentRequired'));
      }

      // Calculate segmentation from content
      const { annotations, cleanedContent } = calculateAnnotations(content);

      // Prepare commentary data
      const commentaryData: any = {
        language,
        content: cleanedContent,
        title,
        source: source.trim(),
        segmentation: annotations,
        copyright,
        // If copyright is Unknown, send "unknown", otherwise use selected license
        license: copyright === "Unknown" ? "unknown" : license,
        category_id: categoryId && categoryId.trim() !== '' ? categoryId : null
      };

      // Add alt_titles if any exist
      if (altTitles.length > 0) {
        commentaryData.alt_titles = altTitles.filter(t => t.trim() !== '');
      }

      // Add author only if selected
      if (selectedPerson) {
        if (selectedPerson.bdrc) {
          commentaryData.author = { person_bdrc_id: selectedPerson.bdrc };
        } else {
          commentaryData.author = { person_id: selectedPerson.id };
        }
      }

      // Add bibliography annotations if they exist
      if (hasAnnotations()) {
        commentaryData.biblography_annotation = getAPIAnnotations();
      }

      // Create commentary
      const response = await createCommentary(instance_id || '', commentaryData, JSON.stringify(user || {}));
      
      // Extract instance_id from response
      if (response && response.instance_id) {
        setCreatedInstanceId(response.instance_id);
      }
      
      // Clear bibliography annotations after successful submission
      clearAnnotations();
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t('messages.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle modal close - navigate back to instance page
  const handleModalClose = () => {
    setSuccess(false);
    navigate(`/texts/${text_id}/instances/${instance_id}`);
  };

  return (
    <>
      {/* Success Modal */}
      {success && (
        <TextCreationSuccessModal
          message={`${t('textForm.commentary')} ${t('messages.createSuccess').toLowerCase()}`}
          onClose={handleModalClose}
          instanceId={createdInstanceId || null}
          parentInstanceId={instance_id || null}
        />
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-white rounded-lg shadow-lg border border-red-200 px-4 py-3 flex items-center gap-3 max-w-sm">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-800">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gray-50 flex">
        {/* LEFT PANEL: Commentary Form */}
        <div className="w-1/2 h-full overflow-y-auto bg-white border-r border-gray-200">
          <div className="p-8">
            {/* Header with Back Button */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => navigate(`/texts/${text_id}/instances/${instance_id}`)}
                className="mb-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('common.back')}
              </button>
              <h2 className="text-2xl font-bold text-gray-800 text-center">
                {t('textForm.commentary')}
              </h2>
              {instanceLoading ? (
                <div className="flex items-center justify-center mt-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 mt-3 text-center">
                  <span>{t('textForm.createCommentaryFor')}</span>
                  <span className="inline-block mx-2 px-3 py-1 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800 font-semibold rounded-lg shadow-sm border border-indigo-200">
                    {getInstanceTitle(instance)}
                  </span>
                </div>
              )}
            </div>

            {/* Commentary Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Language Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('textForm.language')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">{t('textForm.selectLanguage')}</option>
                  {LANGUAGE_OPTIONS.map((lang) => {
                    const translationKey = lang.code === 'bo' ? 'tibetan' :
                                          lang.code === 'en' ? 'english' :
                                          lang.code === 'zh' ? 'chinese' :
                                          lang.code === 'sa' ? 'sanskrit' :
                                          lang.code === 'fr' ? 'french' :
                                          lang.code === 'mn' ? 'mongolian' :
                                          lang.code === 'pi' ? 'pali' :
                                          lang.code === 'cmg' ? 'classicalMongolian' :
                                          lang.code === 'ja' ? 'japanese' :
                                          lang.code === 'ru' ? 'russian' :
                                          lang.code === 'lzh' ? 'literaryChinese' : '';
                    return (
                      <option key={lang.code} value={lang.code}>
                        {t(`textsPage.${translationKey}`)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Title Field (REQUIRED) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('textForm.title')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault(); // Prevent form submission on Enter
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('textForm.enterTitle')}
                  required
                />
              </div>

              {/* Alternative Titles Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('textForm.altTitles')}
                </label>
                <div className="space-y-2">
                  {altTitles.map((altTitle, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={altTitle}
                        onChange={(e) => {
                          const newAltTitles = [...altTitles];
                          newAltTitles[index] = e.target.value;
                          setAltTitles(newAltTitles);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('textForm.enterAltTitle')}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newAltTitles = altTitles.filter((_, i) => i !== index);
                          setAltTitles(newAltTitles);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAltTitles([...altTitles, ''])}
                    className="w-full border-dashed"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('textForm.addAltTitle')}
                  </Button>
                </div>
              </div>

              {/* Author Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('textForm.author')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={personSearch}
                    onChange={handlePersonSearchChange}
                    onFocus={() => setShowPersonDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPersonDropdown(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault(); // Prevent form submission on Enter
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('textForm.searchForPerson')}
                  />

                  {/* Loading indicator
                  {(bdrcPersonLoading || personsLoading) && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    </div>
                  )} */}

                  {bdrcPersonLoading && (
                    <div className="absolute right-3 top-9">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    </div>
                  )}

                  {/* Dual-Catalog Person Dropdown */}
                  {showPersonDropdown && debouncedPersonSearch.trim() && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
                      
                      {/* BDRC Catalog Section */}
                      <div className="px-4 py-2 bg-purple-50 border-b border-purple-100">
                        <span className="text-xs font-semibold text-purple-700 uppercase">
                          {t('textForm.bdrcCatalogPerson')}
                        </span>
                      </div>
                      {bdrcPersonLoading ? (
                        <div className="px-4 py-4 flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                          <div className="text-sm text-gray-500">{t('textForm.searchingBdrcPerson')}</div>
                        </div>
                      ) : debouncedPersonSearch.length < 2 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 italic">
                          {t('textForm.typeAtLeast2Characters') || 'Type at least 2 characters to search...'}
                        </div>
                      ) : bdrcPersonResults.length > 0 ? (
                        bdrcPersonResults.map((result) => (
                          <button
                            key={result.bdrc_id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              // Create Person object from BDRC data
                              const bdrcPerson: Person = {
                                id: result.bdrc_id || '',
                                name: { bo: result.name || '' },
                                alt_names: [],
                                bdrc: result.bdrc_id || '',
                                wiki: null
                              };
                              handlePersonSelect(bdrcPerson);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-purple-50 border-b border-gray-100 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                BDRC
                              </span>
                              <div className="flex-1">
                                <div className="font-medium text-sm text-gray-900">
                                  {result.name || t('textForm.untitled')}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {result.bdrc_id}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <div className="text-sm text-gray-600 font-medium">
                            {t('textForm.noBdrcPersonResults')}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Try a different name
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Selected Person Display */}
                {selectedPerson && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <span className="font-medium">✓ Selected:</span> 
                      <span>{getPersonDisplayName(selectedPerson)}</span>
                      {selectedPerson.bdrc && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded ml-1">
                          BDRC
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Category Field (Optional) */} 
              <div>
                <MultilevelCategorySelector
                  onCategorySelect={(categoryId, _path) => setCategoryId(categoryId || '')}
                  selectedCategoryId={categoryId || undefined}
                />
              </div>

              {/* Source Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('commentary.source')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('commentary.sourcePlaceholder')}
                  required
                />
              </div>

              {/* Copyright Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('commentary.copyright')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={copyright}
                  onChange={(e) => setCopyright(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Unknown">{t("textForm.copyrightUnknown")}</option>
                  <option value="In copyright">{t("textForm.copyrightInCopyright")}</option>
                  <option value="Public domain">{t("textForm.copyrightPublicDomain")}</option>
                </select>
              </div>

              {/* License Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('commentary.license')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  disabled={copyright === "Unknown"}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    copyright === "Unknown" ? "bg-gray-100 cursor-not-allowed opacity-60" : ""
                  }`}
                  required
                >
                  <option value="unknown">{t("textForm.licenseUnknown")}</option>
                  <option value="CC0">{t("textForm.licenseCC0")}</option>
                  <option value="Public Domain Mark">{t("textForm.licensePublicDomainMark")}</option>
                  <option value="CC BY">{t("textForm.licenseCCBY")}</option>
                  <option value="CC BY-SA">{t("textForm.licenseCCBYSA")}</option>
                  <option value="CC BY-ND">{t("textForm.licenseCCBYND")}</option>
                  <option value="CC BY-NC">{t("textForm.licenseCCBYNC")}</option>
                  <option value="CC BY-NC-SA">{t("textForm.licenseCCBYNCSA")}</option>
                  <option value="CC BY-NC-ND">{t("textForm.licenseCCBYNCND")}</option>
                  <option value="under copyright">{t("textForm.licenseUnderCopyright")}</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-gray-200">
                <Button
                  type="submit"
                  disabled={isSubmitting || !content || !language || !title || !source || !!contentValidationError || segmentValidation.invalidCount > 0}
                  className="w-full bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 text-white py-3"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t('instance.creating')}
                    </>
                  ) : (
                    t('common.create')
                  )}
                </Button>
              </div>

              {/* JSON Preview Section (Temporary for Testing) */}
              {/* {content && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">
                      📋 Payload Preview (Testing)
                    </h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const { annotations, cleanedContent } = calculateAnnotations(content);
                        const payload: any = {
                          language,
                          content: cleanedContent,
                          title,
                          source: source.trim(),
                          segmentation: annotations,
                          copyright,
                          license,
                          category_id: categoryId && categoryId.trim() !== '' ? categoryId : null
                        };
                        if (altTitles.length > 0) {
                          payload.alt_titles = altTitles.filter(t => t.trim() !== '');
                        }
                        if (selectedPerson) {
                          if (selectedPerson.bdrc) {
                            payload.author = { person_bdrc_id: selectedPerson.bdrc };
                          } else {
                            payload.author = { person_id: selectedPerson.id };
                          }
                        }
                        if (hasAnnotations()) {
                          payload.biblography_annotation = getAPIAnnotations();
                        }
                        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                        alert('JSON copied to clipboard!');
                      }}
                    >
                      Copy JSON
                    </Button>
                  </div>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto">
                    {JSON.stringify(
                      (() => {
                        const { annotations, cleanedContent } = calculateAnnotations(content);
                        const payload: any = {
                          language,
                          content: cleanedContent,
                          title,
                          source: source.trim(),
                          segmentation: annotations,
                          copyright,
                          license,
                          category_id: categoryId && categoryId.trim() !== '' ? categoryId : null
                        };
                        if (altTitles.length > 0) {
                          payload.alt_titles = altTitles.filter(t => t.trim() !== '');
                        }
                        if (selectedPerson) {
                          if (selectedPerson.bdrc) {
                            payload.author = { person_bdrc_id: selectedPerson.bdrc };
                          } else {
                            payload.author = { person_id: selectedPerson.id };
                          }
                        }
                        if (hasAnnotations()) {
                          payload.biblography_annotation = getAPIAnnotations();
                        }
                        return payload;
                      })(),
                      null,
                      2
                    )}
                  </pre>
                </div>
              )} */}
            </form>
          </div>
        </div>

        {/* RIGHT PANEL: Text Editor */}
        <div className="w-full md:w-1/2 h-full overflow-hidden bg-gray-50 relative">
          {/* Editor View - Always enabled for Commentary */}
          <div className="h-full flex flex-col">
            {/* Upload Button in Header */}
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
              <div className="flex items-center justify-between">
                {!content || content.trim() === '' ? (
                  <>
                    <p className="text-sm text-gray-600">
                      {t('create.startTyping')}
                    </p>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            const file = files[0];
                            
                            // Validate file size
                            if (file.size < 1024) {
                              alert(t('create.fileTooSmall'));
                              e.target.value = '';
                              return;
                            }
                            
                            // Validate file type
                            if (!file.name.endsWith('.txt')) {
                              alert(t('create.uploadTxtOnly'));
                              e.target.value = '';
                              return;
                            }
                            
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const content = event.target?.result as string;
                              handleFileUpload(content, file.name);
                            };
                            reader.readAsText(file);
                          }
                          e.target.value = ''; // Reset input
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          fileInputRef.current?.click();
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        {t('create.uploadFile')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">
                    {content?.length} {t('create.characters')}
                  </span>
                )}
              </div>
            </div>
            
            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <TextEditorView
                content={content || ''}
                filename={content ? uploadedFilename : t('editor.newDocument')}
                editable={true}
                onChange={(value) => setContent(value)}
                onTextSelect={handleEditorTextSelect}
                isCreatingNewText={false}
                hasIncipit={false}
                hasTitle={!!title}
                allowedTypes={["title", "alt_title", "person"]}
                validationError={contentValidationError}
                segmentValidation={segmentValidation}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateCommentary;

