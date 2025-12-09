import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, Upload, FileText, Code, ArrowLeft, Loader2 } from "lucide-react";
import TextEditorView from "@/components/textCreation/TextEditorView";
import InstanceCreationForm from "@/components/InstanceCreationForm";
import type { InstanceCreationFormRef } from "@/components/InstanceCreationForm";
import { useText, useInstance, useUpdateInstance, useAnnnotation } from "@/hooks/useTexts";
import { useTranslation } from "react-i18next";
import { useAuth0 } from "@auth0/auth0-react";
import { calculateAnnotations } from "@/utils/annotationCalculator";
import { useBibliographyAPI } from "@/hooks/useBibliographyAPI";
import { validateContentEndsWithTsheg, validateSegmentLimits } from "@/utils/contentValidation";

const UpdateAnnotation = () => {
  const { text_id, instance_id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth0();
  const instanceFormRef = useRef<InstanceCreationFormRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { clearAfterSubmission } = useBibliographyAPI();

  // Fetch text and instance data
  const { data: text, isLoading: textLoading } = useText(text_id || "");
  const { data: instance, isLoading: instanceLoading } = useInstance(instance_id || "");
  const updateInstanceMutation = useUpdateInstance();

  // Find segmentation annotation ID from instance.annotations array
  const segmentationAnnotationRef =
    instance && Array.isArray(instance.annotations)
      ? instance.annotations.find((ann: any) => ann.type === "segmentation")
      : null;
  const segmentationAnnotationId =
    segmentationAnnotationRef?.annotation_id || "";

  // Fetch annotation data
  const {
    data: annotationData,
    isLoading: annotationLoading,
  } = useAnnnotation(segmentationAnnotationId);

  // State
  const [editedContent, setEditedContent] = useState("");
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activePanel, setActivePanel] = useState<"form" | "editor">("form");
  const [hasIncipitTitle, setHasIncipitTitle] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Content validation - get language from text data
  useEffect(() => {
    if (text?.language) {
      setSelectedLanguage(text.language);
    }
  }, [text]);

  const contentValidationError = useMemo(() => {
    const isValidMessage = validateContentEndsWithTsheg(selectedLanguage, editedContent);
    return isValidMessage;
  }, [selectedLanguage, editedContent]);

  const [segmentValidation, setSegmentValidation] = useState<{
    invalidSegments: Array<{ index: number; length: number }>;
    invalidCount: number;
  }>({ invalidSegments: [], invalidCount: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      const validation = validateSegmentLimits(editedContent);
      setSegmentValidation({
        invalidSegments: validation.invalidSegments.map(seg => ({ index: seg.index, length: seg.length })),
        invalidCount: validation.invalidCount,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [editedContent]);

  // Helper function to reconstruct content with segmentation line breaks
  const reconstructContentWithSegmentation = (
    content: string,
    annotationData: any
  ): string => {
    if (!content) return "";

    // Check if we have segmentation annotations
    const segmentationAnnotations = annotationData?.data;
    if (
      !segmentationAnnotations ||
      !Array.isArray(segmentationAnnotations) ||
      segmentationAnnotations.length === 0
    ) {
      // No segmentation, return content as-is
      return content;
    }

    // Sort annotations by span start position
    const sortedAnnotations = [...segmentationAnnotations].sort(
      (a: any, b: any) => {
        return (a.span?.start || 0) - (b.span?.start || 0);
      }
    );

    // Extract each segment and join with newlines
    const lines = sortedAnnotations.map((annotation: any) => {
      if (!annotation.span) return "";
      return content.substring(annotation.span.start, annotation.span.end);
    });

    return lines.join("\n");
  };

  // Initialize forms with existing data
  useEffect(() => {
    if (
      instance &&
      !isInitialized &&
      instanceFormRef.current &&
      (annotationData || !segmentationAnnotationId) // Wait for annotation if it exists
    ) {
      // Initialize instance form and content with segmentation
      if (instance.content) {
        // Reconstruct content with line breaks from segmentation annotations
        const formattedContent = reconstructContentWithSegmentation(
          instance.content,
          annotationData
        );
        setEditedContent(formattedContent);
      }

      // Set instance metadata
      if (instance.metadata) {
        const meta = instance.metadata;
        
        instanceFormRef.current.initializeForm?.({
          type: meta.type,
          source: (meta as any).source || undefined,
          bdrc: meta.bdrc || undefined,
          wiki: meta.wiki || undefined,
          colophon: meta.colophon || undefined,
        });

        // Set colophon
        if (meta.colophon) {
          instanceFormRef.current.addColophon(meta.colophon);
        }

        // Set incipit titles
        if (meta.incipit_title && typeof meta.incipit_title === "object") {
          Object.entries(meta.incipit_title).forEach(([lang, value]) => {
            instanceFormRef.current?.addIncipit(value as string, lang);
          });
          setHasIncipitTitle(true);
        }

        // Set alt incipit titles
        if (meta.alt_incipit_titles && Array.isArray(meta.alt_incipit_titles)) {
          meta.alt_incipit_titles.forEach((altGroup: Record<string, string>) => {
            Object.entries(altGroup).forEach(([lang, value]) => {
              instanceFormRef.current?.addAltIncipit(value, lang);
            });
          });
        }
      }

      setIsInitialized(true);
    }
  }, [instance, isInitialized, annotationData, segmentationAnnotationId]);

  // Handle file upload
  const handleFileUpload = (content: string, filename: string) => {
    let lines = content.split("\n");
    lines = lines.filter(line => line.trim() !== "");
    const cleanedContent = lines.join("\n");
    setEditedContent(cleanedContent);
    setUploadedFilename(filename);
  };

  // Handle text selection from editor (only instance-related types)
  const handleEditorTextSelect = (
    text: string,
    type: "title" | "alt_title" | "colophon" | "incipit" | "alt_incipit" | "person"
  ) => {
    switch (type) {
      case "colophon":
        instanceFormRef.current?.addColophon(text);
        break;
      case "incipit":
        instanceFormRef.current?.addIncipit(text);
        setTimeout(() => {
          setHasIncipitTitle(instanceFormRef.current?.hasIncipit() || false);
        }, 100);
        break;
      case "alt_incipit":
        instanceFormRef.current?.addAltIncipit(text);
        break;
      // Title, alt_title, and person are not handled in instance form
      default:
        break;
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (!text_id || !instance_id || !instance) {
        throw new Error("Missing required data");
      }

      if (!editedContent || editedContent.trim() === "") {
        throw new Error("Content cannot be empty");
      }

      // Get instance form data
      const instanceFormData = instanceFormRef.current?.getFormData();
      if (!instanceFormData) {
        throw new Error("Invalid instance form data");
      }

      // Calculate annotations from content (this also cleans the content - removes line breaks)
      const { annotations, cleanedContent } = calculateAnnotations(editedContent);

      // Prepare update payload
      const updatePayload = {
        metadata: instanceFormData.metadata,
        annotation: annotations,
        biblography_annotation: instanceFormData.biblography_annotation || [],
        content: cleanedContent, // Use cleaned content (without line breaks) for API
      };

      // Update instance
      await updateInstanceMutation.mutateAsync({
        textId: text_id,
        instanceId: instance_id,
        instanceData: updatePayload,
        user: JSON.stringify(user || {}),
      });

      clearAfterSubmission();
      setSuccess(true);

      // Navigate back after a short delay
      setTimeout(() => {
        navigate(`/texts/${text_id}/instances/${instance_id}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || t("messages.updateError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = textLoading || instanceLoading || annotationLoading;
  const cn = (...classes: Array<string | false | null | undefined>) => {
    return classes.filter(Boolean).join(" ");
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center z-40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t("loading.loadingText")}</p>
        </div>
      </div>
    );
  }

  if (!text || !instance) {
    return (
      <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Cannot load text or instance data</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Success Message */}
      {success && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-white rounded-lg shadow-lg border border-green-200 px-4 py-3 flex items-center gap-3 max-w-sm">
            <div className="w-5 h-5 text-green-500 flex-shrink-0">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-800">
              {t("messages.updateSuccess") || "Updated successfully!"}
            </span>
          </div>
        </div>
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

      {/* Loading Screen - Show while submitting */}
      {isSubmitting && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 flex items-center justify-center z-50">
          <div className="text-center max-w-md mx-auto px-6">
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full opacity-20 animate-ping"></div>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl shadow-2xl flex items-center justify-center">
                  <FileText className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-3 animate-pulse">
              Please Wait while we update the text
            </h2>
          </div>
        </div>
      )}

      {/* Two-Panel Layout */}
      <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex">
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
              <span className="text-sm font-medium">{t("editor.content")}</span>
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              <span className="text-sm font-medium">{t("common.edit")}</span>
            </>
          )}
        </button>

        {/* LEFT PANEL: Forms */}
        <div
          className={cn(
            "w-full md:w-1/2 h-full overflow-y-auto border-r border-gray-200",
            "absolute md:relative",
            "transition-transform duration-300 ease-in-out",
            activePanel === "form"
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="p-8">
            {/* Header */}
            <div className="mb-6 flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(`/texts/${text_id}/instances/${instance_id}`)}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("common.back")}
              </Button>
            
            </div>

            <div className="space-y-6 relative ">
              {/* Instance Creation Form */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <InstanceCreationForm
                  ref={instanceFormRef}
                  onSubmit={() => {
                    // Prevent form submission, handle it manually
                    handleSubmit();
                  }}
                  isSubmitting={isSubmitting}
                  content={editedContent}
                  disableSubmit={!!contentValidationError || segmentValidation.invalidCount > 0}
                  onCancel={() => navigate(`/texts/${text_id}/instances/${instance_id}`)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Editor */}
        <div
          className={cn(
            "w-full md:w-1/2 h-full overflow-hidden bg-gray-50",
            "absolute md:relative",
            "transition-transform duration-300 ease-in-out",
            activePanel === "editor"
              ? "translate-x-0"
              : "translate-x-full md:translate-x-0"
          )}
        >
          <div className="h-full flex flex-col">
            {/* Editor Header */}
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 ">
              <div className="flex items-center justify-between">
                {!editedContent || editedContent?.trim() === "" ? (
                  <>
                    <p className="text-sm text-gray-600 ">
                      {t("create.startTyping")}
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
                            if (file.size < 1024) {
                              alert(t("create.fileTooSmall"));
                              e.target.value = "";
                              return;
                            }
                            if (!file.name.endsWith(".txt")) {
                              alert(t("create.uploadTxtOnly"));
                              e.target.value = "";
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const content = event.target?.result as string;
                              handleFileUpload(content, file.name);
                            };
                            reader.readAsText(file);
                          }
                          e.target.value = "";
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
                        {t("create.uploadFile")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">
                    {editedContent?.length} {t("create.characters")}
                  </span>
                )}
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <TextEditorView
                content={editedContent || ""}
                filename={editedContent ? uploadedFilename : t("editor.editingDocument")}
                editable={true}
                onChange={(value) => setEditedContent(value)}
                onTextSelect={handleEditorTextSelect}
                isCreatingNewText={false}
                hasIncipit={hasIncipitTitle}
                hasTitle={false}
                allowedTypes={["colophon", "incipit", "alt_incipit"]}
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

export default UpdateAnnotation;
