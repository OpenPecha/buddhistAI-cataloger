/**
 * Detects the dominant language in a text based on Unicode character ranges
 * @param text - The text to analyze
 * @returns Language code (bo, en, sa, zh, lzh, hi, it, cmg) or empty string if can't detect
 */
export const detectLanguage = (text: string): string => {
  if (!text || text.trim().length === 0) {
    return "";
  }

  const counts = {
    bo: 0,
    zh: 0,
    sa: 0,
    en: 0,
  };

  for (const char of text) {
    const code = char.charCodeAt(0);

    if (code >= 0x0f00 && code <= 0x0fff) {
      counts.bo++;
    } else if (code >= 0x4e00 && code <= 0x9fff) {
      counts.zh++;
    } else if (code >= 0x0900 && code <= 0x097f) {
      counts.sa++;
    } else if (
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
    return dominantLang;
  }

  return "";
};
