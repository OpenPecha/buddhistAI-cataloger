import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { FileText, Code } from "lucide-react";
import FileUploadZone from "./FileUploadZone";
import TextEditorView from "./TextEditorView";
import TextCreationForm from "@/components/TextCreationForm";
import type { TextCreationFormRef } from "@/components/TextCreationForm";
import InstanceCreationForm from "@/components/InstanceCreationForm";
import type { InstanceCreationFormRef } from "@/components/InstanceCreationForm";
import { useCreateText, useCreateTextInstance } from "@/hooks/useTexts";
import { useNavigate } from "react-router-dom";
import { detectLanguage } from "@/utils/languageDetection";

const EnhancedTextCreationForm = () => {
  const navigate = useNavigate();
  const textFormRef = useRef<TextCreationFormRef>(null);
  const instanceFormRef = useRef<InstanceCreationFormRef>(null);

  // Workflow state
  const [currentStep, setCurrentStep] = useState<"upload" | "form">("upload");

  // Mobile panel state
  const [activePanel, setActivePanel] = useState<"form" | "editor">("form");

  // File upload state
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mutations
  const createTextMutation = useCreateText();
  const createInstanceMutation = useCreateTextInstance();

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
      // Get text form data from the global function
      const textFormData = (window as any).__getTextFormData?.();

      if (!textFormData) {
        throw new Error("Text form data not available");
      }

      // Create text first
      const newText = await createTextMutation.mutateAsync(textFormData);
      const textId = newText.id;

      // Now create the instance
      await createInstanceMutation.mutateAsync({ textId, instanceData });
      setSuccess("Text and instance created successfully!");

      // Redirect to text list after a short delay
      setTimeout(() => {
        navigate("/texts");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to create text and instance");
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
  const handleTextSelect = (
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
      {/* Step 1: Upload */}
      {currentStep === "upload" && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6">Upload Text File</h2>
          <FileUploadZone onFileUpload={handleFileUpload} />
        </Card>
      )}

      {/* Step 2: Unified Form with Split View */}
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
                  Create Text and its Details
                </h2>

                {/* Text Creation Form */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4 text-gray-700">
                    Text Information
                  </h3>
                  <TextCreationForm ref={textFormRef} />
                </div>

                {/* Instance Creation Form */}
                <div className="border-t border-gray-200 pt-6 mt-6">
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
                  onTextSelect={handleTextSelect}
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
