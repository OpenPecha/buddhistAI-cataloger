import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, Upload, FileText, Code } from "lucide-react";
import TextEditorView from "./TextEditorView";
import TextCreationForm from "@/components/TextCreationForm";
import type { TextCreationFormRef } from "@/components/TextCreationForm";
import InstanceCreationForm from "@/components/InstanceCreationForm";
import type { InstanceCreationFormRef } from "@/components/InstanceCreationForm";
import { useTexts, useCreateText, useCreateTextInstance } from "@/hooks/useTexts";
import { useSearchParams, useNavigate } from "react-router-dom";
import { detectLanguage } from "@/utils/languageDetection";
import { useBibliographyAPI } from "@/hooks/useBibliographyAPI";
import type { OpenPechaText } from "@/types/text";
import TextCreationSuccessModal from "./TextCreationSuccessModal";
import { useBdrcSearch, type BdrcSearchResult } from "@/hooks/useBdrcSearch";
import { fetchTextByBdrcId } from "@/api/texts";

const EnhancedTextCreationForm = () => {
  const navigate = useNavigate();
  const textFormRef = useRef<TextCreationFormRef>(null);
  const instanceFormRef = useRef<InstanceCreationFormRef>(null);
  const hasAutoSelectedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { clearAfterSubmission } = useBibliographyAPI();

  // Helper function to parse error messages
  const parseErrorMessage = (error: any): string => {
    // If error is a string, try to parse it as JSON
    if (typeof error === "string") {
      try {
        const parsed = JSON.parse(error);
        return parsed.error || parsed.message || error;
      } catch {
        return error;
      }
    }
    
    // If error has a message property
    if (error?.message) {
      try {
        const parsed = JSON.parse(error.message);
        return parsed.error || parsed.message || error.message;
      } catch {
        return error.message;
      }
    }
    
    // If error is an object with error property
    if (error?.error) {
      return error.error;
    }
    
    return "Failed to create";
  };

  // Workflow state
  const [isCreatingNewText, setIsCreatingNewText] = useState(false);
  const [searchParams] = useSearchParams();
  const t_id = searchParams.get("t_id") || "";

  // Text selection state
  const [selectedText, setSelectedText] = useState<OpenPechaText | null>(null);
  const [textSearch, setTextSearch] = useState(t_id);
  const [showTextDropdown, setShowTextDropdown] = useState(false);
  const [debouncedTextSearch, setDebouncedTextSearch] = useState("");

  // Mobile panel state
  const [activePanel, setActivePanel] = useState<"form" | "editor">("form");

  // File upload state
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>(" ");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdInstanceId, setCreatedInstanceId] = useState<string | null>(null);
  
  // Notification state for text selection actions
  const [notification, setNotification] = useState<string | null>(null);
  
  // Loading state for checking BDRC text
  const [isCheckingBdrc, setIsCheckingBdrc] = useState(false);

  // Track if incipit exists (for enabling/disabling alt incipit)
  const [hasIncipitTitle, setHasIncipitTitle] = useState(false);

  // Track if title exists (for enabling/disabling alt title)
  const [hasTitle, setHasTitle] = useState(false);

  // Track search attempts for "Create" button activation
  const [searchAttempts, setSearchAttempts] = useState(0);

  // Mutations and data
  const { data: texts = [], isLoading: isLoadingTexts } = useTexts({ limit: 100, offset: 0 });
  const createTextMutation = useCreateText();
  const createInstanceMutation = useCreateTextInstance();
  
  // BDRC search for texts
  const { results: bdrcResults, isLoading: isLoadingBdrc } = useBdrcSearch(debouncedTextSearch, "Instance",  1000);

  // Debounce text search and track attempts
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTextSearch(textSearch);
      // Increment search attempts only if there's actual search text
      if (textSearch.trim()) {
        setSearchAttempts(prev => prev + 1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [textSearch]);

  // Auto-select text when t_id is provided in URL
  useEffect(() => {
    if (t_id && texts.length > 0 && !selectedText && !hasAutoSelectedRef.current) {
      // Try to find the text by ID
      const foundText = texts.find((text: OpenPechaText) => text.id === t_id);
      
      if (foundText) {
        // Automatically select the found text
        setSelectedText(foundText);
        setTextSearch(getTextDisplayName(foundText));
        setShowTextDropdown(false);
        setIsCreatingNewText(false);
        hasAutoSelectedRef.current = true; // Mark as auto-selected
      }
    }
    // Reset the flag when there's no t_id in URL
    if (!t_id) {
      hasAutoSelectedRef.current = false;
    }
  }, [t_id, texts, selectedText]);

  // Periodically check if incipit and title exist to keep the state up to date
  useEffect(() => {
    const interval = setInterval(() => {
      if (instanceFormRef.current) {
        setHasIncipitTitle(instanceFormRef.current.hasIncipit());
      }
      if (textFormRef.current) {
        setHasTitle(textFormRef.current.hasTitle());
      }
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, []);

  // Helper function to get text display name
  const getTextDisplayName = (text: OpenPechaText): string => {
    return (
      text.title.bo ||
      text.title.en ||
      Object.values(text.title)[0] ||
      "Untitled"
    );
  };

  // Helper: Clear URL parameters if needed
  const clearUrlParams = () => {
    if (t_id) {
      navigate("/create", { replace: true });
    }
  };

  // Helper: Clear file upload state
  const clearFileUpload = () => {
    setEditedContent(" ");
    setUploadedFilename("");
  };

  // Helper: Reset to initial clean state
  const resetToInitialState = () => {
    // Set flag FIRST to prevent auto-select from re-triggering
    hasAutoSelectedRef.current = true; // Prevent auto-select effect
    
    // Clear all state
    setSelectedText(null);
    setTextSearch("");
    setIsCreatingNewText(false);
    clearFileUpload();
    
    // Clear URL params
    clearUrlParams();
  };

  const handleTextSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTextSearch(value);
    setShowTextDropdown(true);
    hasAutoSelectedRef.current = true; // Mark user interaction
    
    // Clear selection if search is empty
    if (!value) {
      setSelectedText(null);
      clearUrlParams(); // Clear URL to prevent loading state
      setSearchAttempts(0); // Reset search attempts when clearing
    }
  };

  // Handle creating new text from BDRC search
  const handleCreateNewFromSearch = () => {
    setSelectedText(null);
    setIsCreatingNewText(true);
    // Don't clear file upload - keep editor open with placeholder content
    if (!editedContent || editedContent.trim() === "") {
      setEditedContent(" "); // Set placeholder to show the editor
    }
    hasAutoSelectedRef.current = true;
    clearUrlParams();
    setShowTextDropdown(false);
    setTextSearch("");
    setSearchAttempts(0); // Reset attempts
    setNotification("✓ Ready to create new text - upload a file or start typing");
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle when existing text is found from TextCreationForm BDRC selection
  const handleExistingTextFoundFromForm = (text: OpenPechaText) => {
    // Switch from creating new text to using existing text
    setSelectedText(text);
    setTextSearch(getTextDisplayName(text));
    setIsCreatingNewText(false);
    hasAutoSelectedRef.current = true;
    navigate(`/create?t_id=${text.id}`, { replace: true });
    setNotification(`✓ Using existing text: ${getTextDisplayName(text)}`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle BDRC text selection
  const handleBdrcTextSelect = async (result: BdrcSearchResult) => {
    const workId = result.workId;
    if (!workId) return;
    
    setShowTextDropdown(false);
    setIsCheckingBdrc(true);
    
    try {
      // Try to fetch text by BDRC ID
      const existingText = await fetchTextByBdrcId(workId);
      
      if (existingText) {
        // Case 1: Text exists - select it
        setSelectedText(existingText);
        setTextSearch(getTextDisplayName(existingText));
        setIsCreatingNewText(false);
        clearFileUpload();
        hasAutoSelectedRef.current = true;
        navigate(`/create?t_id=${existingText.id}`, { replace: true });
        setNotification(`✓ Text found: ${getTextDisplayName(existingText)}`);
      } else {
        // Case 2: Text doesn't exist - create new with BDRC prefilled
        setSelectedText(null);
        setTextSearch("");
        setIsCreatingNewText(true);
        clearFileUpload();
        hasAutoSelectedRef.current = true;
        clearUrlParams();
        
        // Prefill BDRC field in TextCreationForm
        setTimeout(() => {
          textFormRef.current?.setBdrcId(workId, result.prefLabel || '');
        }, 100);
        
        setNotification(`Creating new text for BDRC: ${workId}`);
      }
    } catch {
      setError('Failed to check BDRC text. Please try again.');
    } finally {
      setIsCheckingBdrc(false);
    }
    
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle file upload
  const handleFileUpload = (content: string, filename: string) => {
    // Clean content immediately: remove empty lines and trailing empty lines
    let lines = content.split('\n');
    
    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].length === 0) {
      lines.pop();
    }
    
    // Filter out empty lines (but keep lines with spaces)
    lines = lines.filter(line => line.length > 0);
    
    // Rejoin with newlines
    const cleanedContent = lines.join('\n');
    
    setEditedContent(cleanedContent);
    setUploadedFilename(filename);
  };


  // Handle unified creation: create text then instance
  const handleInstanceCreation = async (instanceData: any) => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      let textId: string;

      if (isCreatingNewText) {
        // Creating new text - get form data from the global function
        const textFormData = (window as any).__getTextFormData?.();
        if (!textFormData) {
          throw new Error("Text form data not available");
        }

        // Create text first
        const newText = await createTextMutation.mutateAsync(textFormData);
        textId = newText.id;
      } else if (selectedText) {
        // Using existing text
        textId = selectedText.id;
      } else {
        throw new Error("No text selected or created");
      }

      // Now create the instance
      const createdInstance = await createInstanceMutation.mutateAsync({ textId, instanceData });
      // The API returns { message: string, id: string }, so access id directly
      setCreatedInstanceId(createdInstance?.id || null);
      
      // Clear bibliography annotations only after successful instance creation
      clearAfterSubmission();
      
      setSuccess(
        isCreatingNewText
          ? "Text and instance created successfully!"
          : "Instance created successfully!"
      );
    } catch (err: any) {
      setError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset everything after success
  const handleCloseSuccessModal = () => {
    setSuccess(null);
    setError(null);
    setIsSubmitting(false);
    setCreatedInstanceId(null);
    setActivePanel("form");
    resetToInitialState();
  };

  // Handle cancel - reset file upload but keep text selection
  const handleCancel = () => {
    clearFileUpload();
    setError(null);
    setSuccess(null);
  };

  // Handle text selection from editor
  const handleEditorTextSelect = (
    text: string,
    type: "title" | "alt_title" | "colophon" | "incipit" | "alt_incipit" | "person"
  ) => {
    // Detect language from selected text
    const detectedLanguage = detectLanguage(text);

    switch (type) {
      case "title":
     
        textFormRef.current?.addTitle(text, detectedLanguage);
        setNotification("✓ Title added successfully");
        setTimeout(() => setNotification(null), 2000);
        // Update hasTitle state
        setTimeout(() => {
          setHasTitle(textFormRef.current?.hasTitle() || false);
        }, 100);
        break;
      case "alt_title":
      
        textFormRef.current?.addAltTitle(text, detectedLanguage);
        setNotification("✓ Alternative title added successfully");
        setTimeout(() => setNotification(null), 2000);
        break;
      case "colophon":
        instanceFormRef.current?.addColophon(text);
        setNotification("✓ Colophon added successfully");
        setTimeout(() => setNotification(null), 2000);
        break;
      case "incipit":
        instanceFormRef.current?.addIncipit(text, detectedLanguage);
        setNotification("✓ Incipit added successfully");
        setTimeout(() => setNotification(null), 2000);
        // Update hasIncipit state
        setTimeout(() => {
          setHasIncipitTitle(instanceFormRef.current?.hasIncipit() || false);
        }, 100);
        break;
      case "alt_incipit":
        instanceFormRef.current?.addAltIncipit(text, detectedLanguage);
        setNotification("✓ Alternative incipit title added successfully");
        setTimeout(() => setNotification(null), 2000);
        break;
      case "person":
    
        textFormRef.current?.setPersonSearch(text);
        textFormRef.current?.openContributorForm();
        setNotification("✓ Person search filled");
        setTimeout(() => setNotification(null), 2000);
        break;
    }
  };

  // Check if upload should be enabled
  const canUpload = selectedText !== null || isCreatingNewText;

  // Show loading screen when auto-selecting text from URL
  const isAutoSelecting = t_id && (isLoadingTexts || (texts.length > 0 && !selectedText));

  return (
    <>
      {/* Success Modal - Full screen overlay */}
      {success && (
        <TextCreationSuccessModal
          message={success}
          onClose={handleCloseSuccessModal}
          instanceId={createdInstanceId}
        />
      )}

      {/* Notification Toast - Success/Info Messages */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 flex items-center gap-3 max-w-sm">
            <span className="text-sm font-medium text-gray-800">{notification}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error Message - Clean Modal */}
      {error && (
        <div className="fixed inset-0 flex items-start justify-center z-50 pt-20 pointer-events-none">
          <div className="bg-white rounded-md shadow-lg border max-w-sm mx-4 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => setError(null)}
                  size="sm"
                  className="text-sm px-4"
                >
                  OK
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Beautiful Loading Screen - Show while auto-selecting text from URL */}
      {isAutoSelecting && (
        <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center z-40">
          <div className="text-center max-w-md mx-auto px-6">
            {/* Animated Logo/Icon */}
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-20 animate-ping"></div>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform">
                  <FileText className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>

            {/* Loading Text */}
            <h2 className="text-3xl font-bold text-gray-800 mb-3 animate-pulse">
              Loading Text...
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Preparing your workspace
            </p>

            {/* Progress Indicator */}
            <div className="relative w-64 h-2 bg-gray-200 rounded-full overflow-hidden mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"></div>
            </div>

            {/* Additional Info */}
            <p className="text-sm text-gray-500 mt-6">
              Fetching text details from catalog...
            </p>
          </div>
        </div>
      )}

      {/* Loading Screen - Show while checking BDRC text */}
      {isCheckingBdrc && (
        <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 flex items-center justify-center z-40">
          <div className="text-center max-w-md mx-auto px-6">
            {/* Animated Logo/Icon */}
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full opacity-20 animate-ping"></div>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform">
                  <FileText className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>

            {/* Loading Text */}
            <h2 className="text-3xl font-bold text-gray-800 mb-3 animate-pulse">
              Checking BDRC...
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Looking for existing text
            </p>

            {/* Progress Indicator */}
            <div className="relative w-64 h-2 bg-gray-200 rounded-full overflow-hidden mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"></div>
            </div>

            {/* Additional Info */}
            <p className="text-sm text-gray-500 mt-6">
              Checking if text exists in local catalog...
            </p>
          </div>
        </div>
      )}

      {/* Two-Panel Layout */}
      <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gray-50 flex">
        {/* Mobile Toggle Button */}
        <button
          onClick={() =>
            setActivePanel(activePanel === "form" ? "editor" : "form")
          }
          className="md:hidden fixed bottom-6 right-6 z-30 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          {activePanel === "form" ? (
            <>
              <Code className="w-5 h-5" />
              <span className="text-sm font-medium">View Editor</span>
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              <span className="text-sm font-medium">View Form</span>
            </>
          )}
        </button>

        {/* LEFT PANEL: Search + Forms */}
        <div
          className={`
            w-full md:w-1/2 h-full overflow-y-auto bg-white border-r border-gray-200
            absolute md:relative
            transition-transform duration-300 ease-in-out
            ${
              activePanel === "form"
                ? "translate-x-0"
                : "-translate-x-full md:translate-x-0"
            }
          `}
        >
          <div className="p-8">
            {/* Text Search/Selection Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">
                OpenPecha Text Cataloger
              </h2>
              
              <div className="space-y-4">
                {/* Search Input - Only show when no text is selected and not creating new */}
                {!selectedText && !isCreatingNewText && (
                  <div className="relative">
                    <label
                      htmlFor="text-search"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Search for existing text
                    </label>
                    <input
                      id="text-search"
                      type="text"
                      value={textSearch}
                      onChange={handleTextSearchChange}
                      onFocus={() => setShowTextDropdown(true)}
                      onBlur={() => setTimeout(() => setShowTextDropdown(false), 200)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search by title or BDRC ID..."
                    />

                    {/* Text Dropdown */}
                    {showTextDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
                        

                        {/* BDRC Results Section */}
                        {debouncedTextSearch.trim() && (
                          <>
                            <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700 uppercase">
                                BDRC Catalog
                              </span>
                              {searchAttempts >= 3 && (
                                <span className="text-xs text-gray-500">
                                  {searchAttempts} searches
                                </span>
                              )}
                            </div>
                            
                            {/* Create New Text Button - Enabled after 3 attempts */}
                            {searchAttempts >= 3 && (
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent input blur
                                  handleCreateNewFromSearch();
                                }}
                                className="w-full px-4 py-3 text-left bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-b-2 border-green-300 transition-all duration-200"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-semibold text-sm text-green-900">
                                      Create New Text
                                    </div>
                                    <div className="text-xs text-green-700 mt-0.5">
                                      Can't find what you're looking for? Create a new text entry
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )}
                            
                            {isLoadingBdrc ? (
                              <div className="px-4 py-4 flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                                <div className="text-sm text-gray-500">Searching BDRC...</div>
                              </div>
                            ) : bdrcResults.length > 0 ? (
                              bdrcResults.map((result) => (
                                <button
                                  key={result.workId}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent input blur
                                    handleBdrcTextSelect(result);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-purple-50 border-b border-gray-100"
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                      BDRC
                                    </span>
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">
                                        {result.prefLabel || "Untitled"}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {result.workId}
                                        {result.language && ` • ${result.language}`}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : debouncedTextSearch.trim() ? (
                              <div className="px-4 py-2 text-gray-500 text-sm">
                                No BDRC results found
                              </div>
                            ) : null}
                          </>
                        )}

                     
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Text Info */}
                {selectedText && !isCreatingNewText && (
                  <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">
                        Selected Text:
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetToInitialState}
                      >
                        Change
                      </Button>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div>
                        <strong>Title:</strong> {getTextDisplayName(selectedText)}
                      </div>
                      <div>
                        <strong>Type:</strong> {selectedText.type}
                      </div>
                      <div>
                        <strong>Language:</strong> {selectedText.language}
                      </div>
                    </div>
                  </div>
                )}

                {/* Creating New Text Info */}
                {isCreatingNewText && (
                  <div className="bg-green-50 border border-green-200 px-4 py-3 rounded-md">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-900">
                        Creating/Uploading file New Text 
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetToInitialState}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Forms Section - Show if in creation mode OR if text is selected */}
            {canUpload && (
              <div className="space-y-6">
                {/* Text Creation Form - Only show when creating new text */}
                 {isCreatingNewText && (
                   <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-6">
                  
                       <TextCreationForm 
                         ref={textFormRef}
                         onExistingTextFound={handleExistingTextFoundFromForm}
                       />
                   </div>
                 )}

                {/* Instance Creation Form - Show when text is selected or creating new with content */}
                {(selectedText || (isCreatingNewText && editedContent && editedContent.trim() !== "")) && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <InstanceCreationForm
                      ref={instanceFormRef}
                      onSubmit={handleInstanceCreation}
                      isSubmitting={isSubmitting}
                      onCancel={handleCancel}
                      content={editedContent}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Editor with Optional File Upload */}
        <div
          className={`
            w-full md:w-1/2 h-full overflow-hidden bg-gray-50
            absolute md:relative
            transition-transform duration-300 ease-in-out
            ${
              activePanel === "editor"
                ? "translate-x-0"
                : "translate-x-full md:translate-x-0"
            }
          `}
        >
          {!canUpload ? (
            /* Disabled State - No text selected */
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="mb-6 opacity-50">
                  <Upload className="w-20 h-20 mx-auto text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  Editor Disabled
                </h3>
                <p className="text-gray-500">
                  Please select an existing text or choose to create a new text to begin editing.
                </p>
              </div>
            </div>
          ) : (
            /* Editor View */
            <div className="h-full flex flex-col">
              {/* Upload Button in Header */}
              <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  {!editedContent || editedContent?.trim() === "" ? (
                    <>
                      <p className="text-sm text-gray-600">
                        Start typing below or upload a text file
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
                                alert('File is too small (minimum 1KB required)');
                                e.target.value = '';
                                return;
                              }
                              
                              // Validate file type
                              if (!file.name.endsWith('.txt')) {
                                alert('Please upload a .txt file only');
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
                          Upload File
                        </Button>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500">
                      {editedContent?.length} characters
                    </span>
                  )}
                </div>
              </div>
              
              {/* Editor */}
              <div className="flex-1 overflow-hidden">
                <TextEditorView
                  content={editedContent || ""}
                  filename={editedContent ? uploadedFilename : "New Document"}
                  editable={true}
                  onChange={(value) => setEditedContent(value)}
                  onTextSelect={handleEditorTextSelect}
                  isCreatingNewText={isCreatingNewText}
                  hasIncipit={hasIncipitTitle}
                  hasTitle={hasTitle}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default EnhancedTextCreationForm;
