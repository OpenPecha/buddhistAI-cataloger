import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useTexts,
  useCreateText,
  useCreateTextInstance,
} from "@/hooks/useTexts";
import type { OpenPechaText } from "@/types/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import TextCreationForm from "@/components/TextCreationForm";
import InstanceCreationForm from "@/components/InstanceCreationForm";

const UnifiedCreationForm = () => {
  const navigate = useNavigate();

  // State for workflow management
  const [currentStep, setCurrentStep] = useState<
    "select" | "text" | "instance"
  >("select");
  const [selectedText, setSelectedText] = useState<OpenPechaText | null>(null);
  const [createdTextId, setCreatedTextId] = useState<string | null>(null);
  const [textSearch, setTextSearch] = useState("");
  const [showTextDropdown, setShowTextDropdown] = useState(false);

  // Debounced search
  const [debouncedTextSearch, setDebouncedTextSearch] = useState("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mutations
  const createTextMutation = useCreateText();
  const createInstanceMutation = useCreateTextInstance();

  // Fetch texts for dropdown
  const { data: texts = [], isLoading: isLoadingTexts } = useTexts({ limit: 100, offset: 0 });

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

  // Helper function
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
    setCurrentStep("instance");
  };

  const handleCreateNewText = () => {
    setSelectedText(null);
    setTextSearch("");
    setShowTextDropdown(false);
    setCurrentStep("text");
  };

  const handleTextSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextSearch(e.target.value);
    setShowTextDropdown(true);
    if (!e.target.value) {
      setSelectedText(null);
    }
  };

  // Handle unified creation: create text (if new) then create instance
  const handleInstanceCreation = async (instanceData: any) => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      let textId = selectedText?.id;

      // If creating new text, get form data and create it first
      if (currentStep === "text") {
        // Get form data from the global function
        const textFormData = (window as any).__getTextFormData?.();

        if (!textFormData) {
          throw new Error("Text form data not available");
        }

        const newText = await createTextMutation.mutateAsync(textFormData);
        textId = newText.id;
        setCreatedTextId(newText.id);
      }

      if (!textId) {
        throw new Error("No text selected or created");
      }

      // Now create the instance
      await createInstanceMutation.mutateAsync({ textId, instanceData });
      setSuccess("Text and Details created successfully!");

      // Redirect to text list after a short delay
      setTimeout(() => {
        navigate("/texts");
      }, 1500);
    } catch (err: unknown) {
      let errorMessage = "Unknown error";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null) {
        // Try to extract error details from API response
        const errorObj = err as any;
        if (errorObj.response?.data?.detail) {
          errorMessage = errorObj.response.data.detail;
        } else if (errorObj.response?.data?.message) {
          errorMessage = errorObj.response.data.message;
        } else if (errorObj.message) {
          errorMessage = errorObj.message;
        } else {
          errorMessage = JSON.stringify(err);
        }
      }

      setError(`Failed to create: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Create Text and its Details
        </h1>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Step 1: Select or Create Text */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">
          Step 1: Select or Create Text
        </h2>

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
                        {text.type} • {text.language} • {text.id}
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
                    setCurrentStep("select");
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
                <div>
                  <strong>ID:</strong> {selectedText.id}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Step 2: Create New Text Form (only show if "Create New Text" was clicked) */}
      {currentStep === "text" && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Step 2: Create New Text
          </h2>
          <TextCreationForm />
        </Card>
      )}

      {/* Step 3: Create Details Form (show when text is selected or created) */}
      {(currentStep === "instance" || currentStep === "text") && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            {currentStep === "text" ? "Step 3: " : "Step 2: "}Create Details
          </h2>
          {(createdTextId || selectedText || currentStep === "text") && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                {currentStep === "text" && !createdTextId ? (
                  <>Details for the Text</>
                ) : (
                  <>
                    Details for:{" "}
                    <strong>{createdTextId || selectedText?.id}</strong>
                  </>
                )}
              </p>
            </div>
          )}
          <InstanceCreationForm
            onSubmit={handleInstanceCreation}
            isSubmitting={isSubmitting}
            onCancel={() => {
              if (createdTextId) {
                setCurrentStep("text");
              } else {
                setCurrentStep("select");
              }
            }}
          />
        </Card>
      )}
    </div>
  );
};

export default UnifiedCreationForm;
