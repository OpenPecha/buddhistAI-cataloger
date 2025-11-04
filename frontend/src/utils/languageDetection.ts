/**
 * Detects the dominant language in a text based on Unicode character ranges
 * @param text - The text to analyze
 * @returns Language code (bo, en, sa, zh, fr, mn, pi, cmg, ja, ru, lzh) or empty string if can't detect
 */
export const detectLanguage = (text: string): string => {
  if (!text || text.trim().length === 0) {
    return "";
  }

  const counts = {
    bo: 0,      // Tibetan
    zh: 0,      // Chinese / Literary Chinese (lzh)
    sa: 0,      // Sanskrit / Pali (pi)
    en: 0,      // English / French (fr)
    ja: 0,      // Japanese
    ru: 0,      // Russian
    mn: 0,      // Mongolian / Classical Mongolian (cmg)
  };

  for (const char of text) {
    const code = char.charCodeAt(0);

    // Tibetan (bo)
    if (code >= 0x0f00 && code <= 0x0fff) {
      counts.bo++;
    } 
    // Chinese characters (zh, lzh, ja also uses these)
    else if (code >= 0x4e00 && code <= 0x9fff) {
      counts.zh++;
    } 
    // Devanagari script (sa, pi)
    else if (code >= 0x0900 && code <= 0x097f) {
      counts.sa++;
    } 
    // Japanese Hiragana
    else if (code >= 0x3040 && code <= 0x309f) {
      counts.ja++;
    }
    // Japanese Katakana
    else if (code >= 0x30a0 && code <= 0x30ff) {
      counts.ja++;
    }
    // Cyrillic script (ru)
    else if (code >= 0x0400 && code <= 0x04ff) {
      counts.ru++;
    }
    // Mongolian script (mn, cmg)
    else if (code >= 0x1800 && code <= 0x18af) {
      counts.mn++;
    }
    // Latin characters (en, fr, pi when using Latin)
    else if (
      (code >= 0x0041 && code <= 0x005a) ||
      (code >= 0x0061 && code <= 0x007a) ||
      (code >= 0x00c0 && code <= 0x00ff)
    ) {
      counts.en++;
    }
  }

  let maxCount = 0;
  let dominantLang = "";

  for (const [lang, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantLang = lang;
    }
  }

  const totalChars = text.length;
  if (maxCount > 0 && maxCount / totalChars >= 0.3) {
    // Special handling for scripts that overlap
    if (dominantLang === "zh") {
      // Japanese uses Chinese characters too, but has Hiragana/Katakana
      if (counts.ja > 0) {
        return "ja";
      }
      // Literary Chinese (lzh) uses same characters as modern Chinese
      // For now, return zh (user can manually change if needed)
      return "zh";
    }
    
    if (dominantLang === "en") {
      // French uses Latin script with similar range
      // For now, return en (user can manually select fr if needed)
      return "en";
    }
    
    if (dominantLang === "sa") {
      // Pali uses same Devanagari script
      // For now, return sa (user can manually select pi if needed)
      return "sa";
    }
    
    if (dominantLang === "mn") {
      // Classical Mongolian uses same script
      // For now, return mn (user can manually select cmg if needed)
      return "mn";
    }
    
    return dominantLang;
  }

  return "";
};
