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

export const getLanguageColor = (lang: string): string => {
  const colors: Record<string, string> = {
    bo: 'bg-red-100 text-red-800',
    en: 'bg-blue-100 text-blue-800',
    sa: 'bg-orange-100 text-orange-800',
    zh: 'bg-green-100 text-green-800',
    fr: 'bg-yellow-100 text-yellow-800',
    mn: 'bg-purple-100 text-purple-800',
    pi: 'bg-pink-100 text-pink-800',
    cmg: 'bg-gray-100 text-gray-800',
    ja: 'bg-indigo-100 text-indigo-800',
    ru: 'bg-teal-100 text-teal-800',
    lzh: 'bg-lime-100 text-lime-800',
    tib: 'bg-cyan-100 text-cyan-800',
  };
  return colors[lang] || 'bg-gray-100 text-gray-800';
};