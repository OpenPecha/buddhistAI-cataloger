import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X, Loader2 } from "lucide-react";
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
  initialTitle: { [key: string]: string };
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
  initialTitle,
  initialLicense = "",
  onSuccess,
}: TextMetadataFormProps) {
  const { t } = useTranslation();
  const { data: languages, isLoading: languagesLoading } = useLanguage();
  const updateMutation = useUpdateTitleAndLicense();

  // State for titles (array of {lang, value} for easier manipulation)
  const [titleEntries, setTitleEntries] = useState<
    Array<{ lang: string; value: string }>
  >([]);
  const [license, setLicense] = useState<string>(initialLicense);
  const [selectedNewLang, setSelectedNewLang] = useState<string>("");

  // Initialize title entries from initialTitle
  useEffect(() => {
    if (initialTitle && Object.keys(initialTitle).length > 0) {
      const entries = Object.entries(initialTitle).map(([lang, value]) => ({
        lang,
        value,
      }));
      setTitleEntries(entries);
    }
    setLicense(initialLicense || "");
  }, [initialTitle, initialLicense]);

  // Get used languages to prevent duplicates
  const usedLanguages = useMemo(() => {
    return new Set(titleEntries.map((entry) => entry.lang));
  }, [titleEntries]);

  // Filter available languages (exclude already used ones)
  const availableLanguages = useMemo(() => {
    if (!languages || !Array.isArray(languages)) return [];
    return languages.filter(
      (lang: { code: string }) => !usedLanguages.has(lang.code)
    );
  }, [languages, usedLanguages]);
  // Check if form has valid data for submission
  const hasValidData = useMemo(() => {
    const hasNonEmptyTitle = titleEntries.some(
      (entry) => entry.value.trim() !== ""
    );
    const hasLicense = license && license !== "";
    return hasNonEmptyTitle || hasLicense;
  }, [titleEntries, license]);

  // Check if form is dirty (changed from initial values)
  const isDirty = useMemo(() => {
    // Check if license changed
    if (license !== (initialLicense || "")) return true;

    // Check if titles changed
    const currentTitleObj: { [key: string]: string } = {};
    titleEntries.forEach((entry) => {
      if (entry.value.trim()) {
        currentTitleObj[entry.lang] = entry.value;
      }
    });

    const initialKeys = Object.keys(initialTitle || {});
    const currentKeys = Object.keys(currentTitleObj);

    if (initialKeys.length !== currentKeys.length) return true;

    for (const key of initialKeys) {
      if (currentTitleObj[key] !== initialTitle[key]) return true;
    }

    return false;
  }, [titleEntries, license, initialTitle, initialLicense]);

  // Handle title value change
  const handleTitleChange = (index: number, value: string) => {
    setTitleEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value };
      return updated;
    });
  };

  // Handle remove title entry
  const handleRemoveTitle = (index: number) => {
    setTitleEntries((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle add new title entry
  const handleAddTitle = () => {
    if (!selectedNewLang) return;
    setTitleEntries((prev) => [...prev, { lang: selectedNewLang, value: "" }]);
    setSelectedNewLang("");
  };

  // Handle cancel - reset to initial values
  const handleCancel = () => {
    if (initialTitle && Object.keys(initialTitle).length > 0) {
      const entries = Object.entries(initialTitle).map(([lang, value]) => ({
        lang,
        value,
      }));
      setTitleEntries(entries);
    } else {
      setTitleEntries([]);
    }
    setLicense(initialLicense || "");
    setSelectedNewLang("");
  };

  // Handle update submission
  const handleUpdate = async () => {
    // Build title object, filtering out empty entries
    const titleObj: { [key: string]: string } = {};
    titleEntries.forEach((entry) => {
      if (entry.value.trim()) {
        titleObj[entry.lang] = entry.value.trim();
      }
    });

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

  // Get language label from language code
  const getLanguageLabel = (langCode: string) => {
    if (!languages || !Array.isArray(languages)) return langCode;
    const lang = languages.find(
      (l: { value: string; label: string }) => l.value === langCode
    );
    return lang?.label || langCode;
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

        {/* Existing Title Entries */}
        <div className="space-y-2 mb-3">
          {titleEntries.map((entry, index) => (
            <div key={`${entry.lang}-${index}`} className="flex items-center gap-2">
              {/* Language Label */}
              <div className="w-24 px-3 py-2 bg-gray-100 rounded-md text-sm text-gray-600 font-['noto']">
                {getLanguageLabel(entry.lang)}
              </div>

              {/* Title Input */}
              <Input
                value={entry.value}
                onChange={(e) => handleTitleChange(index, e.target.value)}
                placeholder={t("textForm.enterTitle") || "Enter title..."}
                className="flex-1"
              />

              {/* Remove Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveTitle(index)}
                className="text-gray-400 hover:text-red-500 p-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* languages loading */}
        {languagesLoading && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("common.loading") || "Loading..."}
          </div>
        )}
        {/* Add New Title */}
        {availableLanguages.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedNewLang} onValueChange={setSelectedNewLang}>
              <SelectTrigger className="w-40">
                <SelectValue
                  placeholder={
                    languagesLoading
                      ? t("common.loading") || "Loading..."
                      : t("textForm.selectLanguage") || "Select language"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map((lang: { code: string; name: string }) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddTitle}
              disabled={!selectedNewLang}
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              {t("textForm.addTitle") || "Add Title"}
            </Button>
          </div>
        )}

        {/* Empty state */}
        {titleEntries.length === 0 && availableLanguages.length === 0 && (
          <p className="text-sm text-gray-500 italic font-['noto']">
            {t("textForm.noLanguagesAvailable") || "No languages available"}
          </p>
        )}
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

