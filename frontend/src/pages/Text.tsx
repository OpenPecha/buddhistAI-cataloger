import { useState, useMemo } from "react";
import { useTexts } from "@/hooks/useTexts";
import type { OpenPechaText } from "@/types/text";
import { Button } from "@/components/ui/button";
import TextListCard from "@/components/TextListCard";
import { useTranslation } from "react-i18next";

const TextCRUD = () => {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const LIMIT = 30; // Fixed limit of 30
  const OFFSET_STEP = 30; // Offset increment/decrement step

  // Memoize params to prevent unnecessary refetches
  const paginationParams = useMemo(() => ({
    limit: LIMIT,
    offset: offset,
  }), [offset]);

  const { data: texts = [], isLoading, error, refetch } = useTexts(paginationParams);

  const handleNextPage = () => {
    setOffset((prev) => prev + OFFSET_STEP);
  };

  const handlePrevPage = () => {
    setOffset((prev) => Math.max(0, prev - OFFSET_STEP));
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('textsPage.title')}</h2>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Pagination Controls */}
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
            <Button
              onClick={handlePrevPage}
              disabled={offset === 0}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {t('textsPage.previous')}
            </Button>
            <span className="text-xs sm:text-sm text-gray-600 text-center">
              {t('textsPage.showing', { 
                start: offset + 1, 
                end: offset + texts.length 
              })}
            </span>
            <Button
              onClick={handleNextPage}
              disabled={texts.length < LIMIT}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {t('textsPage.next')}
            </Button>
          </div>
        </div>

        {/* Text Cards Section with Loading/Error States */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow-md mx-1 sm:mx-0">
            <div className="text-center px-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-gray-600">{t('textsPage.loadingTexts')}</p>
            </div>
          </div>
        ) : error ? (
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
        ) : texts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mx-1 sm:mx-0">
            <div className="text-center text-gray-500">
              <p className="text-base sm:text-lg">{t('textsPage.noTextsFound')}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {texts.map((text: OpenPechaText) => (
              <TextListCard key={text.id} text={text} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TextCRUD;
