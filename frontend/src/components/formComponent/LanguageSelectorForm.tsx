import { useLanguage } from "@/hooks/useEnum";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <Select 
        value={language || undefined} 
        onValueChange={setLanguage}
      >
        <SelectTrigger 
          className="w-full"
          disabled={isLoadingLanguageOptions}
        >
          <SelectValue placeholder={isLoadingLanguageOptions ? t("textForm.loading") : t("textForm.selectLanguage")} />
        </SelectTrigger>
        <SelectContent>
          {!isLoadingLanguageOptions &&
            LANGUAGE_OPTIONS?.map((lang: LanguageOption) => (
              <SelectItem key={lang.code} value={lang.code} className="capitalize">
                {lang.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {isLoadingLanguageOptions && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}

export default LanguageSelectorForm;
