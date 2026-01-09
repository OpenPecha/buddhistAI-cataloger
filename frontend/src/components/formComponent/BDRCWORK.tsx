import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { useBdrcSearch } from "@/hooks/useBdrcSearch";
import { fetchTextByBdrcId } from "@/api/texts";
import { useTranslation } from "react-i18next";
import type { OpenPechaText } from "@/types/text";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BDRCWorkProps {
  bdrc: string;
  onBdrcChange: (bdrcId: string) => void;
  onExistingTextFound?: (text: OpenPechaText) => void;
}

export interface BDRCWorkRef {
  setBdrcId: (bdrcId: string, label: string) => void;
}

const BDRCWork = forwardRef<BDRCWorkRef, BDRCWorkProps>(
  ({ bdrc, onBdrcChange, onExistingTextFound }, ref) => {
    const { t } = useTranslation();
    
    // BDRC search state
    const [bdrcSearch, setBdrcSearch] = useState("");
    const [showBdrcDropdown, setShowBdrcDropdown] = useState(false);
    const [selectedBdrc, setSelectedBdrc] = useState<{ id: string; label: string } | null>(null);

    // BDRC conflict state
    const [showBdrcConflictDialog, setShowBdrcConflictDialog] = useState(false);
    const [conflictingText, setConflictingText] = useState<OpenPechaText | null>(null);
    const [pendingBdrcSelection, setPendingBdrcSelection] = useState<{ id: string; label: string } | null>(null);
    const [isCheckingBdrcId, setIsCheckingBdrcId] = useState(false);

    // BDRC search hook
    const { results: bdrcResults, isLoading: bdrcLoading } = useBdrcSearch(bdrcSearch);

    // Expose setBdrcId method to parent via ref
    useImperativeHandle(ref, () => ({
      setBdrcId: (bdrcId: string, label: string) => {
        setSelectedBdrc({ id: bdrcId, label });
        setBdrcSearch("");
        onBdrcChange(bdrcId);
      },
    }), [onBdrcChange]);

    // Sync internal bdrc state with prop
    React.useEffect(() => {
      if (bdrc && !selectedBdrc) {
        setSelectedBdrc({ id: bdrc, label: bdrc });
      } else if (!bdrc && selectedBdrc) {
        setSelectedBdrc(null);
      }
    }, [bdrc, selectedBdrc]);

    const handleBdrcSelect = async (workId: string, label: string) => {
      // Show loading state
      setIsCheckingBdrcId(true);
      setShowBdrcDropdown(false);
      
      // Check if this BDRC ID already exists
      try {
        const existingText = await fetchTextByBdrcId(workId);
        
        if (existingText) {
          // Text already exists - show confirmation dialog
          setConflictingText(existingText);
          setPendingBdrcSelection({ id: workId, label });
          setShowBdrcConflictDialog(true);
        } else {
          // No conflict - proceed normally
          setSelectedBdrc({
            id: workId,
            label: label,
          });
          onBdrcChange(workId);
        }
      } catch (error) {
        // Error checking - proceed with selection
        console.error('Error checking BDRC ID:', error);
        setSelectedBdrc({
          id: workId,
          label: label,
        });
        onBdrcChange(workId);
      } finally {
        setIsCheckingBdrcId(false);
      }
    };

    const handleClearBdrc = () => {
      setSelectedBdrc(null);
      setBdrcSearch("");
      setShowBdrcDropdown(true);
      onBdrcChange("");
    };

    const handleChooseAnother = () => {
      setBdrcSearch("");
      setSelectedBdrc(null);
      onBdrcChange("");
      setShowBdrcConflictDialog(false);
      setConflictingText(null);
      setPendingBdrcSelection(null);
      setShowBdrcDropdown(true);
    };

    const handleUseExisting = () => {
      if (onExistingTextFound && conflictingText) {
        onExistingTextFound(conflictingText);
      }
      setShowBdrcConflictDialog(false);
      setConflictingText(null);
      setPendingBdrcSelection(null);
    };

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label
              htmlFor="bdrc"
              className="mb-2"
            >
              {t("textForm.bdrcWorkId")}
            </Label>
            <div className="relative">
              {selectedBdrc ? (
                // Display selected BDRC (read-only, click to change)
                <div
                  onClick={handleClearBdrc}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleClearBdrc();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-gray-900">{selectedBdrc.id}</span>
                  <span className="text-xs text-blue-600">{t("textForm.clickToChange")}</span>
                </div>
              ) : (
                // Search input
                <>
                  <Input
                    id="bdrc"
                    type="text"
                    value={bdrcSearch}
                    onChange={(e) => {
                      setBdrcSearch(e.target.value);
                      setShowBdrcDropdown(true);
                    }}
                    placeholder={t("textForm.searchBdrcEntries")}
                  />
                  {/* BDRC Dropdown */}
                  {showBdrcDropdown && bdrcSearch.trim() && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {bdrcLoading ? (
                        <div className="px-4 py-8 flex flex-col items-center justify-center">
                          <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                          <div className="text-sm text-gray-500">{t("textForm.searching")}</div>
                        </div>
                      ) : bdrcResults.length > 0 ? (
                        bdrcResults
                          .filter((result) => result.title && result.title !== " - no data - ")
                          .map((result, index) => (
                            <button
                              key={`${result.workId}-${index}`}
                              type="button"
                              onClick={() => {
                                const workId = result.workId || '';
                                const label = result.title || '';
                                handleBdrcSelect(workId, label);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100"
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {result.title}
                              </div>
                              <div className="text-xs text-gray-500">{result.workId}</div>
                            </button>
                          ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          {t("textForm.noBdrcEntries")}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* BDRC Checking Loading Overlay */}
        {isCheckingBdrcId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center">
                {/* Animated Icon */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full opacity-20 animate-ping"></div>
                  </div>
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl shadow-2xl flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  </div>
                </div>

                {/* Loading Text */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {t("textForm.checkingBdrcId")}
                </h3>
                <p className="text-sm text-gray-600">
                  {t("textForm.verifyingText")}
                </p>

                {/* Progress Bar */}
                <div className="relative w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BDRC Conflict Dialog */}
        {showBdrcConflictDialog && conflictingText && pendingBdrcSelection && (
          <div className="fixed inset-0 bg-black/30 bg-opacity-50 flex justify-center z-50 p-4">
            <div className="bg-white mt-[200px] rounded-lg shadow-xl max-w-md w-full h-fit p-6 animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {t("textForm.textAlreadyExists")}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t("textForm.bdrcAlreadyAssociated")}
                  </p>
                </div>
              </div>

              {/* Existing Text Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="text-sm font-medium text-blue-900 mb-2">
                  {t("textForm.existingText")}
                </div>
                <div className="space-y-1 text-sm text-gray-700">
                  <div>
                    <strong>{t("textForm.bdrcId")}:</strong> {pendingBdrcSelection.id}
                  </div>
                  <div>
                    <strong>{t("text.textTitle")}:</strong>{" "}
                    {conflictingText.title.bo ||
                      conflictingText.title.en ||
                      Object.values(conflictingText.title)[0] ||
                      "Untitled"}
                  </div>
                  <div>
                    <strong>{t("textForm.type")}:</strong> {conflictingText.type}
                  </div>
                  <div>
                    <strong>{t("textForm.language")}:</strong> {conflictingText.language}
                  </div>
                </div>
              </div>

              {/* Question */}
              <p className="text-sm text-gray-700 mb-6">
                {t("textForm.useExistingQuestion")}
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleChooseAnother}
                >
                  {t("textForm.chooseAnother")}
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={handleUseExisting}
                >
                  {t("textForm.useExistingText")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
);

BDRCWork.displayName = "BDRCWork";

export default BDRCWork;
