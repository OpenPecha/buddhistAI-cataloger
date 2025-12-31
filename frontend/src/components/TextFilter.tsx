import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useLanguage } from '@/hooks/useEnum';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLanguageLabel } from "@/utils/getLanguageLabel";

type Param = {
  title: string;
  type: string;
  language: string;
  author: string;
};

type PropTextFilter = {
  readonly param: Param;
  readonly setParam: (param: Param) => void;
  readonly clearSearch: () => void;
};

const TYPE_OPTIONS = [
  { value: "none", label: "All Types" },
  { value: "root", label: "Root" },
  { value: "commentary", label: "Commentary" },
  { value: "translation", label: "Translation" },
  { value: "translation_source", label: "Translation Source" },
];

function TextFilter({ param, setParam, clearSearch }: PropTextFilter) {
  const { t } = useTranslation();
  const [textSearch, setTextSearch] = useState("");
  const { data: LANGUAGE_OPTIONS, isLoading: isLoadingLanguageOptions } = useLanguage();

  // When param.title changes externally, update input value
  useEffect(() => {
    setTextSearch(param.title || "");
  }, [param.title]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (param.title !== textSearch) {
        setParam({ ...param, title: textSearch });
      }
    }, 300);
    return () => clearTimeout(handler);
    // Only responds to changes in textSearch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textSearch]);

  const hasActiveFilters = textSearch || param.language || (param.type && param.type !== "none");

  const handleClearAll = () => {
    setTextSearch("");
    clearSearch();
  };

  return (
    <div className="space-y-3">
      {/* Search and Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            id="text-search"
            type="text"
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
            className="w-full px-3 py-2 pr-8 border bg-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t("create.searchPlaceholder")}
          />
        </div>

        {/* Language Filter */}
        <div className="w-full sm:w-48">
          <Select
            value={param.language || undefined}
            onValueChange={(value) => {
              // Use a special "all" value to clear the filter
              if (value === "all") {
                setParam({ ...param, language: "" });
              } else {
                setParam({ ...param, language: value });
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("textForm.selectLanguage") || "Language"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("textForm.selectLanguage") || "All Languages"}</SelectItem>
              {!isLoadingLanguageOptions &&
                LANGUAGE_OPTIONS?.map((lang: { code: string; name: string }) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Type Filter */}
        <div className="w-full sm:w-48">
          <Select
            value={param.type || "none"}
            onValueChange={(value) => setParam({ ...param, type: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clear All Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 transition-colors flex items-center gap-2 whitespace-nowrap"
            title="Clear all filters"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {textSearch && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
              Title: {textSearch}
              <button
                type="button"
                onClick={() => setTextSearch("")}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {param.language && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm">
              Language: {getLanguageLabel(param.language)}
              <button
                type="button"
                onClick={() => setParam({ ...param, language: "" })}
                className="hover:text-green-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {param.type && param.type !== "none" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-sm">
              Type: {TYPE_OPTIONS.find(opt => opt.value === param.type)?.label || param.type}
              <button
                type="button"
                onClick={() => setParam({ ...param, type: "none" })}
                className="hover:text-purple-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default TextFilter
