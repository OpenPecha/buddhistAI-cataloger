// Types for OpenPecha API response

/** Matches backend LicenseType / OpenAPI enum */
export const LICENSE_TYPES = [
  "cc0",
  "public",
  "cc-by",
  "cc-by-sa",
  "cc-by-nd",
  "cc-by-nc",
  "cc-by-nc-sa",
  "cc-by-nc-nd",
  "copyrighted",
  "unknown",
] as const;

export type LicenseType = (typeof LICENSE_TYPES)[number];

/** Map stored/API license strings onto LicenseType for selects */
export function coerceLicense(value: string | null | undefined): LicenseType {
  if (!value) return "public";
  const k = value
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "-")
    .replaceAll("_", "-");
  if ((LICENSE_TYPES as readonly string[]).includes(k)) {
    return k as LicenseType;
  }
  return "unknown";
}

/** POST /text body (cataloger CreateText) */
export interface CreateTextPayload {
  title: Record<string, string>;
  language: string;
  alt_titles?: Record<string, string>[];
  bdrc?: string;
  wiki?: string;
  date?: string;
  commentary_of?: string;
  translation_of?: string;
  category_id?: string;
  license?: LicenseType;
  contributions?: Array<Record<string, string | undefined>>;
  tag_ids?: string[];
}

export interface CreateTextResponse {
  message: string;
  id: string;
}

/** PUT /text/{id} body (cataloger UpdateText) */
export interface UpdateTextPayload {
  title?: Record<string, string>;
  bdrc?: string;
  wiki?: string;
  copyright?: string;
  license?: LicenseType;
  contributions?: Contribution[];
  date?: string;
  alt_title?: Record<string, string[]>;
  category_id?: string;
}

export interface AltTitle {
  [language: string]: string;
}

export interface Contribution {
  person_bdrc_id?: string;
  person_id?: string;
  ai_id?: string;
  role: string;
  person_name?: {
    [language: string]: string;
  };
}

export interface Title {
  [language: string]: string;
}

// Revised according to the new sample data interface
export interface OpenPechaText {
  bdrc: string | null;
  wiki: string | null;
  date: string | null;
  title: Title;
  alt_titles: AltTitle[] | null;
  language: string;
  commentary_of: string | null;
  translation_of: string | null;
  category_id: string;
  license: string;
  id: string;
  contributions: Contribution[];
  commentaries: string[];
  translations: string[];
  editions: string[];
  tag_ids: string[];
}

export interface Span {
  end: number;
  start: number;
}

export interface SegmentationAnnotation {
  id: string;
  index: number;
  span: Span;
}

export interface Annotations {
  [key: string]: unknown[];
}

export interface AnnotationReference {
  annotation_id: string;
  type: string;
}

export interface IncipitTitle {
  [language: string]: string;
}

// Edition list item (flat structure from GET /text/{text_id}/editions)
export interface OpenPechaTextInstanceListItem {
  id: string;
  type: string;
  source: string | null;
  bdrc: string | null;
  wiki: string | null;
  colophon: string | null;
  incipit_title: IncipitTitle | null;
  alt_incipit_titles: any[] | null;
}

export interface InstanceMetadata {
  id: string;
  type: string;
  copyright: string;
  bdrc: string | null;
  wiki: string | null;
  colophon: string | null;
  incipit_title: IncipitTitle | null;
  alt_incipit_titles: string | null;
}

// Single edition detail (nested structure from GET /editions/{edition_id})
export interface OpenPechaTextInstance {
  content: string;
  metadata: InstanceMetadata;
  annotations: Annotations | AnnotationReference[] | null;
  // Legacy fields for backward compatibility (optional)
  alignment_sources?: string[];
  alignment_targets?: string[];
}

// Response when creating a new edition (POST /text/{id}/editions)
export interface CreateInstanceResponse {
  message: string;
  id: string;
}

// Related instance contribution
export interface RelatedInstanceContribution {
  person_id: string;
  person_name?: string | null;
  role: string;
}

// Related edition metadata
export interface RelatedInstanceMetadata {
  edition_type?: string;
  /** @deprecated Prefer edition_type */
  instance_type?: string;
  source?: string | null;
  text_id: string;
  title: Title;
  alt_titles: AltTitle[];
  language: string;
  contributions: RelatedInstanceContribution[];
}

// Related edition response from GET /editions/{edition_id}/related
export interface RelatedInstance {
  edition_id?: string;
  /** @deprecated Prefer edition_id */
  instance_id?: string;
  metadata: RelatedInstanceMetadata;
  annotation?: string | null;
  relationship: string;
}