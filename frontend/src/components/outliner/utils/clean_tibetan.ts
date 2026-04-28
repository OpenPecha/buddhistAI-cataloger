export default function cleanTibetanText(text: string) {
    /**
     * Normalize Tibetan title or author strings according to the rules:
     *
     * 1. Remove trailing Tibetan punctuation: ་།, །, ་
     * 2. Inspect the final character:
     *    - If it ends with ག, ཤ, ཞ, or ཀ: do not add punctuation
     *    - If it ends with ང: add ་།
     *    - Otherwise: add །
     */
  
    if (typeof text !== "string") {
      return text;
    }
  
    let s = text.trim();
  
    const endingsToRemove = ["་།", "།", "་"];
  
    let done = false;
  
    while (!done) {
      done = true;
  
      for (const ending of endingsToRemove) {
        if (s.endsWith(ending)) {
          s = s.slice(0, -ending.length);
          done = false;
          break;
        }
      }
    }
  
    s = s.trim();
  
    if (!s) {
      return s;
    }
  
    const finalChar = s[s.length - 1];
  
    if (["ག", "ཤ", "ཞ", "ཀ"].includes(finalChar)) {
      return s;
    } else if (finalChar === "ང") {
      return s + "་།";
    } else {
      return s + "།";
    }
  }