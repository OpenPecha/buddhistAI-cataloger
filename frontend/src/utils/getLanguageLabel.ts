const labels: Record<string, string> = {
  bo: 'Tibetan',
  en: 'English',
  zh: 'Chinese',
  sa: 'Sanskrit',
  fr: 'French',
  mn: 'Mongolian',
  pi: 'Pali',
  cmg: 'Classical Mongolian',
  ja: 'Japanese',
  ru: 'Russian',
  lzh: 'Literary Chinese',
  tib: 'Spoken Tibetan',
};

export function getLanguageLabel(language: string): string {
  return labels[language] || language.toUpperCase();
}