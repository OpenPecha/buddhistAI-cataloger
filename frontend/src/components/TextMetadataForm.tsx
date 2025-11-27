import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/useEnum";
import { useUpdateTitleAndLicense } from "@/hooks/useTexts";

interface TextMetadataFormProps {
  textId: string;
  textLanguage: string; // The text's primary language - only this title can be edited
  initialTitle: string; // Initial title value for the text's language
  initialLicense?: string;
  onSuccess?: () => void;
}

const LICENSE_OPTIONS = [
  { value: "unknown", labelKey: "textForm.licenseUnknown" },
  { value: "CC0", labelKey: "textForm.licenseCC0" },
  { value: "Public Domain Mark", labelKey: "textForm.licensePublicDomainMark" },
  { value: "CC BY", labelKey: "textForm.licenseCCBY" },
  { value: "CC BY-SA", labelKey: "textForm.licenseCCBYSA" },
  { value: "CC BY-ND", labelKey: "textForm.licenseCCBYND" },
  { value: "CC BY-NC", labelKey: "textForm.licenseCCBYNC" },
  { value: "CC BY-NC-SA", labelKey: "textForm.licenseCCBYNCSA" },
  { value: "CC BY-NC-ND", labelKey: "textForm.licenseCCBYNCND" },
  { value: "under copyright", labelKey: "textForm.licenseUnderCopyright" },
];

function TextMetadataForm({
  textId,
  textLanguage,
  initialTitle,
  initialLicense = "",
  onSuccess,
}: TextMetadataFormProps) {
  const { t } = useTranslation();
  const { data: languages, isLoading: languagesLoading } = useLanguage();
  const updateMutation = useUpdateTitleAndLicense();

  // State for the single title (only text's language is editable)
  const [titleValue, setTitleValue] = useState<string>(initialTitle);
  const [license, setLicense] = useState<string>(initialLicense);

  // Initialize from props
  useEffect(() => {
    setTitleValue(initialTitle || "");
    setLicense(initialLicense || "");
  }, [initialTitle, initialLicense]);

  // Check if form has valid data for submission
  const hasValidData = useMemo(() => {
    const hasNonEmptyTitle = titleValue.trim() !== "";
    const hasLicense = license && license !== "";
    return hasNonEmptyTitle || hasLicense;
  }, [titleValue, license]);

  // Check if form is dirty (changed from initial values)
  const isDirty = useMemo(() => {
    // Check if license changed
    if (license !== (initialLicense || "")) return true;
    // Check if title changed
    if (titleValue.trim() !== (initialTitle || "").trim()) return true;
    return false;
  }, [titleValue, license, initialTitle, initialLicense]);

  // Handle title value change
  const handleTitleChange = (value: string) => {
    setTitleValue(value);
  };

  // Handle cancel - reset to initial values
  const handleCancel = () => {
    setTitleValue(initialTitle || "");
    setLicense(initialLicense || "");
  };

  // Handle update submission
  const handleUpdate = async () => {
    // Build title object with only the text's language
    const titleObj: { [key: string]: string } = {};
    if (titleValue.trim()) {
      titleObj[textLanguage] = titleValue.trim();
    }

    try {
      await updateMutation.mutateAsync({
        textId,
        title: titleObj,
        license: license || "",
      });
      onSuccess?.();
    } catch (error) {
      // Error handling is done by the mutation
      console.error("Failed to update text metadata:", error);
    }
  };

  // Get language name from language code
  const getLanguageName = (langCode: string): string => {
    if (!languages || !Array.isArray(languages)) return langCode;
    const lang = languages.find(
      (l: { code: string; name: string }) => l.code === langCode
    );
    return lang?.name || langCode;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Header */}
      <h3 className="text-lg font-semibold text-gray-800 mb-4 font-['noto']">
        {t("textForm.updateTextMetadata") || "Update Text Metadata"}
      </h3>

      {/* Title Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2 font-['noto']">
          {t("textForm.title") || "Title"}
        </label>

        {/* Single Title Entry - Only text's language is editable */}
        <div className="flex items-center gap-2">
          {/* Language Label - Shows language name */}
          <div className="w-28 px-3 py-2 bg-gray-100 rounded-md text-sm text-gray-600 font-['noto']">
            {languagesLoading ? (
              <div className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
              </div>
            ) : (
              getLanguageName(textLanguage)
            )}
          </div>

          {/* Title Input */}
          <Input
            value={titleValue}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={t("textForm.enterTitle") || "Enter title..."}
            className="flex-1"
          />
        </div>

       
      </div>

      {/* License Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2 font-['noto']">
          {t("textForm.license") || "License"}
        </label>
        <Select value={license} onValueChange={setLicense}>
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={t("textForm.selectLicense") || "Select license..."}
            />
          </SelectTrigger>
          <SelectContent>
            {LICENSE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey) || option.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={updateMutation.isPending}
          className="font-['noto']"
        >
          {t("common.cancel") || "Cancel"}
        </Button>
        <Button
          type="button"
          onClick={handleUpdate}
          disabled={!hasValidData || !isDirty || updateMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white font-['noto']"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("common.updating") || "Updating..."}
            </>
          ) : (
            t("common.update") || "Update"
          )}
        </Button>
      </div>

      {/* Success Message */}
      {updateMutation.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700 font-['noto']">
            {t("messages.updateSuccess") || "Updated successfully!"}
          </p>
        </div>
      )}

      {/* Error Message */}
      {updateMutation.isError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700 font-['noto']">
            {updateMutation.error?.message ||
              t("messages.updateError") ||
              "Failed to update. Please try again."}
          </p>
        </div>
      )}
    </div>
  );
}

export default TextMetadataForm;

