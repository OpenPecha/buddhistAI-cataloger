import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, X,  FileText, Code, ArrowLeft, Loader2 } from "lucide-react";
import type { InstanceCreationFormRef } from "@/components/InstanceCreationForm";
import { useText, useInstance, useUpdateInstance, useAnnnotation, useUpdateText } from "@/hooks/useTexts";
import { useTranslation } from "react-i18next";
import { useAuth0 } from "@auth0/auth0-react";
import { useBibliographyAPI } from "@/hooks/useBibliographyAPI";
import { SegmentUpdateWrapper } from "@/components/segmentUpdate";
import type { OpenPechaText, Title as TitleType } from "@/types/text";
import Title from "@/components/formComponent/Title";
import AlternativeTitle from "@/components/formComponent/AlternativeTitle";
import Contributor, { type ContributorItem } from "@/components/formComponent/Contributor";
import Copyright from "@/components/formComponent/Copyright";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Person } from "@/types/person";
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';


const UpdateAnnotation = () => {
  const { text_id, instance_id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const instanceFormRef = useRef<InstanceCreationFormRef>(null);

  // Fetch text and instance data
  const { data: text, isLoading: textLoading ,isRefetching: textRefetching} = useText(text_id || "");
  const { data: instance, isLoading: instanceLoading ,isRefetching: instanceRefetching} = useInstance(instance_id || "");


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

  const [editedContent, setEditedContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"form" | "editor">("form");
  const [isInitialized, setIsInitialized] = useState(false);



  

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

   

      {/* Two-Panel Layout */}
      <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex overflow-hidden">
        {/* Mobile Toggle Button */}
        <button
          onClick={() =>
            setActivePanel(activePanel === "form" ? "editor" : "form")
          }
          className="md:hidden fixed bottom-6 right-6 z-30 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-full p-4 shadow-lg transition-all duration-200 flex items-center gap-2"
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


        <PanelGroup direction="horizontal" className="flex-1">
      <Panel defaultSize={35} minSize={25} className="min-h-0">
       {isFetching ? 
       (
         <div className="flex flex-col gap-4 p-6 h-full">
           <div className="bg-white rounded-lg shadow px-6 py-8 w-full animate-pulse">
             <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
             <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
             <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>

             <div className="h-5 bg-gray-200 rounded w-full mb-4"></div>
             <div className="h-10 bg-gray-200 rounded w-full mb-6"></div>

             <div className="h-5 bg-gray-200 rounded w-2/3 mb-4"></div>
             <div className="h-10 bg-gray-200 rounded w-full mb-6"></div>

             <div className="h-7 bg-gray-200 rounded w-24 mb-4"></div>
             <div className="h-12 bg-gray-200 rounded w-full"></div>
           </div>
         </div>
       )
       :(
       <UpdateTextForm text={text} activePanel={activePanel} />
       )}
      </Panel>
      
      {/* Resize handle between panels */}
      <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors duration-200 cursor-col-resize flex items-center justify-center group">
        <div className="w-0.5 h-8 bg-gray-400 rounded-full opacity-40 group-hover:opacity-100 group-hover:bg-blue-500 transition-all"></div>
      </PanelResizeHandle>
      
      <Panel defaultSize={65} minSize={30} className="min-h-0">
        {/* RIGHT PANEL: Editor */}
        <div
          className={cn(
            "w-[90%] mx-auto h-full overflow-hidden bg-gray-50",
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
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
           <SegmentUpdateWrapper
                content={instance?.content}
                annotationData={annotationData}
                />
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
      </Panel>
    </PanelGroup>

      </div>
    </>
  );
};

export default UpdateAnnotation;


const UpdateTextForm = ({ text, activePanel }: { text: OpenPechaText; activePanel: "form" | "editor" }) => {
  const { t } = useTranslation();
  const { text_id } = useParams();
  const updateTextMutation = useUpdateText();
  
  const [titles, setTitles] = useState<TitleType[]>([]);
  const [altTitles, setAltTitles] = useState<TitleType[][]>([]);
  const [bdrc, setBdrc] = useState("");
  const [wiki, setWiki] = useState("");
  const [copyright, setCopyright] = useState<string>("Unknown");
  const [license, setLicense] = useState<string>("unknown");
  const [contributors, setContributors] = useState<ContributorItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const cn = (...classes: Array<string | false | null | undefined>) => {
    return classes.filter(Boolean).join(" ");
  };

  // Initialize form with existing text data
  useEffect(() => {
    if (text) {
      // Initialize titles
      if (text.title) {
        const titleArray: TitleType[] = Object.entries(text.title).map(([lang, value]) => ({
          language: lang,
          value: value,
        }));
        setTitles(titleArray);
      }

      // Initialize alt_titles
      if (text.alt_titles && Array.isArray(text.alt_titles) && text.alt_titles.length > 0) {
        const altTitlesArray: TitleType[][] = text.alt_titles.map((altTitle) =>
          Object.entries(altTitle).map(([lang, value]) => ({
            language: lang,
            value: value,
          }))
        );
        setAltTitles(altTitlesArray);
      }

      // Initialize other fields
      if (text.bdrc) setBdrc(text.bdrc);
      if (text.wiki) setWiki(text.wiki);
    }
  }, [text]);

  // Initialize contributors - create minimal person objects from contribution data
  // Full person data will be fetched by Contributor component if needed
  useEffect(() => {
    if (text?.contributions && Array.isArray(text.contributions)) {
      const contributorsArray: ContributorItem[] = text.contributions.map((contrib) => {
        // Create minimal person object from contribution data
        // The Contributor component can fetch full person data if needed
        const person: Person = {
          id: contrib.person_id || "",
          bdrc: contrib.person_bdrc_id || "",
          name: contrib.person_name || {},
          alt_names: null,
          wiki: null,
        };

        return {
          person,
          role: contrib.role as "translator" | "author",
        };
      });
      
      setContributors(contributorsArray);
    }
  }, [text]);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (!text_id) {
        throw new Error("Missing text ID");
      }

      // Build title object from titles array
      const title: Record<string, string> = {};
      titles.forEach((titleEntry) => {
        if (titleEntry.language && titleEntry.value.trim()) {
          title[titleEntry.language] = titleEntry.value.trim();
        }
      });

      // Build contributions array
      const contributionsArray = contributors?.map((contributor) => {
        const personBdrcId = contributor.person!.bdrc || contributor.person!.id;
        return {
          person_bdrc_id: personBdrcId,
          person_id: contributor.person!.id,
          role: contributor.role,
        };
      });

      // Build update payload (only include fields that have values)
      const updatePayload: any = {};

      if (Object.keys(title).length > 0) {
        updatePayload.title = title;
      }
      if (bdrc.trim()) {
        updatePayload.bdrc = bdrc.trim();
      }
      if (wiki.trim()) {
        updatePayload.wiki = wiki.trim();
      }
      if (copyright && copyright !== "Unknown") {
        updatePayload.copyright = copyright.trim();
      }
      if (license && license !== "unknown") {
        updatePayload.license = license.trim();
      }
      
      if (contributionsArray && contributionsArray.length > 0) {
        updatePayload.contributions = contributionsArray;
      }
      // Note: alt_title in UpdateText is Dict[str, List[str]], but we're using alt_titles format
      // We'll convert it if needed, but for now skip it as it's a different format

      await updateTextMutation.mutateAsync({
        textId: text_id,
        textData: updatePayload,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || t("messages.updateError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        " mx-auto h-full overflow-y-auto bg-white",
        "absolute md:relative",
        "transition-transform duration-300 ease-in-out",
        activePanel === "form"
          ? "translate-x-0"
          : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold text-gray-800">{t("common.updateText") || "Update Text"}</h2>
          <p className="text-sm text-gray-600 mt-1">{t("common.updateTextDescription") || "Update text metadata"}</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
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
              {t("messages.updateSuccess") || "Text updated successfully!"}
            </span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-800">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Title Field */}
        <div>
          <Title setTitles={setTitles} errors={undefined} initialTitles={titles} />
        </div>

        {/* Alternative Titles Field */}
        <div>
          <AlternativeTitle altTitles={altTitles} setAltTitles={setAltTitles} titles={titles} />
        </div>

        {/* BDRC Field */}
        <div>
          <Label htmlFor="bdrc" className="mb-2">
            {t("textForm.bdrcWorkId")}
          </Label>
          <Input
            id="bdrc"
            type="text"
            value={bdrc}
            onChange={(e) => setBdrc(e.target.value)}
            placeholder={t("textForm.enterBdrcId") || "Enter BDRC Work ID"}
          />
        </div>

        {/* Wiki Field */}
        <div>
          <Label htmlFor="wiki" className="mb-2">
            {t("wiki") || "Wiki"}
          </Label>
          <Input
            id="wiki"
            type="text"
            value={wiki}
            onChange={(e) => setWiki(e.target.value)}
          />
        </div>

     

        {/* Copyright and License */}
        <div>
          <Copyright
            copyright={copyright}
            setCopyright={setCopyright}
            license={license}
            setLicense={setLicense}
          />
        </div>

        {/* Contributors */}
        <div>
          <Contributor
            contributors={contributors}
            setContributors={setContributors}
          />
        </div>

        {/* Submit Button */}
        <div className="flex gap-4 pt-4 border-t">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t("common.saving") || "Saving..."}
              </>
            ) : (
              t("common.save") || "Save"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};