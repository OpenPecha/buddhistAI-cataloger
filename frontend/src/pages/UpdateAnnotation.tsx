import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, X,  FileText, Code, ArrowLeft, Loader2 } from "lucide-react";
import type { InstanceCreationFormRef } from "@/components/InstanceCreationForm";
import {
  useText,
  useInstance,
  useAnnnotation,
  usePostEditionSegmentations,
  useUpdateEditionContent,
} from "@/hooks/useTexts";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import type { EditionSegmentationsPayload } from "@/api/texts";
import { SkeletonLarger } from "@/components/ui/skeleton";


function reconstructContentWithSegmentation(
  content: string,
  annotationData: unknown
): string {
  if (!content) return "";

  const segmentationAnnotations = (annotationData as { data?: unknown[] })?.data;
  if (
    !segmentationAnnotations ||
    !Array.isArray(segmentationAnnotations) ||
    segmentationAnnotations.length === 0
  ) {
    return content;
  }

  type Ann = { span?: { start: number; end: number } };
  const sortedAnnotations = [...(segmentationAnnotations as Ann[])].sort(
    (a, b) => (a.span?.start || 0) - (b.span?.start || 0)
  );

  const lines = sortedAnnotations.map((annotation) => {
    if (!annotation.span) return "";
    return content.substring(annotation.span.start, annotation.span.end);
  });

  return lines.join("\n");
}

function buildSegmentationsPayload(
  fullContent: string,
  editorText: string
): EditionSegmentationsPayload {
  const parts = editorText.split("\n");
  if (parts.join("") !== fullContent) {
    throw new Error(
      "The text must match the edition content exactly; use line breaks only to mark segment boundaries."
    );
  }
  let offset = 0;
  const segments = parts.map((part) => {
    const lines = [{ start: offset, end: offset + part.length }];
    offset += part.length;
    return { lines };
  });
  return { segments, metadata: {} };
}

const UpdateAnnotation = () => {
  const { text_id, edition_id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const instanceFormRef = useRef<InstanceCreationFormRef>(null);
  const postSegmentations = usePostEditionSegmentations();
  const updateEditionContentMutation = useUpdateEditionContent();

  // Fetch text and instance data
  const { data: text, isLoading: textLoading ,isRefetching: textRefetching} = useText(text_id || "");
  const { data: instance, isLoading: instanceLoading ,isRefetching: instanceRefetching} = useInstance(edition_id || "");


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
    isRefetching: annotationRefetching,
  } = useAnnnotation(segmentationAnnotationId);
  // State

  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"form" | "editor">("form");
  const [isInitialized, setIsInitialized] = useState(false);
  const [segmentEditorValue, setSegmentEditorValue] = useState("");
  const [segmentEditorReady, setSegmentEditorReady] = useState(false);



  useEffect(() => {
    setSegmentEditorReady(false);
  }, [edition_id, segmentationAnnotationId]);

  useEffect(() => {
    if (!instance || segmentEditorReady) return;
    if (segmentationAnnotationId && annotationLoading) return;
    const raw = instance.content ?? "";
    setSegmentEditorValue(
      reconstructContentWithSegmentation(raw, annotationData)
    );
    setSegmentEditorReady(true);
  }, [
    instance,
    annotationData,
    annotationLoading,
    segmentationAnnotationId,
    segmentEditorReady,
  ]);

  // Initialize forms with existing data
  useEffect(() => {
    if (
      instance &&
      !isInitialized &&
      instanceFormRef.current &&
      (annotationData || !segmentationAnnotationId) // Wait for annotation if it exists
    ) {
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

 

  

  const isLoading = textLoading || instanceLoading || annotationLoading ;
  const isFetching = textRefetching || instanceRefetching || annotationRefetching;
  const cn = (...classes: Array<string | false | null | undefined>) => {
    return classes.filter(Boolean).join(" ");
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin"  />
          <p className="text-gray-600">Loading text and instance data...</p>
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

   

        <div
          className={cn(
            "container mt-2 mx-auto h-full overflow-hidden bg-gray-50",
            "absolute md:relative",
            "transition-transform duration-300 ease-in-out",
            activePanel === "editor"
              ? "translate-x-0"
              : "translate-x-full md:translate-x-0"
          )}
        > 
          <div className="h-full flex flex-col">
        
            {/* Editor Header */}
            <div className=" px-4 py-3 ">
              <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => navigate(`/texts/${text_id}/editions/${edition_id}`)}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("common.back")}
      </Button>
              <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  updateEditionContentMutation.isPending ||
                  postSegmentations.isPending ||
                  !segmentEditorReady
                }
                onClick={async () => {
                  if (!edition_id || !instance) return;
                  setError(null);
                  // Show confirm dialog before updating content
                  const confirmed = window.confirm(
                      "Are you sure you want to replace the edition content? This will overwrite the current text."
                  );
                  if (!confirmed) return;

                  const previous = instance.content ?? "";
                  try {
                    await updateEditionContentMutation.mutateAsync({
                      editionId: edition_id,
                      content: segmentEditorValue,
                      start: 0,
                      end: previous.length,
                    });
                    setSegmentEditorReady(false);
                  } catch (e: unknown) {
                    const msg =
                      e instanceof Error ? e.message : t("messages.updateError");
                    setError(msg);
                  }
                }}
        
              >
                {updateEditionContentMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t("common.saving") ?? "Saving…"}
                  </>
                ) : (
                  "update content"
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={postSegmentations.isPending || !segmentEditorReady}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
                onClick={async () => {
                  if (!edition_id || !instance) return;
                  setError(null);
                  try {
                    const payload = buildSegmentationsPayload(
                      instance.content ?? "",
                      segmentEditorValue
                    );
                    await postSegmentations.mutateAsync({
                      editionId: edition_id,
                      payload,
                    });
                  } catch (e: unknown) {
                    const msg =
                      e instanceof Error ? e.message : t("messages.updateError");
                    setError(msg);
                  }
                }}
              >
                {postSegmentations.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t("common.saving") ?? "Saving…"}
                  </>
                ) : (
                  "new segmentation"
                )}
              </Button>
              </div>
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              {isFetching ? (
                <SkeletonLarger />
              ) : (
                <div className="h-full px-4 pb-4 flex flex-col min-h-0">
                  <Textarea
                    className="flex-1 min-h-[50vh] font-monlam text-base leading-relaxed resize-none"
                    spellCheck={false}
                    value={segmentEditorValue}
                    onChange={(e) => setSegmentEditorValue(e.target.value)}
                    readOnly={!segmentEditorReady}
                    placeholder={
                      segmentEditorReady
                        ? undefined
                        : "Loading edition text…"
                    }
                  />
                </div>
              )}
            {isLoading && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/20 bg-opacity-60">
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-10 w-10 text-white mb-4" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-20"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-80"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  <span className="text-white text-lg font-medium">Loading...</span>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

    </>
  );
};

export default UpdateAnnotation;

