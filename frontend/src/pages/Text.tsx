import { useState, useMemo, useEffect } from "react";
import { useTexts } from "@/hooks/useTexts";
import type { OpenPechaText } from "@/types/text";
import { Button } from "@/components/ui/button";
import { SimplePagination } from "@/components/ui/simple-pagination";
import { useTranslation } from "react-i18next";
import {  useNavigate, useSearchParams } from "react-router-dom";
import TextList from "@/components/TextList";
import TextFilter from "@/components/TextFilter";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePermission } from "@/hooks/usePermission";
import PermissionButton from "@/components/PermissionButton";
import { Plus } from "lucide-react";

const TextsPage = () => {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const LIMIT = 30; // Fixed limit of 30
  const OFFSET_STEP = 30; // Offset increment/decrement step
  const [params,setParams]= useSearchParams();
  const title = params.get("title") || "";
  const language = params.get("language") || "";
  const author = params.get("author") || "";
  const categoryId = params.get("categoryId") || "";
  const categoryTitle = params.get("categoryTitle") || "";
  
  // Search state
  const [foundText, setFoundText] = useState<OpenPechaText | null>(null);


  // Memoize params to prevent unnecessary refetches
  const paginationParams = useMemo(() => ({
    limit: LIMIT,
    offset: offset,
    title: title.trim() || undefined,
    language: language || undefined,
    author: author || undefined,
    category_id: categoryId.trim() || undefined,
  }), [offset, title, language, author, categoryId]);

  const { data: texts = [], isLoading, error, refetch } = useTexts(paginationParams);

 




  // Filter foundText if it's commentary or translation
  const filteredFoundText = useMemo(() => {
    if (!foundText) return null;
    if (foundText.type === 'commentary' || foundText.type === 'translation') {
      return null;
    }
    return foundText;
  }, [foundText]);

  const handleNextPage = () => {
    setOffset((prev) => prev + OFFSET_STEP);
  };

  const handlePrevPage = () => {
    setOffset((prev) => Math.max(0, prev - OFFSET_STEP));
  };

 




  
  // Determine what to display
  const displayTexts = filteredFoundText ? [filteredFoundText] : texts;
  const showPagination = !filteredFoundText;
 
  return (
    <div className="container  mx-auto py-16  space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-center sm:items-center gap-3 sm:gap-0`}>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 text-center sm:text-left">{t('textsPage.title')}</h2>
        <TextCreateButton/>
      </div>

      {/* Content */}
      <div className="space-y-4 bg-white ">
      <TextFilter  />
        
     
      

        

        {/* Clear Search Button - Show when text is found */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-md mx-1 sm:mx-0 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="h-5 bg-gray-200 rounded w-16 animate-pulse" />
                <div className="h-5 bg-gray-200 rounded w-24 animate-pulse" />
                <div className="h-5 bg-gray-200 rounded w-14 animate-pulse" />
                <div className="h-5 bg-gray-200 rounded w-20 animate-pulse" />
                <div className="h-5 bg-gray-200 rounded w-24 animate-pulse ml-auto" />
              </div>
            </div>
            {['sk1', 'sk2', 'sk3', 'sk4', 'sk5', 'sk6', 'sk7', 'sk8'].map((id) => (
              <Skeleton key={id} />
            ))}
          </div>
        )}
          { error && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mx-1 sm:mx-0">
            <div className="text-center">
              <p className="text-sm sm:text-base text-red-500 mb-4">{t('textsPage.errorLoadingTexts')}</p>
              <button
                onClick={() => refetch()}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors text-sm sm:text-base"
              >
                {t('textsPage.retry')}
              </button>
            </div>
          </div>
        )}

        {/* Text Cards Section with Loading/Error States */}
         {!isLoading && displayTexts.length === 0  && (
          <div className="bg-white  rounded-lg shadow-lg p-4 sm:p-8 mx-1 sm:mx-0">
            <div className="text-center text-gray-500">
              <p className="text-base sm:text-lg">{t('textsPage.noTextsFound')}</p>
            </div>
          </div>)}
          {displayTexts.length > 0 && (
            <TextList texts={displayTexts} /> 
          )}
        {/* Pagination Controls - Only show when not searching */}
        {showPagination && (
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
            <SimplePagination
              canGoPrev={offset > 0}
              canGoNext={texts.length > 0}
              onPrev={handlePrevPage}
              onNext={handleNextPage}
              label={t('textsPage.showing', {
                start: offset + 1,
                end: offset + texts.length,
              })}
              labelPosition="center"
            />
          </div>
        )}
      </div>
    </div>
  );
};




export default TextsPage;


function TextCreateButton() {
  const { t } = useTranslation();
  
  const navigate = useNavigate()
  const [, setEditedContent] = useLocalStorage("editedContent", "")
  const { data: permission, isFetching: isFetchingPermission } = usePermission()
  const isAdmin = permission?.role === "admin"
  return (
      <Button
        size="lg"
        onClick={() => {
          setEditedContent("")
          navigate("/create")
        }}
        disabled={!isAdmin}
        className="shrink-0 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white cursor-pointer"
      >
        <PermissionButton
          isLoading={isFetchingPermission}
          icon={<Plus className="w-5 h-5" />}
          text={t("common.create")}
        />
      </Button>
    )}