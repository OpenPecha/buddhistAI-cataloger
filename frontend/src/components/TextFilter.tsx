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
import { Input } from './ui/input';
import { MultilevelCategorySelector } from '@/components/MultilevelCategorySelector';
import { Button } from './ui/button';
import { useSearchParams } from 'react-router-dom';

function TextFilter() {
  const [params, setParams] = useSearchParams();
  const { t } = useTranslation();

  // Manage param state influenced by URL SearchParams
  const param = {
    language: params.get("language") || "",
    categoryId: params.get("categoryId") || "",
    categoryTitle: params.get("categoryTitle") || "",
  };

  // Setters for each filter param
  const setParam = (newParam: typeof param) => {
    setParams(params => {
      if ('language' in newParam) {
        if (newParam.language) {
          params.set("language", newParam.language);
        } else {
          params.delete("language");
        }
      }
      if ('categoryId' in newParam) {
        if (newParam.categoryId) {
          params.set("categoryId", newParam.categoryId);
        } else {
          params.delete("categoryId");
        }
      }
      if ('categoryTitle' in newParam) {
        if (newParam.categoryTitle) {
          params.set("categoryTitle", newParam.categoryTitle);
        } else {
          params.delete("categoryTitle");
        }
      }
      return params;
    });
  };

  // Search input
  const textSearch = params.get("title") || "";
  const setTextSearch = (value: string) => {
    setParams(params => {
      if (value) {
        params.set("title", value);
      } else {
        params.delete("title");
      }
      return params;
    });
  };

  // Language options
  const { data: LANGUAGE_OPTIONS, isLoading: isLoadingLanguageOptions } = useLanguage();

  // Clear all filters at once
  const handleClearAll = () => {
    setParams(params => {
      params.delete("title");
      params.delete("language");
      params.delete("categoryId");
      params.delete("categoryTitle");
      return params;
    });
  };

  // Checks
  const hasActiveFilters =
    !!textSearch || !!param.language || !!param.categoryId;

  return (
    <div className="space-y-3">
      {/* Search and Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Input
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
              <SelectItem value="all">
                {t("textForm.selectLanguage") || "All Languages"}
              </SelectItem>
              {!isLoadingLanguageOptions &&
                Array.isArray(LANGUAGE_OPTIONS) &&
                LANGUAGE_OPTIONS.map((lang: { code: string; name: string }) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        {/* Clear All Button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size='sm'
            onClick={handleClearAll}
            className="px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 transition-colors flex items-center gap-2 whitespace-nowrap"
            title="Clear all filters"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
        <MultilevelCategorySelector
          filterMode
          selectedCategoryId={param.categoryId || undefined}
          onCategorySelect={(categoryId, path) => {
            const leaf = path.at(-1);
            setParam({
              ...param,
              categoryId,
              categoryTitle: leaf?.title ?? categoryId,
            });
          }}
        />
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

          {param.categoryId && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-900 rounded-md text-sm">
              {t("category.category")}: {param.categoryTitle || param.categoryId}
              <button
                type="button"
                onClick={() => setParam({ ...param, categoryId: "", categoryTitle: "" })}
                className="hover:text-amber-950"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default TextFilter
