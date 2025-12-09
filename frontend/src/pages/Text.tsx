import { useState, useMemo, useEffect } from "react";
import { useTexts, useTextsByTitle } from "@/hooks/useTexts";
import type { OpenPechaText } from "@/types/text";
import { Button } from "@/components/ui/button";
import TextListCard from "@/components/TextListCard";
import { useTranslation } from "react-i18next";
import { useBdrcSearch, type BdrcSearchResult } from "@/hooks/useBdrcSearch";
import { fetchTextByBdrcId } from "@/api/texts";
import { Link, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Label } from "@/components/ui/label";

const TextCRUD = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const LIMIT = 30; // Fixed limit of 30
  const OFFSET_STEP = 30; // Offset increment/decrement step

  // Search state
  const [textSearch, setTextSearch] = useState("");
  const [debouncedTextSearch, setDebouncedTextSearch] = useState("");
  const [showTextDropdown, setShowTextDropdown] = useState(false);
  const [foundText, setFoundText] = useState<OpenPechaText | null>(null);
  const [isCheckingText, setIsCheckingText] = useState(false);
  const [textNotFound, setTextNotFound] = useState(false);

  // BDRC search
  const { results: bdrcResults, isLoading: isLoadingBdrc } = useBdrcSearch(debouncedTextSearch, "Instance", 1000);

  // Local text search
  const { data: localTextResults = [], isLoading: isLoadingLocalTexts } = useTextsByTitle(
    debouncedTextSearch.trim() || ""
  );
  // Debounce text search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTextSearch(textSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [textSearch]);

  // Memoize params to prevent unnecessary refetches
  const paginationParams = useMemo(() => ({
    limit: LIMIT,
    offset: offset,
  }), [offset]);

  const { data: texts = [], isLoading, error, refetch } = useTexts(paginationParams);

  // Filter out commentary and translation types
  const filteredTexts = useMemo(() => {
    return texts.filter((text: OpenPechaText) => 
      text.type !== 'commentary' && text.type !== 'translation'
    );
  }, [texts]);

  const filteredLocalTextResults = useMemo(() => {
    return localTextResults.filter((text: OpenPechaText) => 
      text.type !== 'commentary' && text.type !== 'translation'
    );
  }, [localTextResults]);

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

  const handleTextSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTextSearch(value);
    setShowTextDropdown(true);
    // Clear search results when input changes
    if (!value) {
      clearSearch();
    }
  };

  const getTitleDisplay = (text: OpenPechaText): string => {
    if (text.title?.[text.language]) {
      return text.title[text.language];
    }
    const firstTitle = Object.values(text.title || {})[0];
    return firstTitle || "Untitled";
  };

  const handleBdrcTextSelect = async (result: BdrcSearchResult) => {
    const workId = result.workId;
    if (!workId) return;

    setShowTextDropdown(false);
    setIsCheckingText(true);
    setTextNotFound(false);
    setFoundText(null);

    try {
      // Check if text exists
      const existingText = await fetchTextByBdrcId(workId);
      
      if (existingText) {
        // Text found
        setFoundText(existingText);
        setTextNotFound(false);
      } else {
        // Text not found
        setTextNotFound(true);
        setFoundText(null);
      }
    } catch {
      // Treat any error as not found
      setTextNotFound(true);
      setFoundText(null);
    } finally {
      setIsCheckingText(false);
    }
  };



  const clearSearch = () => {
    setTextSearch("");
    setDebouncedTextSearch("");
    setFoundText(null);
    setTextNotFound(false);
    setShowTextDropdown(false);
  };

  const handleCreateClick = () => {
    navigate("/create");
  };

  // Determine what to display
  const displayTexts = filteredFoundText ? [filteredFoundText] : filteredTexts;
  const showPagination = !filteredFoundText && !textNotFound;

  return (
    <div className="container mx-auto py-16  space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-center sm:items-center gap-3 sm:gap-0`}>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 text-center sm:text-left">{t('textsPage.title')}</h2>
        
        {/* Search Input */}
        <div className="relative w-full sm:w-auto sm:min-w-[300px]">
          <Label
            htmlFor="text-search"
          >
            {t("create.searchExistingText")}
          </Label>
          <div className="relative">
            <input
              id="text-search"
              type="text"
              value={textSearch}
              onChange={handleTextSearchChange}
              onFocus={() => setShowTextDropdown(true)}
              onBlur={() => setTimeout(() => setShowTextDropdown(false), 200)}
              className="w-full px-3 py-2 pr-8 border bg-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("create.searchPlaceholder")}
            />
            {textSearch && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Text Dropdown */}
          {showTextDropdown && textSearch && (
            <div className="absolute z-10 w-full  mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
              {debouncedTextSearch.trim() && (
                <>
                  {/* BDRC Results Section */}
                  <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-700 uppercase">
                      {t("create.bdrcCatalog")}
                    </span>
                  </div>
                  
                  {isLoadingBdrc ? (
                    <div className="px-4 py-4 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                      <div className="text-sm text-gray-500">{t("create.searchingBdrc")}</div>
                    </div>
                  ) : bdrcResults.length > 0 ? (
                    bdrcResults.map((result) => (
                      <button
                        key={result.workId}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent input blur
                          handleBdrcTextSelect(result);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-purple-50 border-b border-gray-100"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            BDRC
                          </span>
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {result.title || "Untitled"}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {result.workId}
                              {result.language && ` • ${result.language}`}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : debouncedTextSearch.trim() ? (
                    <div className="px-4 py-2 text-gray-500 text-sm">
                      {t("create.noBdrcResults")}
                    </div>
                  ) : null}

                  {/* Local Text Results Section */}
                  <div className="px-4 py-2 bg-gray-100 border-t border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-700 uppercase">
                      {"Local Texts"}
                    </span>
                  </div>
                  {isLoadingLocalTexts ? (
                    <div className="px-4 py-4 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <div className="text-sm text-gray-500">Searching...</div>
                    </div>
                  ) : filteredLocalTextResults.length > 0 ? (
                    filteredLocalTextResults.map((text) => (
                      <Link
                      to={`/texts/${text.id}/instances`}
                        key={text.id+Math.random()}
                       
                        className="w-full px-4 py-2 text-left hover:bg-blue-50 border-b border-gray-100"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            LOCAL
                          </span>
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {text.title.bo || text.title.en}
                            </div>
                            
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : debouncedTextSearch.trim() ? (
                    <div className="px-4 py-2 text-gray-500 text-sm">
                      {t("create.noLocalTextResults") || "No texts found"}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Checking Text Loading State */}
        {isCheckingText && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mx-1 sm:mx-0">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-gray-600">{t('textsPage.checkingText') || 'Checking if text exists...'}</p>
            </div>
          </div>
        )}

        {/* Text Not Found Message */}
        {textNotFound && !isCheckingText && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mx-1 sm:mx-0">
            <div className="text-center space-y-4">
              <p className="text-sm sm:text-base text-gray-600">
                {t('textsPage.textNotFound') || 'Text not found'}
              </p>
              <Button
                onClick={handleCreateClick}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {t('textsPage.createText') || '+ Create'}
              </Button>
            </div>
          </div>
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

        {/* Text Cards Section with Loading/Error States */}
        {isLoading && !isCheckingText ? (
          <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow-md mx-1 sm:mx-0">
            <div className="text-center px-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-gray-600">{t('textsPage.loadingTexts')}</p>
            </div>
          </div>
        ) : error && !isCheckingText ? (
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
        ) : displayTexts.length === 0 && !isCheckingText && !textNotFound ? (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mx-1 sm:mx-0">
            <div className="text-center text-gray-500">
              <p className="text-base sm:text-lg">{t('textsPage.noTextsFound')}</p>
            </div>
          </div>
        ) : !isCheckingText && !textNotFound ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 ">
            {displayTexts.map((text: OpenPechaText) => (
              <TextListCard key={text.id} text={text} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TextCRUD;
