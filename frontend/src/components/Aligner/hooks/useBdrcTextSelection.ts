import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchText } from '../../../api/text';
import { type BdrcSearchResult } from './uesBDRC';

export function useBdrcTextSelection() {
  const [bdrcSearchQuery, setBdrcSearchQuery] = useState<string>('');
  const [selectedBdrcResult, setSelectedBdrcResult] = useState<BdrcSearchResult | null>(null);
  const [showBdrcResults, setShowBdrcResults] = useState<boolean>(false);
  const [bdrcTextNotFound, setBdrcTextNotFound] = useState<boolean>(false);
  const [isCheckingBdrcText, setIsCheckingBdrcText] = useState<boolean>(false);
  const [fetchedTexts, setFetchedTexts] = useState<Array<{ id: string; bdrc: string; title: Record<string, string>; language: string }>>([]);
  
  const queryClient = useQueryClient();

  const handleBdrcResultSelect = useCallback(async (result: BdrcSearchResult) => {
    if (!result.workId) return;
    
    setSelectedBdrcResult(result);
    setShowBdrcResults(false);
    setBdrcTextNotFound(false);
    setIsCheckingBdrcText(true);
    
    try {
      // First check in available texts (quick check)
      let matchingText = null;
      // If not found, try to fetch the text using BDRC ID as text ID
        try {
          const text = await fetchText(result.workId);
          // If fetchText succeeds, check if the BDRC ID matches
          if (text && text.bdrc === result.workId) {
            matchingText = text;
            // Add fetched text to the list so it appears in dropdown
            setFetchedTexts(prev => {
              // Check if text already exists in fetched texts
              const exists = prev.some(t => t.id === text.id);
              if (!exists) {
                return [...prev, text];
              }
              return prev;
            });
            // Also update React Query cache
            queryClient.setQueryData(['texts', 'detail', text.id], text);
          }
        } catch {
          // fetchText failed, text doesn't exist - this is expected
          // We'll show the create button below
        }
      
      if (matchingText) {
        // Text exists, return the text ID
        setBdrcSearchQuery('');
        setIsCheckingBdrcText(false);
        return matchingText.id;
      } else {
        // Text doesn't exist, show message to create on cataloger
        setBdrcTextNotFound(true);
        setIsCheckingBdrcText(false);
        return null;
      }
    } catch (error) {
      console.error('Error checking BDRC text:', error);
      // On error, show the not found message with create button
      setBdrcTextNotFound(true);
      setIsCheckingBdrcText(false);
      return null;
    }
  }, [queryClient]);

  const handleResetBdrcSelection = useCallback(() => {
    setSelectedBdrcResult(null);
    setBdrcSearchQuery('');
    setBdrcTextNotFound(false);
    setShowBdrcResults(false);
    // Clear fetched texts for this BDRC ID
    setFetchedTexts([]);
  }, []);

  // Close BDRC results dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#bdrc-search') && !target.closest('.bdrc-results-container')) {
        setShowBdrcResults(false);
      }
    };

    if (showBdrcResults) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showBdrcResults]);

  const hasSelectedText = selectedBdrcResult?.workId && 
    fetchedTexts.some(text => text.bdrc === selectedBdrcResult.workId);

  return {
    bdrcSearchQuery,
    setBdrcSearchQuery,
    selectedBdrcResult,
    showBdrcResults,
    setShowBdrcResults,
    bdrcTextNotFound,
    isCheckingBdrcText,
    fetchedTexts,
    handleBdrcResultSelect,
    handleResetBdrcSelection,
    hasSelectedText,
  };
}

