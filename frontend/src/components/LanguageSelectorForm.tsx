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
  return <>
   {isLoadingLanguageOptions && (
                    <div className="w-20 sm:w-32 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
  <select
      value={language || ''}
      onChange={(e) => setLanguage(e.target.value)}
      className="w-full px-3  py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      required
      >
        <option value="">{t("textForm.selectLanguage")}</option>
      {!isLoadingLanguageOptions &&
        LANGUAGE_OPTIONS &&
        LANGUAGE_OPTIONS.map((lang: LanguageOption) => (
          <option key={lang.code} value={lang.code} className="capitalize">
            {lang.name}
          </option>
        ))}
    </select>
        </>
  
}

export default LanguageSelectorForm;
