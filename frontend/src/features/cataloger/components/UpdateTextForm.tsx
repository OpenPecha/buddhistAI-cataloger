import { useText, useUpdateText } from "@/hooks/useTexts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { coerceLicense, type LicenseType, type Title as TitleType, type UpdateTextPayload } from "@/types/text";
import Title from "@/components/formComponent/Title";
import AlternativeTitle from "@/components/formComponent/AlternativeTitle";
import Copyright from "@/components/formComponent/Copyright";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MultilevelCategorySelector } from "@/components/MultilevelCategorySelector";


export const UpdateTextForm = () => {
    const { t } = useTranslation();
    const { text_id } = useParams<{ text_id: string }>();
    const updateTextMutation = useUpdateText();
    const { data: text } = useText(text_id ?? "");
    const [titles, setTitles] = useState<TitleType[]>([]);
    const [altTitles, setAltTitles] = useState<TitleType[][]>([]);
    const [bdrc, setBdrc] = useState("");
    const [wiki, setWiki] = useState("");
    const [copyright, setCopyright] = useState<string>("Unknown");
    const [license, setLicense] = useState<LicenseType>("public");
    const [categoryId, setCategoryId] = useState<string>("");
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
        if (text.category_id) setCategoryId(text.category_id);
        setLicense(coerceLicense(text.license));
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
  
      
  
        // Build update payload (only include fields that have values)
        const updatePayload: UpdateTextPayload = {};
  
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
        updatePayload.license = license;
        if (categoryId) {
          updatePayload.category_id = categoryId;
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
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : t("messages.updateError")
        );
      } finally {
        setIsSubmitting(false);
      }
    };
  
    return (
      <div
        className={cn(
          "container mx-auto h-full overflow-y-auto bg-white",
          "absolute md:relative",
          "transition-transform duration-300 ease-in-out",
        )}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="border-b pb-4">
            <h2 className="text-2xl font-bold text-gray-800">{t("common.updateText") || "Update Text"}</h2>
            <p className="text-sm text-gray-600 mt-1">{t("common.updateTextDescription") || "Update text detail"}</p>
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
          <MultilevelCategorySelector
            onCategorySelect={(id) => {
              setCategoryId(id);
            }}
            selectedCategoryId={categoryId}
          />
  
        
  
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