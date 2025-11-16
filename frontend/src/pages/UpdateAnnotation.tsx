import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, ArrowLeft, Save } from "lucide-react";
import TextEditorView from "@/components/text-creation/TextEditorView";
import { updateAnnotation } from "@/api/texts";
import { calculateAnnotations } from "@/utils/annotationCalculator";
import { useTranslation } from "react-i18next";
import { useInstance, useAnnnotation } from "@/hooks/useTexts";
import type { OpenPechaTextInstance } from "@/types/text";
import { useQueryClient } from "@tanstack/react-query";

const UpdateAnnotation = () => {
  const { text_id, instance_id } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Fetch instance data
  const { data: instance, isLoading: instanceLoading } = useInstance(
    instance_id || ""
  );

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
    error: annotationError,
  } = useAnnnotation(segmentationAnnotationId);

  // State for editable segmentation content (with line breaks)
  const [segmentedContent, setSegmentedContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize segmented content from annotation when both instance and annotation are loaded
  useEffect(() => {
    if (instance && annotationData && instance.content) {
      const annotations = (annotationData as any)?.data;

      if (annotations && Array.isArray(annotations) && annotations.length > 0) {
        // Sort annotations by span start position
        const sortedAnnotations = [...annotations].sort((a: any, b: any) => {
          return (a.span?.start || 0) - (b.span?.start || 0);
        });

        // Extract each segment and join with newlines
        const lines = sortedAnnotations.map((annotation: any) => {
          if (!annotation.span) return "";
          return instance.content.substring(
            annotation.span.start,
            annotation.span.end
          );
        });

        setSegmentedContent(lines.join("\n"));
      } else {
        // No segmentation exists, show content as single line
        setSegmentedContent(instance.content);
      }
    }
  }, [instance, annotationData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!instance || !instance.content) {
        throw new Error("Instance content not available");
      }

      if (!segmentationAnnotationId) {
        throw new Error("No segmentation annotation found for this instance");
      }

      if (!segmentedContent || segmentedContent.trim() === "") {
        throw new Error("Segmentation content cannot be empty");
      }

      // Validate that base text content hasn't changed (only line breaks should differ)
      // Remove all line breaks and compare with original content
      const cleanedSegmented = segmentedContent.split("\n").join("");
      const originalContent = instance.content;

      if (cleanedSegmented !== originalContent) {
        throw new Error(
          "You can only modify segmentation (line breaks), not the base text content. Please restore the original text."
        );
      }

      // Calculate new segmentation spans from the edited content
      const { annotations } = calculateAnnotations(segmentedContent);

      // Prepare update payload
      const updatePayload = {
        type: "segmentation",
        data: {
          annotations: annotations,
        },
      };

      // Update annotation
      await updateAnnotation(segmentationAnnotationId, updatePayload);

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["annotation"] });
      queryClient.invalidateQueries({ queryKey: ["instance", instance_id] });
      if (text_id) {
        queryClient.invalidateQueries({ queryKey: ["textInstance", text_id] });
      }
      setSuccess(true);

      // Navigate back after a short delay
      setTimeout(() => {
        navigate(`/texts/${text_id}/instances/${instance_id}`);
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.message || t("messages.updateError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInstanceTitle = (
    instance: OpenPechaTextInstance | undefined
  ): string => {
    if (!instance || !instance.metadata) return t("header.instances");

    let title = "";

    if (
      instance.metadata.incipit_title &&
      typeof instance.metadata.incipit_title === "object"
    ) {
      const incipitObj = instance.metadata.incipit_title as Record<
        string,
        string
      >;
      if (incipitObj.bo) {
        title = incipitObj.bo;
      } else {
        const firstLanguage = Object.keys(incipitObj)[0];
        if (firstLanguage) {
          title = incipitObj[firstLanguage];
        }
      }
    }

    if (!title) {
      title = instance.metadata.colophon
        ? `Text Instance (${instance.metadata.colophon})`
        : "Text Instance";
    }

    return title;
  };

  const isLoading = instanceLoading || annotationLoading;
  const hasError =
    annotationError ||
    (!segmentationAnnotationId && instance && !instanceLoading);

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
              Annotation updated successfully!
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
      {/* Main Split Layout */}
      <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gray-50 flex ">
        {/* LEFT PANEL: Info and Controls */}

        {isLoading && (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
        )}
        {/* RIGHT PANEL: Text Editor */}
        <div className="w-full  h-full overflow-hidden bg-gray-50 relative">
          {hasError && (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Cannot load annotation editor</p>
              </div>
            </div>
          )}

          <div className=" flex flex-col">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-2 py-1  ">
                <div className="flex items-center gap-2" >
<ArrowLeft className="w-4 h-4 ml-4" onClick={() => navigate(`/texts/${text_id}/instances/${instance_id}`)}/>
              <p className="text-sm text-gray-600">
                Edit segmentation by adding/removing line breaks
              </p>
                </div>
               

                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !segmentedContent}
                  variant="outline"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Update
                    </>
                  )}
                </Button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <TextEditorView
                content={segmentedContent || ""}
                filename="Segmentation Editor"
                editable={true}
                onChange={(value) => {
                  setSegmentedContent(value);
                }}
                onTextSelect={undefined}
                isCreatingNewText={false}
                hasIncipit={false}
                hasTitle={false}
                allowedTypes={[]}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UpdateAnnotation;
