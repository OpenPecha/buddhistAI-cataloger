export interface NormalizedCategory {
  id: string;
  parent: string | null;
  title: string;
  has_child: boolean;
}

function asCategoryId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function languageBase(language: string): string {
  return language.split('-')[0]?.toLowerCase() || 'bo';
}

function pickLocalizedTitle(title: unknown, language: string): string {
  if (typeof title === 'string') return title;
  if (title && typeof title === 'object' && !Array.isArray(title)) {
    const t = title as Record<string, string>;
    const code = languageBase(language);
    if (t[code]?.trim()) return t[code];
    if (t.en?.trim()) return t.en;
    if (t.bo?.trim()) return t.bo;
    const first = Object.values(t).find((v) => typeof v === 'string' && v.trim());
    return first ?? '';
  }
  return '';
}

export function normalizeOpenpechaCategory(
  raw: Record<string, unknown>,
  language: string
): NormalizedCategory {
  const id = asCategoryId(raw.id);
  const parent =
    (raw.parent_id as string | null | undefined) ??
    (raw.parent as string | null | undefined) ??
    null;

  if (typeof raw.title === 'string' && typeof raw.has_child === 'boolean') {
    return {
      id,
      parent,
      title: raw.title,
      has_child: raw.has_child,
    };
  }

  const children = raw.children;
  const hasChild = Array.isArray(children) && children.length > 0;

  return {
    id,
    parent,
    title: pickLocalizedTitle(raw.title, language),
    has_child: hasChild,
  };
}

export function normalizeOpenpechaCategoryList(
  data: unknown,
  language: string
): NormalizedCategory[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) =>
    normalizeOpenpechaCategory(item as Record<string, unknown>, language)
  );
}
