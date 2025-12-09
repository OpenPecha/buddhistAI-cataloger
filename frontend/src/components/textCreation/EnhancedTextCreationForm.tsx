import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, Upload, FileText, Code, CheckCircle2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TextEditorView from "./TextEditorView";
import TextCreationForm from "@/components/TextCreationForm";
import type { TextCreationFormRef } from "@/components/TextCreationForm";
import InstanceCreationForm from "@/components/InstanceCreationForm";
import type { InstanceCreationFormRef } from "@/components/InstanceCreationForm";
import { useText, useCreateText, useCreateTextInstance } from "@/hooks/useTexts";
import { useSearchParams, useNavigate } from "react-router-dom";
import { detectLanguage } from "@/utils/languageDetection";
import { useBibliographyAPI } from "@/hooks/useBibliographyAPI";
import type { OpenPechaText } from "@/types/text";
import { useBdrcSearch, type BdrcSearchResult } from "@/hooks/useBdrcSearch";
import { fetchTextByBdrcId, fetchBdrcWorkInstance } from "@/api/texts";
import { useTranslation } from "react-i18next";
import { useBibliography } from "@/context/BibliographyContext";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { validateContentEndsWithTsheg, validateSegmentLimits } from "@/utils/contentValidation";
import { Label } from "../ui/label";

const EnhancedTextCreationForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth0();
  const { t } = useTranslation();
  const textFormRef = useRef<TextCreationFormRef>(null);
  const instanceFormRef = useRef<InstanceCreationFormRef>(null);
  const hasAutoSelectedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { clearAfterSubmission } = useBibliographyAPI();

  // Helper function to parse error messages
  const parseErrorMessage = (error: any): string => {
    // If error is a string, try to parse it as JSON
    if (typeof error === "string") {
      try {
        const parsed = JSON.parse(error);
        return parsed.error || parsed.message || error;
      } catch {
        return error;
      }
    }
    
    // If error has a message property
    if (error?.message) {
      try {
        const parsed = JSON.parse(error.message);
        return parsed.error || parsed.message || error.message;
      } catch {
        return error.message;
      }
    }
    
    // If error is an object with error property
    if (error?.error) {
      return error.error;
    }
    
    return t("messages.createError");
  };

  // Workflow state
  const [isCreatingNewText, setIsCreatingNewText] = useState(false);
  const [searchParams] = useSearchParams();
  const t_id = searchParams.get("t_id") || "";
  const w_id = searchParams.get("w_id") || "";
  const i_id = searchParams.get("i_id") || "";

  // Text selection state
  const [selectedText, setSelectedText] = useState<OpenPechaText | null>(null);
  const [textSearch, setTextSearch] = useState(t_id);
  const [showTextDropdown, setShowTextDropdown] = useState(false);
  const [debouncedTextSearch, setDebouncedTextSearch] = useState("");

  // Mobile panel state
  const [activePanel, setActivePanel] = useState<"form" | "editor">("form");

  // File upload state
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  const [editedContent, setEditedContent] = useLocalStorage("editedContent", "");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [successTextId, setSuccessTextId] = useState<string | null>(null);
  const [successInstanceId, setSuccessInstanceId] = useState<string | null>(null);
  
  // Notification state for text selection actions
  const [notification, setNotification] = useState<string | null>(null);
  
  // Loading state for checking BDRC text
  const [isCheckingBdrc, setIsCheckingBdrc] = useState(false);

  // Track if incipit exists (for enabling/disabling alt incipit)
  const [hasIncipitTitle, setHasIncipitTitle] = useState(false);

  // Track if title exists (for enabling/disabling alt title)
  const [hasTitle, setHasTitle] = useState(false);

  // Track search attempts for "Create" button activation
  const [searchAttempts, setSearchAttempts] = useState(0);

  // Track selected language from form for validation
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');

  // Watch for language changes in the form
  useEffect(() => {
    const checkLanguage = () => {
      const currentLanguage = textFormRef.current?.getLanguage() || '';
      if (currentLanguage !== selectedLanguage) {
        setSelectedLanguage(currentLanguage);
      }
    };
    
    // Check immediately
    checkLanguage();
    
    // Check periodically to catch language changes
    const interval = setInterval(checkLanguage, 500);
    return () => clearInterval(interval);
  }, [selectedLanguage]);

  // Content validation - check if content ends with appropriate punctuation based on language
  const contentValidationError = useMemo(() => {
    const isValidMessage = validateContentEndsWithTsheg(selectedLanguage, editedContent);
    return isValidMessage;
  }, [editedContent, selectedLanguage]);

  // Segment character limit validation with debouncing (1000ms)
  const [segmentValidation, setSegmentValidation] = useState<{
    invalidSegments: Array<{ index: number; length: number }>;
    invalidCount: number;
  }>({ invalidSegments: [], invalidCount: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      const validation = validateSegmentLimits(editedContent);
      setSegmentValidation({
        invalidSegments: validation.invalidSegments.map(seg => ({ index: seg.index, length: seg.length })),
        invalidCount: validation.invalidCount,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [editedContent]);

  // Mutations and data
  // Only fetch texts when t_id is present in URL (for auto-selection)
  // Use useText to fetch only the specific text needed instead of all texts
  const { data: textFromUrl, isLoading: isLoadingTextFromUrl } = useText(t_id || '');
  const createTextMutation = useCreateText();
  const createInstanceMutation = useCreateTextInstance();
  
  // BDRC search for texts
  const { results: bdrcResults, isLoading: isLoadingBdrc } = useBdrcSearch(debouncedTextSearch, "Instance",  1000);

  // Debounce text search and track attempts
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTextSearch(textSearch);
      // Increment search attempts only if there's actual search text
      if (textSearch.trim()) {
        setSearchAttempts(prev => prev + 1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [textSearch]);

  useEffect(() => {
    if (t_id && textFromUrl && !selectedText && !hasAutoSelectedRef.current) {
      // Automatically select the found text
      setSelectedText(textFromUrl);
      setTextSearch(getTextDisplayName(textFromUrl));
      setShowTextDropdown(false);
      setIsCreatingNewText(false);
      hasAutoSelectedRef.current = true; // Mark as auto-selected
    }
    // Reset the flag when there's no t_id, w_id, or i_id in URL
    if (!t_id && !w_id && !i_id) {
      hasAutoSelectedRef.current = false;
    }
  }, [t_id, textFromUrl, selectedText]);
  // Auto-select text when t_id is provided in URL

  // Helper function to get text display name
  const getTextDisplayName = (text: OpenPechaText): string => {
    return (
      text.title.bo ||
      text.title.en ||
      Object.values(text.title)[0] ||
      "Untitled"
    );
  };

  // Helper: Clear URL parameters if needed
  const clearUrlParams = () => {
    if (t_id || w_id) {
      navigate("/create", { replace: true });
    }
  };

  // Helper: Clear file upload state
  const clearFileUpload = () => {
    setEditedContent("");
    setUploadedFilename("");
  };

  // Helper function to map BDRC roleName to form role
  const mapRoleNameToFormRole = (roleName: string | undefined): "translator" | "reviser" | "author" | "scholar" => {
    if (!roleName) return "author"; // Default to author
    const lowerRoleName = roleName.toLowerCase();
    if (lowerRoleName.includes("author") || lowerRoleName.includes("main author")) {
      return "author";
    } else if (lowerRoleName.includes("translator")) {
      return "translator";
    } else if (lowerRoleName.includes("reviser") || lowerRoleName.includes("revisor")) {
      return "reviser";
    } else if (lowerRoleName.includes("scholar")) {
      return "scholar";
    }
    return "author"; // Default fallback
  };

  // Helper function to prefilled form with BDRC data
  const prefilledFormWithBdrcData = (result: BdrcSearchResult, workId: string) => {
    setTimeout(() => {
      if (textFormRef.current) {
        // Set BDRC ID
        textFormRef.current.setBdrcId(workId, result.title || '');
        
        // Set language if available
        if (result.language) {
          textFormRef.current.setFormLanguage(result.language);
        }
        
        // Add title with language from response
        if (result.title && result.title !== " - no data - ") {
          textFormRef.current.addTitle(result.title, result.language || undefined);
        }
        
        // Add all contributors
        if (result.contributors && result.contributors.length > 0) {
          result.contributors.forEach((contributor) => {
            if (contributor.agent && contributor.agentName) {
              const formRole = mapRoleNameToFormRole(contributor.roleName);
              textFormRef.current?.addContributorFromBdrc(
                contributor.agent,
                contributor.agentName,
                formRole
              );
            }
          });
        }
      }
    }, 100);
  };

  // Handle BDRC workId and instanceId from URL when page loads
  useEffect(() => {
    const handleBdrcWorkInstanceFromUrl = async () => {
      // Only process if:
      // 1. w_id and i_id exist in URL
      // 2. We haven't auto-selected a text yet
      // 3. We're not already creating a new text
      // 4. No text is selected
      if (
        w_id &&
        i_id &&
        !hasAutoSelectedRef.current &&
        !isCreatingNewText &&
        !selectedText &&
        !isCheckingBdrc
      ) {
        hasAutoSelectedRef.current = true;
        setIsCheckingBdrc(true);

        try {
          // First check if it exists locally by BDRC ID
          const existingText = await fetchTextByBdrcId(w_id);

          if (existingText) {
            // Text exists locally - select it and update URL
            setSelectedText(existingText);
            setTextSearch(getTextDisplayName(existingText));
            setIsCreatingNewText(false);
            hasAutoSelectedRef.current = true;
            navigate(`/create?t_id=${existingText.id}`, { replace: true });
            setNotification(t("create.textFound", { name: getTextDisplayName(existingText) }));
          } else {
            // Text doesn't exist locally - fetch from BDRC endpoint
            try {
              const workInstanceData = await fetchBdrcWorkInstance(w_id, i_id);
              
              // Set up for creating new text
              setSelectedText(null);
              setTextSearch("");
              setIsCreatingNewText(true);
              clearFileUpload();
              
              // Prefill form with BDRC data
              prefilledFormWithBdrcData(workInstanceData, w_id);
              
              setNotification(t("create.creatingNewForBdrc", { id: w_id }));
              setTimeout(() => setNotification(null), 3000);
            } catch (error) {
              console.error("Error fetching BDRC work instance:", error);
              setError(t("create.failedToFetchBdrcWorkInstance"));
            }
          }
        } catch (error) {
          console.error("Error checking BDRC ID:", error);
          setError(t("create.failedToCheckBdrc"));
        } finally {
          setIsCheckingBdrc(false);
        }
      }
    };

    handleBdrcWorkInstanceFromUrl();
  }, [w_id, i_id, selectedText, isCreatingNewText, navigate, t, prefilledFormWithBdrcData, clearFileUpload, getTextDisplayName]);

  // Periodically check if incipit and title exist to keep the state up to date
  const { clearAnnotations } = useBibliography();
  // Helper: Reset to initial clean state
  const resetToInitialState = () => {
    // Set flag FIRST to prevent auto-select from re-triggering
    hasAutoSelectedRef.current = true; // Prevent auto-select effect
    
    // Clear all state
    setSelectedText(null);
    setTextSearch("");
    setIsCreatingNewText(false);
    clearFileUpload();
    clearAnnotations();
    // Clear URL params
    clearUrlParams();
  };

  const handleTextSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTextSearch(value);
    setShowTextDropdown(true);
    hasAutoSelectedRef.current = true; // Mark user interaction
    
    // Clear selection if search is empty
    if (!value) {
      setSelectedText(null);
      clearUrlParams(); // Clear URL to prevent loading state
      setSearchAttempts(0); // Reset search attempts when clearing
    }
  };

  // Handle creating new text from BDRC search
  const handleCreateNewFromSearch = () => {
    setSelectedText(null);
    setIsCreatingNewText(true);
    // Don't clear file upload - keep editor open with placeholder content
    if (!editedContent || editedContent.trim() === "") {
      setEditedContent(""); // Set placeholder to show the editor
    }
    hasAutoSelectedRef.current = true;
    clearUrlParams();
    setShowTextDropdown(false);
    setTextSearch("");
    setSearchAttempts(0); // Reset attempts
    setNotification(t("create.readyToCreateNew"));
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle when existing text is found from TextCreationForm BDRC selection
  const handleExistingTextFoundFromForm = (text: OpenPechaText) => {
    // Switch from creating new text to using existing text
    setSelectedText(text);
    setTextSearch(getTextDisplayName(text));
    setIsCreatingNewText(false);
    hasAutoSelectedRef.current = true;
    navigate(`/create?t_id=${text.id}`, { replace: true });
    setNotification(t("create.usingExistingText", { name: getTextDisplayName(text) }));
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle BDRC text selection
  const handleBdrcTextSelect = async (result: BdrcSearchResult) => {
    const workId = result.workId;
    const instanceId = result.instanceId;
    if (!workId) return;
    
    setShowTextDropdown(false);
    setIsCheckingBdrc(true);
    
    try {
      // Try to fetch text by BDRC ID
      const existingText = await fetchTextByBdrcId(workId);
      
      if (existingText) {
        // Case 1: Text exists - select it
        setSelectedText(existingText);
        setTextSearch(getTextDisplayName(existingText));
        setIsCreatingNewText(false);
        clearFileUpload();
        hasAutoSelectedRef.current = true;
        navigate(`/create?t_id=${existingText.id}`, { replace: true });
        setNotification(t("create.textFound", { name: getTextDisplayName(existingText) }));
      } else {
        // Case 2: Text doesn't exist - fetch from BDRC endpoint if instanceId exists
        let bdrcData: BdrcSearchResult = result;
        
        if (instanceId) {
          try {
            // Call the BDRC work instance endpoint
            const workInstanceData = await fetchBdrcWorkInstance(workId, instanceId);
            bdrcData = workInstanceData;
          } catch (error) {
            console.error("Error fetching BDRC work instance:", error);
            // Fall back to using search result data
            bdrcData = result;
          }
        }
        
        // Set up for creating new text
        setSelectedText(null);
        setTextSearch("");
        setIsCreatingNewText(true);
        hasAutoSelectedRef.current = true;
        
        // Navigate with new URL pattern if instanceId exists, otherwise use workId only
        if (instanceId) {
          navigate(`/create?w_id=${workId}&i_id=${instanceId}`, { replace: true });
        } else {
          navigate(`/create?w_id=${workId}`, { replace: true });
        }
        
        // Prefill form with BDRC data
        prefilledFormWithBdrcData(bdrcData, workId);
        
        setNotification(t("create.creatingNewForBdrc", { id: workId }));
      }
    } catch {
      setError(t("create.failedToCheckBdrc"));
    } finally {
      setIsCheckingBdrc(false);
    }
    
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle file upload
  const handleFileUpload = (content: string, filename: string) => {
    // Clean content immediately: remove empty lines and trailing empty lines
    
   
    
    
    

    let lines = content.split('\n');
    
    lines = lines.filter(line => line.trim() !== '');

    const cleanedContent = lines.join('\n');



    setEditedContent(cleanedContent);
    setUploadedFilename(filename);
  };


  // Handle unified creation: create text then instance
  const handleInstanceCreation = async (instanceData: any) => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      let textId: string;

      if (isCreatingNewText) {
        // Creating new text - use window method to get form data
        const textFormData = (window as any).__getTextFormData?.();
        if (!textFormData) {
          throw new Error(t("create.textFormDataNotAvailable"));
        }

        // Create text first
        const newText = await createTextMutation.mutateAsync(textFormData);
        textId = newText.id;
      } else if (selectedText) {
        // Using existing text
        textId = selectedText.id;
      } else {
        throw new Error(t("create.noTextSelected"));
      }

      // Now create the instance
      const createdInstance = await createInstanceMutation.mutateAsync({ textId, instanceData, user:JSON.stringify(user || {}) });
      // The API returns { message: string, id: string }, so access id directly
      const instanceId = createdInstance?.id;
      
      if (!instanceId) {
        throw new Error(t("create.instanceCreationFailed"));
      }
      
      // Clear bibliography annotations only after successful instance creation
      clearAfterSubmission();
      
      // Store IDs for navigation
      setSuccessTextId(textId);
      setSuccessInstanceId(instanceId);
      
      // Show success notification
      setSuccess(
        isCreatingNewText
          ? t("create.textAndInstanceCreated")
          : t("create.instanceCreated")
      );
      
      // Clear form state (without navigating)
      setSelectedText(null);
      setTextSearch("");
      setIsCreatingNewText(false);
      clearFileUpload();
      hasAutoSelectedRef.current = true;
    } catch (err: any) {
      setError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle success modal close - navigate to instance page
  const handleSuccessModalClose = useCallback(() => {
    if (successTextId && successInstanceId) {
      navigate(`/texts/${successTextId}/instances/${successInstanceId}`);
    }
    setSuccess(null);
    setSuccessTextId(null);
    setSuccessInstanceId(null);
  }, [successTextId, successInstanceId, navigate]);

  // Close modal on ESC key
  useEffect(() => {
    if (!success) return;
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSuccessModalClose();
      }
    };
    
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [success, handleSuccessModalClose]);

  // Prevent background scroll while modal is open
  useEffect(() => {
    if (!success) return;
    
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [success]);

  // Handle cancel - reset file upload but keep text selection
  const handleCancel = () => {
    clearFileUpload();
    setError(null);
    setSuccess(null);
  };

  // Handle text selection from editor
  const handleEditorTextSelect = (
    text: string,
    type: "title" | "alt_title" | "colophon" | "incipit" | "alt_incipit" | "person"
  ) => {
    // Detect language from selected text
    const detectedLanguage = detectLanguage(text);

    switch (type) {
      case "title":
     
        textFormRef.current?.addTitle(text, detectedLanguage);
        setNotification(t("create.titleAddedSuccess"));
        setTimeout(() => setNotification(null), 2000);
        // Update hasTitle state
        setTimeout(() => {
          setHasTitle(textFormRef.current?.hasTitle() || false);
        }, 100);
        break;
      case "alt_title":
      
        textFormRef.current?.addAltTitle(text, detectedLanguage);
        setNotification(t("create.altTitleAddedSuccess"));
        setTimeout(() => setNotification(null), 2000);
        break;
      case "colophon":
        instanceFormRef.current?.addColophon(text);
        setNotification(t("create.colophonAddedSuccess"));
        setTimeout(() => setNotification(null), 2000);
        break;
      case "incipit":
        instanceFormRef.current?.addIncipit(text, detectedLanguage);
        setNotification(t("create.incipitAddedSuccess"));
        setTimeout(() => setNotification(null), 2000);
        // Update hasIncipit state
        setTimeout(() => {
          setHasIncipitTitle(instanceFormRef.current?.hasIncipit() || false);
        }, 100);
        break;
      case "alt_incipit":
        instanceFormRef.current?.addAltIncipit(text, detectedLanguage);
        setNotification(t("create.altIncipitAddedSuccess"));
        setTimeout(() => setNotification(null), 2000);
        break;
      case "person":
    
        textFormRef.current?.setPersonSearch(text);
        textFormRef.current?.openContributorForm();
        setNotification(t("create.personSearchFilled"));
        setTimeout(() => setNotification(null), 2000);
        break;
    }
  };

  // Check if upload should be enabled
  const canUpload = selectedText !== null || isCreatingNewText;

  // Show loading screen when auto-selecting text from URL
  const isAutoSelecting = t_id && (isLoadingTextFromUrl || (textFromUrl && !selectedText));

  // Utility: join class names
  const cn = (...classes: Array<string | false | null | undefined>) => {
    return classes.filter(Boolean).join(" ");
  };

  return (
    <>
      {/* Success Modal */}
      <AnimatePresence>
        {success && (
          <div
            aria-modal
            role="dialog"
            aria-labelledby="success-title"
            aria-describedby="success-desc"
            className="fixed inset-0 z-50 h-screen w-screen"
          >
            {/* Transparent backdrop */}
            <motion.div
              className="absolute inset-0 h-full w-full bg-black/20 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleSuccessModalClose}
            />

            {/* Decorative floating blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
                animate={{ x: [0, 20, -10, 0], y: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl"
                animate={{ x: [0, -15, 10, 0], y: [0, -10, 15, 0] }}
                transition={{ repeat: Infinity, duration: 14, ease: "easeInOut" }}
              />
            </div>

            {/* Modal card */}
            <div className="relative flex min-h-full items-center justify-center p-4 sm:p-8">
              <motion.div
                initial={{ y: 20, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 10, opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 220, damping: 22 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "relative w-full max-w-md",
                  "rounded-3xl border border-white/20 bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl",
                  "shadow-[0_10px_40px_-12px_rgba(0,0,0,0.35)]"
                )}
              >
                {/* Gradient ring */}
                <div className="pointer-events-none absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-white/70 via-emerald-300/40 to-transparent opacity-70 [mask:linear-gradient(#000,transparent_60%)]" />

                {/* Top bar with close */}
                <div className="relative px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/40">
                      <CheckCircle2 className="text-emerald-600" size={20} />
                    </div>
                    <h2 id="success-title" className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {t("create.success")}
                    </h2>
                  </div>

                  <button
                    onClick={handleSuccessModalClose}
                    className={cn(
                      "group inline-flex items-center justify-center rounded-full p-2.5",
                      "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
                      "ring-1 ring-black/5 hover:ring-black/10 transition"
                    )}
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Content */}
                <div className="relative px-6 pb-6 sm:px-8 sm:pb-8">
                  {/* Success message */}
                  <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-900">
                    <div className="relative px-6 py-5 sm:px-8 sm:py-6">
                      <p id="success-desc" className="text-base sm:text-lg font-medium text-gray-800 dark:text-gray-100 text-center">
                        {success || t("create.textAndInstanceCreated")}
                      </p>
                    </div>
                  </div>

                  {/* View Instance Button */}
                  <Button
                    onClick={handleSuccessModalClose}
                    className={cn(
                      "w-full bg-emerald-600 hover:bg-emerald-700 text-white",
                      "flex items-center justify-center gap-2 py-6 text-base font-medium",
                      "rounded-xl shadow-lg transition-all duration-200"
                    )}
                  >
                    <span>{t("create.viewInstance")}</span>
                    <ArrowRight size={18} />
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Toast - Success/Info Messages */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 flex items-center gap-3 max-w-sm">
            <span className="text-sm font-medium text-gray-800">{notification}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error Message - Clean Modal */}
      {error && (
        <div className="fixed inset-0 flex items-start justify-center z-50 pt-20 pointer-events-none">
          <div className="bg-white rounded-md shadow-lg border max-w-sm mx-4 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => setError(null)}
                  size="sm"
                  className="text-sm px-4"
                >
                  OK
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Beautiful Loading Screen - Show while auto-selecting text from URL */}
      {isAutoSelecting && (
        <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center z-40">
          <div className="text-center max-w-md mx-auto px-6">
            {/* Animated Logo/Icon */}
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-20 animate-ping"></div>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform">
                  <FileText className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>

            {/* Loading Text */}
            <h2 className="text-3xl font-bold text-gray-800 mb-3 animate-pulse">
              {t("loading.loadingText")}
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              {t("loading.preparingWorkspace")}
            </p>

            {/* Progress Indicator */}
            <div className="relative w-64 h-2 bg-gray-200 rounded-full overflow-hidden mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"></div>
            </div>

            {/* Additional Info */}
            <p className="text-sm text-gray-500 mt-6">
              {t("loading.fetchingDetails")}
            </p>
          </div>
        </div>
      )}

      {/* Loading Screen - Show while checking BDRC text */}
      {isCheckingBdrc && (
        <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 flex items-center justify-center z-40">
          <div className="text-center max-w-md mx-auto px-6">
            {/* Animated Logo/Icon */}
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full opacity-20 animate-ping"></div>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform">
                  <FileText className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>

            {/* Loading Text */}
            <h2 className="text-3xl font-bold text-gray-800 mb-3 animate-pulse">
              {t("loading.checkingBdrc")}
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              {t("loading.lookingForText")}
            </p>

            {/* Progress Indicator */}
            <div className="relative w-64 h-2 bg-gray-200 rounded-full overflow-hidden mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"></div>
            </div>

            {/* Additional Info */}
            <p className="text-sm text-gray-500 mt-6">
              {t("loading.checkingLocal")}
            </p>
          </div>
        </div>
      )}

      {/* Loading Screen - Show while creating text/instance */}
      {isSubmitting && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 flex items-center justify-center z-50">
          <div className="text-center max-w-md mx-auto px-6">
            {/* Animated Logo/Icon */}
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full opacity-20 animate-ping"></div>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform">
                  <FileText className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>

            {/* Loading Text */}
            <h2 className="text-3xl font-bold text-gray-800 mb-3 animate-pulse">
              {t("loading.creatingTextAndInstance")}
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              {t("loading.pleaseWait")}
            </p>

            {/* Progress Indicator */}
            <div className="relative w-64 h-2 bg-gray-200 rounded-full overflow-hidden mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"></div>
            </div>

            {/* Additional Info */}
            <p className="text-sm text-gray-500 mt-6">
              {t("loading.processingRequest")}
            </p>
          </div>
        </div>
      )}

      {/* Single Full-Page Message when text exists in cataloger */}
      {selectedText && !isCreatingNewText ? (
        <div className="fixed inset-0 top-16 left-0 right-0 bottom-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
            <div className="mb-6">
              <FileText className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                {t("create.textAlreadyInCataloger")}
              </h2>
              <div className="space-y-2 text-left bg-gray-50 rounded-md p-4 mb-4">
                <div className="text-sm">
                  <strong className="text-gray-700">{t("text.textTitle")}:</strong>{" "}
                  <span className="text-gray-900">{getTextDisplayName(selectedText)}</span>
                </div>
                <div className="text-sm">
                  <strong className="text-gray-700">{t("create.type")}:</strong>{" "}
                  <span className="text-gray-900">{selectedText.type}</span>
                </div>
                <div className="text-sm">
                  <strong className="text-gray-700">{t("text.language")}:</strong>{" "}
                  <span className="text-gray-900">{selectedText.language}</span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => {
                // Reset all state and navigate to clean /create page
                resetToInitialState();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 flex items-center gap-2 mx-auto"
            >
              <span className="text-lg">+</span>
              {t("common.create")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Two-Panel Layout - Show when creating new text or no text selected */}
          <div className="fixed  inset-0 top-16 left-0 right-0 bottom-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex">
            {/* Mobile Toggle Button */}
            <button
              onClick={() =>
                setActivePanel(activePanel === "form" ? "editor" : "form")
              }
              className="md:hidden fixed bottom-6 right-6 z-30  bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              {activePanel === "form" ? (
                <>
                  <Code className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("editor.content")}</span>
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("common.create")}</span>
                </>
              )}
            </button>

        {/* LEFT PANEL: Search + Forms */}
        <div
          className={`
            w-full md:w-1/2 h-full overflow-y-auto  border-r border-gray-200
            absolute md:relative
            transition-transform duration-300 ease-in-out
            ${
              activePanel === "form"
                ? "translate-x-0"
                : "-translate-x-full md:translate-x-0"
            }
          `}
        >
          <div className="p-8">
            {/* Text Search/Selection Section */}
            <div className="mb-8">
              <h2 className="text-[1.5rem]! font-bold mb-6 text-gray-800">
                {t("create.pageTitle")}
              </h2>
              
              <div className="space-y-4">
                {/* Search Input - Only show when no text is selected and not creating new */}
                {!selectedText && !isCreatingNewText && (
                  <div className="relative">
                    <Label
                      htmlFor="text-search"
                    >
                      {t("create.searchExistingText")}
                    </Label>
                    <input
                      id="text-search"
                      type="text"
                      value={textSearch}
                      onChange={handleTextSearchChange}
                      onFocus={() => setShowTextDropdown(true)}
                      onBlur={() => setTimeout(() => setShowTextDropdown(false), 200)}
                      className="w-full px-3 py-2 border bg-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t("create.searchPlaceholder")}
                    />

                    {/* Text Dropdown */}
                    {showTextDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
                        

                        {/* BDRC Results Section */}
                        {debouncedTextSearch.trim() && (
                          <>
                            <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700 uppercase">
                                {t("create.bdrcCatalog")}
                              </span>
                              {searchAttempts >= 3 && (
                                <span className="text-xs text-gray-500">
                                  {searchAttempts} searches
                                </span>
                              )}
                            </div>
                            
                            {/* Create New Text Button - Enabled after 3 attempts */}
                            {searchAttempts >= 3 && (
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent input blur
                                  handleCreateNewFromSearch();
                                }}
                                className="w-full px-4 py-3 text-left bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-b-2 border-green-300 transition-all duration-200"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-semibold text-sm text-green-900">
                                      {t("create.createNewText")}
                                    </div>
                                    <div className="text-xs text-green-700 mt-0.5">
                                      {t("create.createNewTextDesc")}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )}
                            
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
                          </>
                        )}

                     
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Text Info - COMMENTED OUT: Now shown in single full-page message */}
                {/* {selectedText && !isCreatingNewText && (
                  <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">
                        {t("create.selectedText")}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetToInitialState}
                      >
                        {t("create.change")}
                      </Button>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div>
                        <strong>{t("text.textTitle")}:</strong> {getTextDisplayName(selectedText)}
                      </div>
                      <div>
                        <strong>{t("create.type")}:</strong> {selectedText.type}
                      </div>
                      <div>
                        <strong>{t("text.language")}:</strong> {selectedText.language}
                      </div>
                    </div>
                  </div>
                )} */}

                {/* Creating New Text Info */}
                {isCreatingNewText && (
                  <div className="bg-green-50 border  border-green-200 px-4 py-3 rounded-md">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-900">
                        {t("create.creatingNewText")}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetToInitialState}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Forms Section - Show if in creation mode OR if text is selected */}
            {canUpload && (
              <div className="space-y-6 relative ">
                {/* Text Creation Form - Only show when creating new text */}
                 {isCreatingNewText && (
                   <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-6">
                  
                       <TextCreationForm 
                         ref={textFormRef}
                         onExistingTextFound={handleExistingTextFoundFromForm}
                       />
                   </div>
                 )}

                {/* Instance Creation Form - Show when text is selected or creating new with content */}
                {/* COMMENTED OUT: When text exists in cataloger, don't show instance form */}
                {/* {(selectedText || (isCreatingNewText && editedContent && editedContent.trim() !== "")) && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <InstanceCreationForm
                      ref={instanceFormRef}
                      onSubmit={handleInstanceCreation}
                      isSubmitting={isSubmitting}
                      onCancel={handleCancel}
                      content={editedContent}
                    />
                  </div>
                )} */}

                {/* Show instance form only when creating new text with content */}
                {isCreatingNewText && editedContent && editedContent.trim() !== "" && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <InstanceCreationForm
                      ref={instanceFormRef}
                      onSubmit={handleInstanceCreation}
                      isSubmitting={isSubmitting}
                      onCancel={handleCancel}
                      content={editedContent}
                      disableSubmit={!!contentValidationError || segmentValidation.invalidCount > 0}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

            {/* RIGHT PANEL: Editor with Optional File Upload */}
            {/* COMMENTED OUT: When text exists in cataloger, don't show editor */}
            {/* <div
              className={`
                w-full md:w-1/2 h-full overflow-hidden bg-gray-50
                absolute md:relative
                transition-transform duration-300 ease-in-out
                ${
                  activePanel === "editor"
                    ? "translate-x-0"
                    : "translate-x-full md:translate-x-0"
                }
              `}
            >
              <div className="h-full flex flex-col">
                <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    {!editedContent || editedContent?.trim() === "" ? (
                      <>
                        <p className="text-sm text-gray-600">
                          {t("create.startTyping")}
                        </p>
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                const file = files[0];
                                
                                if (file.size < 1024) {
                                  alert(t("create.fileTooSmall"));
                                  e.target.value = '';
                                  return;
                                }
                                
                                if (!file.name.endsWith('.txt')) {
                                  alert(t("create.uploadTxtOnly"));
                                  e.target.value = '';
                                  return;
                                }
                                
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const content = event.target?.result as string;
                                  handleFileUpload(content, file.name);
                                };
                                reader.readAsText(file);
                              }
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              fileInputRef.current?.click();
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            {t("create.uploadFile")}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {editedContent?.length} {t("create.characters")}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  <TextEditorView
                    content={editedContent || ""}
                    filename={editedContent ? uploadedFilename : t("editor.newDocument")}
                    editable={true}
                    onChange={(value) => setEditedContent(value)}
                    onTextSelect={handleEditorTextSelect}
                    isCreatingNewText={isCreatingNewText}
                    hasIncipit={hasIncipitTitle}
                    hasTitle={hasTitle}
                    allowedTypes={
                      selectedText && !isCreatingNewText
                        ? ["colophon", "incipit", "alt_incipit"]
                        : undefined
                    }
                    validationError={contentValidationError}
                    segmentValidation={segmentValidation}
                  />
                </div>
              </div>
            </div> */}

            {/* RIGHT PANEL: Editor - Show when creating new text or no text selected */}
            <div
              className={`
                w-full md:w-1/2 h-full overflow-hidden bg-gray-50
                absolute md:relative
                transition-transform duration-300 ease-in-out
                ${
                  activePanel === "editor"
                    ? "translate-x-0"
                    : "translate-x-full md:translate-x-0"
                }
              `}
            >
              {/* Editor View */}
              <div className="h-full flex flex-col">
                {/* Upload Button in Header */}
                <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    {!editedContent || editedContent?.trim() === "" ? (
                      <>
                        <p className="text-sm text-gray-600 ">
                          {t("create.startTyping")}
                        </p>
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                const file = files[0];
                                
                                // Validate file size
                                if (file.size < 1024) {
                                  alert(t("create.fileTooSmall"));
                                  e.target.value = '';
                                  return;
                                }
                                
                                // Validate file type
                                if (!file.name.endsWith('.txt')) {
                                  alert(t("create.uploadTxtOnly"));
                                  e.target.value = '';
                                  return;
                                }
                                
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const content = event.target?.result as string;
                                  handleFileUpload(content, file.name);
                                };
                                reader.readAsText(file);
                              }
                              e.target.value = ''; // Reset input
                            }}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              fileInputRef.current?.click();
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            {t("create.uploadFile")}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {editedContent?.length} {t("create.characters")}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Editor */}
                <div className="flex-1 overflow-hidden">
                  <TextEditorView
                    content={editedContent || ""}
                    filename={editedContent ? uploadedFilename : t("editor.newDocument")}
                    editable={true}
                    onChange={(value) => setEditedContent(value)}
                    onTextSelect={handleEditorTextSelect}
                    isCreatingNewText={isCreatingNewText}
                    hasIncipit={hasIncipitTitle}
                    hasTitle={hasTitle}
                    allowedTypes={
                     
                      selectedText && !isCreatingNewText
                        ? ["colophon", "incipit", "alt_incipit"]
                        : undefined // Show all options when creating new text
                    }
                    validationError={contentValidationError}
                    segmentValidation={segmentValidation}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default EnhancedTextCreationForm;
