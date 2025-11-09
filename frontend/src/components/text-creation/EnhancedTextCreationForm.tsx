import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, Upload, FileText, Code } from "lucide-react";
import FileUploadZone from "./FileUploadZone";
import TextEditorView from "./TextEditorView";
import TextCreationForm from "@/components/TextCreationForm";
import type { TextCreationFormRef } from "@/components/TextCreationForm";
import InstanceCreationForm from "@/components/InstanceCreationForm";
import type { InstanceCreationFormRef } from "@/components/InstanceCreationForm";
import { useTexts, useCreateText, useCreateTextInstance } from "@/hooks/useTexts";
import { useSearchParams, useNavigate } from "react-router-dom";
import { detectLanguage } from "@/utils/languageDetection";
import type { OpenPechaText } from "@/types/text";
import TextCreationSuccessModal from "./TextCreationSuccessModal";

const EnhancedTextCreationForm = () => {
  const navigate = useNavigate();
  const textFormRef = useRef<TextCreationFormRef>(null);
  const instanceFormRef = useRef<InstanceCreationFormRef>(null);
  const hasAddedFilenameRef = useRef<boolean>(false);
  const hasAutoSelectedRef = useRef<boolean>(false);

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
  const [editedContent, setEditedContent] = useState<string>("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mutations and data
  const { data: texts = [], isLoading: isLoadingTexts } = useTexts({ limit: 100, offset: 0 });
  const createTextMutation = useCreateText();
  const createInstanceMutation = useCreateTextInstance();

  // Debounce text search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTextSearch(textSearch);
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

  // Filter texts based on search
  const filteredTexts = useMemo(() => {
    if (!debouncedTextSearch.trim()) return texts.slice(0, 50);

    return texts
      .filter((text: OpenPechaText) => {
        const searchLower = debouncedTextSearch.toLowerCase();
        const titleMatches = Object.values(text.title).some((title) =>
          title.toLowerCase().includes(searchLower)
        );
        const idMatches = text.id.toLowerCase().includes(searchLower);
        return titleMatches || idMatches;
      })
      .slice(0, 50);
  }, [texts, debouncedTextSearch]);

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
    setEditedContent("");
    setUploadedFilename("");
    hasAddedFilenameRef.current = false;
  };

  // Helper: Reset to initial clean state
  const resetToInitialState = () => {
    setSelectedText(null);
    setTextSearch("");
    setIsCreatingNewText(false);
    clearFileUpload();
    hasAutoSelectedRef.current = false;
    clearUrlParams();
  };

  // Handle text selection
  const handleTextSelect = (text: OpenPechaText) => {
    setSelectedText(text);
    setTextSearch(getTextDisplayName(text));
    setShowTextDropdown(false);
    setIsCreatingNewText(false);
    clearFileUpload();
    hasAutoSelectedRef.current = true;
    // Clear URL if user selected different text
    if (t_id && t_id !== text.id) {
      clearUrlParams();
    }
  };

  const handleCreateNewText = () => {
    setSelectedText(null);
    setTextSearch("");
    setShowTextDropdown(false);
    setIsCreatingNewText(true);
    clearFileUpload();
    hasAutoSelectedRef.current = true;
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
    }
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
    hasAddedFilenameRef.current = false; // Reset flag for new upload
  };

  // Add filename as title after form is rendered
  useEffect(() => {
    if (
      editedContent && 
      isCreatingNewText && 
      uploadedFilename && 
      textFormRef.current &&
      !hasAddedFilenameRef.current
    ) {
      // Use setTimeout to ensure the ref is fully mounted
      setTimeout(() => {
        textFormRef.current?.addFilenameAsTitle(uploadedFilename);
        hasAddedFilenameRef.current = true; // Mark as added
      }, 0);
    }
  }, [editedContent, isCreatingNewText, uploadedFilename]);

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
      await createInstanceMutation.mutateAsync({ textId, instanceData });
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
    type: "title" | "colophon" | "incipit" | "content" | "person"
  ) => {
    // Detect language from selected text
    const detectedLanguage = detectLanguage(text);

    switch (type) {
      case "title":
        textFormRef.current?.addTitle(text, detectedLanguage);
        break;
      case "colophon":
        instanceFormRef.current?.addColophon(text);
        break;
      case "incipit":
        instanceFormRef.current?.addIncipit(text, detectedLanguage);
        break;
      case "person":
        textFormRef.current?.setPersonSearch(text);
        textFormRef.current?.openContributorForm();
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
        />
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
                      placeholder="Search by title or ID..."
                    />

                    {/* Text Dropdown */}
                    {showTextDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <button
                          type="button"
                          onClick={handleCreateNewText}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-200 font-medium text-blue-600 flex items-center gap-2"
                        >
                          <span className="text-xl">+</span>
                          <span>Create New Text</span>
                        </button>

                        {isLoadingTexts ? (
                          <div className="px-4 py-8 flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                            <div className="text-sm text-gray-500">Loading texts...</div>
                          </div>
                        ) : filteredTexts.length > 0 ? (
                          filteredTexts.map((text: OpenPechaText) => (
                            <button
                              key={text.id}
                              type="button"
                              onClick={() => handleTextSelect(text)}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100"
                            >
                              <div className="font-medium">
                                {getTextDisplayName(text)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {text.type} • {text.language}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-gray-500 text-sm">
                            No texts found
                          </div>
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
                        Creating New Text
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

            {/* Forms Section - Only show if file is uploaded */}
            {editedContent && (
              <div className="space-y-6">
                {/* Text Creation Form - Only show when creating new text */}
                {isCreatingNewText && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">
                      Text Information
                    </h3>
                    <div className="space-y-4">
                      <TextCreationForm ref={textFormRef} />
                    </div>
                  </div>
                )}

                {/* Instance Creation Form */}
                <div className={isCreatingNewText ? "border-t border-gray-200 pt-6" : ""}>
                  <h3 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">
                    Instance Details
                  </h3>
                  <InstanceCreationForm
                    ref={instanceFormRef}
                    onSubmit={handleInstanceCreation}
                    isSubmitting={isSubmitting}
                    onCancel={handleCancel}
                    content={editedContent}
                    isCreatingNewText={isCreatingNewText}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: File Upload / Editor */}
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
          {!editedContent ? (
            /* Upload Zone */
            <div className="h-full flex flex-col items-center justify-center p-8">
              {!canUpload ? (
                /* Disabled State - No text selected */
                <div className="text-center max-w-md">
                  <div className="mb-6 opacity-50">
                    <Upload className="w-20 h-20 mx-auto text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">
                    Upload Disabled
                  </h3>
                  <p className="text-gray-500">
                    Please select an existing text or choose to create a new text before uploading a file.
                  </p>
                </div>
              ) : (
                /* Active Upload Zone */
                <div className="w-full max-w-2xl">
                  <h3 className="text-xl font-semibold mb-6 text-gray-800 text-center">
                    Upload Text File
                  </h3>
                  <FileUploadZone onFileUpload={handleFileUpload} />
                </div>
              )}
            </div>
          ) : (
            /* Editor View */
            <TextEditorView
              content={editedContent}
              filename={uploadedFilename}
              editable={true}
              onChange={(value) => setEditedContent(value)}
              onTextSelect={handleEditorTextSelect}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default EnhancedTextCreationForm;
