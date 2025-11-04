import { useState, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Code } from "lucide-react";
import FileUploadZone from "./FileUploadZone";
import TextEditorView from "./TextEditorView";
import TextCreationForm from "@/components/TextCreationForm";
import type { TextCreationFormRef } from "@/components/TextCreationForm";
import InstanceCreationForm from "@/components/InstanceCreationForm";
import type { InstanceCreationFormRef } from "@/components/InstanceCreationForm";
import { useTexts, useCreateText, useCreateTextInstance } from "@/hooks/useTexts";
import { useNavigate } from "react-router-dom";
import { detectLanguage } from "@/utils/languageDetection";
import type { OpenPechaText } from "@/types/text";

const EnhancedTextCreationForm = () => {
  const navigate = useNavigate();
  const textFormRef = useRef<TextCreationFormRef>(null);
  const instanceFormRef = useRef<InstanceCreationFormRef>(null);

  // Workflow state
  const [currentStep, setCurrentStep] = useState<"select" | "upload" | "form">("select");
  const [isCreatingNewText, setIsCreatingNewText] = useState(false);

  // Text selection state
  const [selectedText, setSelectedText] = useState<OpenPechaText | null>(null);
  const [textSearch, setTextSearch] = useState("");
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

  // Handle text selection
  const handleTextSelect = (text: OpenPechaText) => {
    setSelectedText(text);
    setTextSearch(getTextDisplayName(text));
    setShowTextDropdown(false);
    setIsCreatingNewText(false);
    setCurrentStep("upload");
  };

  const handleCreateNewText = () => {
    setSelectedText(null);
    setTextSearch("");
    setShowTextDropdown(false);
    setIsCreatingNewText(true);
    setCurrentStep("upload");
  };

  const handleTextSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextSearch(e.target.value);
    setShowTextDropdown(true);
    if (!e.target.value) {
      setSelectedText(null);
    }
  };

  // Handle file upload
  const handleFileUpload = (content: string, filename: string) => {
    setEditedContent(content);
    setUploadedFilename(filename);
    setCurrentStep("form");
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
      await createInstanceMutation.mutateAsync({ textId, instanceData });
      setSuccess(
        isCreatingNewText
          ? "Text and instance created successfully!"
          : "Instance created successfully!"
      );

      // Redirect to text list after a short delay
      setTimeout(() => {
        navigate("/texts");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to create");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Go back to upload
  const handleBackToUpload = () => {
    setCurrentStep("upload");
    setEditedContent("");
    setUploadedFilename("");
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
      case "content":
        instanceFormRef.current?.addContent(text);
        break;
      case "person":
        textFormRef.current?.setPersonSearch(text);
        break;
    }
  };

  return (
    <>
      {/* Step 1: Select or Create Text */}
      {currentStep === "select" && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6">Step 1: Select or Create Text</h2>

          <div className="space-y-4">
            <div className="relative">
              <label
                htmlFor="text-search"
                className="block text-sm font-medium text-gray-700 mb-1"
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
                    className="w-full px-4 py-2 text-left hover:bg-blue-50 border-b border-gray-200 font-medium text-blue-600"
                  >
                    ➕ Create New Text
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

            {selectedText && (
              <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Selected Text:
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedText(null);
                      setTextSearch("");
                    }}
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
          </div>
        </Card>
      )}

      {/* Step 2: Upload */}
      {currentStep === "upload" && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6">
            {isCreatingNewText ? "Step 2: Upload Text File" : "Step 2: Upload Text File"}
          </h2>
          {selectedText && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                Creating instance for: <strong>{getTextDisplayName(selectedText)}</strong>
              </p>
            </div>
          )}
          <FileUploadZone onFileUpload={handleFileUpload} />
        </Card>
      )}

      {/* Step 3: Unified Form with Split View */}
      {currentStep === "form" && (
        <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gray-50 z-10">
          {/* Error/Success Messages - Floating */}
          {(error || success) && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-2xl px-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg mb-2">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg shadow-lg">
                  {success}
                </div>
              )}
            </div>
          )}

          {/* Split View: Form + CodeMirror - Full Screen */}
          <div className="relative h-full overflow-hidden">
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

            {/* Panels Container */}
            <div className="flex h-full">
              {/* Left: Unified Form (Text + Instance) */}
              <div
                className={`
                w-full md:w-1/2 h-full overflow-y-auto bg-white border-r border-gray-200 p-8
                absolute md:relative
                transition-transform duration-300 ease-in-out
                ${
                  activePanel === "form"
                    ? "translate-x-0"
                    : "-translate-x-full md:translate-x-0"
                }
              `}
              >
                <h2 className="text-2xl font-bold mb-6 text-gray-800">
                  {isCreatingNewText
                    ? "Create Text and its Details"
                    : "Create Instance"}
                </h2>

                {/* Show selected text info if using existing text */}
                {selectedText && !isCreatingNewText && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                      Creating instance for:
                    </p>
                    <p className="text-base font-semibold text-blue-800">
                      {getTextDisplayName(selectedText)}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {selectedText.type} • {selectedText.language}
                    </p>
                  </div>
                )}

                {/* Text Creation Form - Only show when creating new text */}
                {isCreatingNewText && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">
                      Text Information
                    </h3>
                    <TextCreationForm ref={textFormRef} />
                  </div>
                )}

                {/* Instance Creation Form */}
                <div className={isCreatingNewText ? "border-t border-gray-200 pt-6 mt-6" : ""}>
                  <h3 className="text-lg font-semibold mb-4 text-gray-700">
                    Instance Details
                  </h3>
                  <InstanceCreationForm
                    ref={instanceFormRef}
                    onSubmit={handleInstanceCreation}
                    isSubmitting={isSubmitting}
                    onCancel={handleBackToUpload}
                  />
                </div>
              </div>

              {/* Right: Document Preview */}
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
                <TextEditorView
                  content={editedContent}
                  filename={uploadedFilename}
                  editable={true}
                  onChange={(value) => setEditedContent(value)}
                  onTextSelect={handleEditorTextSelect}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EnhancedTextCreationForm;
