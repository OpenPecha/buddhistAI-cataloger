import { useState, useMemo } from "react";
import { useTexts } from "@/hooks/useTexts";
import type { OpenPechaText } from "@/types/text";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {  useNavigate } from "react-router-dom";
import TextList from "@/components/TextList";
import TextFilter from "@/components/TextFilter";

const TextsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const LIMIT = 30; // Fixed limit of 30
  const OFFSET_STEP = 30; // Offset increment/decrement step
  const [param, setParam] = useState({
    title: "",
    type: "none",
    language: "",
    author: ""
  });
  // Search state
  const [foundText, setFoundText] = useState<OpenPechaText | null>(null);


  // Memoize params to prevent unnecessary refetches
  const paginationParams = useMemo(() => ({
    limit: LIMIT,
    offset: offset,
    title: param.title.trim() || undefined,
    language: param.language || undefined,
    author: param.author || undefined,
    type: param.type as "root" | "commentary" | "translation" | "translation_source" | "none" | undefined
  }), [offset, param.title, param.language, param.author, param.type]);

  const { data: texts = [], isLoading, error, refetch } = useTexts(paginationParams);

  // Filter out commentary and translation types
  const filteredTexts = useMemo(() => {
    return texts.filter((text: OpenPechaText) => 
      text.type !== 'commentary' && text.type !== 'translation'
    );
  }, [texts]);


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

 






  const clearSearch = () => {
    setFoundText(null);
    setParam({
      title: "",
      type: "none",
      language: "",
      author: ""
    });
    setOffset(0);
  };

  const handleCreateClick = () => {
    navigate("/create");
  };

  // Determine what to display
  const displayTexts = filteredFoundText ? [filteredFoundText] : filteredTexts;
  const showPagination = !filteredFoundText;

  return (
    <div className="container mx-auto py-16  space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-center sm:items-center gap-3 sm:gap-0`}>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 text-center sm:text-left">{t('textsPage.title')}</h2>
      </div>

      {/* Content */}
      <div className="space-y-4">
      <TextFilter param={param} setParam={setParam} clearSearch={clearSearch}  />
        

      

        

        {/* Clear Search Button - Show when text is found */}
        {filteredFoundText && (
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {t('textsPage.showingSearchResult') || 'Showing search result'}
              </span>
              <Button
                onClick={clearSearch}
                variant="outline"
                size="sm"
              >
                {t('textsPage.clearSearch') || 'Clear Search'}
              </Button>
            </div>
          </div>
        )}
        {isLoading && <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow-md mx-1 sm:mx-0">
            <div className="text-center px-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-gray-600">{t('textsPage.loadingTexts')}</p>
            </div>
          </div>
          }
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
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mx-1 sm:mx-0">
            <div className="text-center text-gray-500">
              <p className="text-base sm:text-lg">{t('textsPage.noTextsFound')}</p>
            </div>
          </div>)}
          {displayTexts.length > 0 && (
            <TextList texts={displayTexts} /> 
          )}
        {/* Pagination Controls - Only show when not searching */}
        {showPagination && (
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 ">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
              <Button
                onClick={handlePrevPage}
                disabled={offset === 0}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {t('textsPage.previous')}
              </Button>
              <span className="text-xs sm:text-sm text-gray-600 text-center ">
                {t('textsPage.showing', { 
                  start: offset + 1, 
                  end: offset + filteredTexts.length 
                })}
              </span>
              <Button
                onClick={handleNextPage}
                disabled={texts.length === 0}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {t('textsPage.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};




export default TextsPage;
