import { useLanguage } from "@/hooks/useEnum";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LanguageSelectorFormProps {
  language: string;
  setLanguage: (language: string) => void;
}

interface LanguageOption {
  code: string;
  name: string;
}

function LanguageSelectorForm({ language, setLanguage }: LanguageSelectorFormProps) {
  const { data: LANGUAGE_OPTIONS, isLoading: isLoadingLanguageOptions } =
    useLanguage();

  const { t } = useTranslation();
  
  return (
    <div className="relative w-full">
      <select
        value={language || ''}
        onChange={(e) => setLanguage(e.target.value)}
        disabled={isLoadingLanguageOptions}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
        required
      >
        <option value="">
          {isLoadingLanguageOptions ? t("textForm.loading") : t("textForm.selectLanguage")}
        </option>
        {!isLoadingLanguageOptions &&
          LANGUAGE_OPTIONS &&
          LANGUAGE_OPTIONS.map((lang: LanguageOption) => (
            <option key={lang.code} value={lang.code} className="capitalize">
              {lang.name}
            </option>
          ))}
      </select>
      {isLoadingLanguageOptions && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}

export default LanguageSelectorForm;
