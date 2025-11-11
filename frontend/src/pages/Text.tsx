import { useState } from "react";
import { useTexts } from "@/hooks/useTexts";
import type { OpenPechaText } from "@/types/text";
import { Button } from "@/components/ui/button";
import TextListCard from "@/components/TextListCard";
import { useTranslation } from "react-i18next";

const TextCRUD = () => {
  const { t } = useTranslation();
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    language: "",
    author: "",
  });

  const { data: texts = [], isLoading, error, refetch } = useTexts(pagination);

  const handlePaginationChange = (
    newPagination: Partial<typeof pagination>
  ) => {
    setPagination((prev) => ({ ...prev, ...newPagination }));
  };

  const handleNextPage = () => {
    setPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
  };

  const handlePrevPage = () => {
    setPagination((prev) => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit),
    }));
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('textsPage.title')}</h2>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Filters and Controls */}
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div>
              <label
                htmlFor="limit"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('textsPage.limit')}
              </label>
              <select
                id="limit"
                value={pagination.limit}
                onChange={(e) =>
                  handlePaginationChange({
                    limit: parseInt(e.target.value),
                    offset: 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="language"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('textsPage.language')}
              </label>
              <select
                id="language"
                value={pagination.language}
                onChange={(e) =>
                  handlePaginationChange({
                    language: e.target.value,
                    offset: 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('textsPage.allLanguages')}</option>
                <option value="bo">{t('textsPage.tibetan')}</option>
                <option value="en">{t('textsPage.english')}</option>
                <option value="zh">{t('textsPage.chinese')}</option>
                <option value="sa">{t('textsPage.sanskrit')}</option>
                <option value="fr">{t('textsPage.french')}</option>
                <option value="mn">{t('textsPage.mongolian')}</option>
                <option value="pi">{t('textsPage.pali')}</option>
                <option value="cmg">{t('textsPage.classicalMongolian')}</option>
                <option value="ja">{t('textsPage.japanese')}</option>
                <option value="ru">{t('textsPage.russian')}</option>
                <option value="lzh">{t('textsPage.literaryChinese')}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="author"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('textsPage.authorId')}
              </label>
              <input
                id="author"
                type="text"
                value={pagination.author}
                onChange={(e) =>
                  handlePaginationChange({ author: e.target.value, offset: 0 })
                }
                placeholder={t('textsPage.enterAuthorId')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 pt-4 border-t border-gray-200">
            <Button
              onClick={handlePrevPage}
              disabled={pagination.offset === 0}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {t('textsPage.previous')}
            </Button>
            <span className="text-xs sm:text-sm text-gray-600 text-center">
              {t('textsPage.showing', { 
                start: pagination.offset + 1, 
                end: pagination.offset + texts.length 
              })}
            </span>
            <Button
              onClick={handleNextPage}
              disabled={texts.length < pagination.limit}
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
              <p className="text-xs sm:text-sm mt-2">{t('textsPage.adjustFilters')}</p>
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
