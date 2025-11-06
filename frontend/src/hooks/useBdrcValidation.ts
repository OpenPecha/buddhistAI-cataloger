import { useState, useEffect } from "react";

export type BdrcValidationStatus = "idle" | "validating" | "valid" | "invalid";

/**
 * Custom hook for validating BDRC IDs against the BDRC autocomplete API
 * 
 * @param bdrcId - The BDRC ID to validate
 * @param debounceMs - Debounce delay in milliseconds (default: 500ms)
 * @returns validation status and helper functions
 */
export function useBdrcValidation(bdrcId: string, debounceMs: number = 500) {
  const [validationStatus, setValidationStatus] = useState<BdrcValidationStatus>("idle");

  useEffect(() => {
    // If BDRC ID is empty, reset to idle
    if (!bdrcId.trim()) {
      setValidationStatus("idle");
      return;
    }

    // Set to validating immediately when user types
    setValidationStatus("validating");

    // Debounce API call
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("https://autocomplete.bdrc.io/autosuggest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: bdrcId.trim() }),
        });

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          setValidationStatus("valid");
        } else {
          setValidationStatus("invalid");
        }
      } catch (error) {
        console.error("Error validating BDRC ID:", error);
        setValidationStatus("invalid");
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [bdrcId, debounceMs]);

  const resetValidation = () => {
    setValidationStatus("idle");
  };

  return {
    validationStatus,
    resetValidation,
    isValidating: validationStatus === "validating",
    isValid: validationStatus === "valid",
    isInvalid: validationStatus === "invalid",
    isIdle: validationStatus === "idle",
  };
}

