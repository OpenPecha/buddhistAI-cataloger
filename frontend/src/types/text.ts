// Types for OpenPecha API response
export interface AltTitle {
  [language: string]: string;
}

export interface Contribution {
  person_bdrc_id: string;
  person_id: string;
  role: string;
}

export interface Title {
  [language: string]: string;
}

export interface OpenPechaText {
  alt_titles: AltTitle[];
  bdrc: string;
  contributions: Contribution[];
  date: string | null;
  id: string;
  language: string;
  target: string | null;
  title: Title;
  type: string;
  wiki: string | null;
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

// Instance list item (flat structure from GET /text/{text_id}/instances)
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

// Single instance detail (nested structure from GET /v2/instances/{instance_id})
export interface OpenPechaTextInstance {
  content: string;
  metadata: InstanceMetadata;
  annotations: Annotations | AnnotationReference[] | null;
  // Legacy fields for backward compatibility (optional)
  alignment_sources?: string[];
  alignment_targets?: string[];
}

// Response when creating a new instance (POST /text/{id}/instances)
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

// Related instance metadata
export interface RelatedInstanceMetadata {
  instance_type: string;
  source?: string | null;
  text_id: string;
  title: Title;
  alt_titles: AltTitle[];
  language: string;
  contributions: RelatedInstanceContribution[];
}

// Related instance response from GET /instances/{instance_id}/related
export interface RelatedInstance {
  instance_id: string;
  metadata: RelatedInstanceMetadata;
  annotation?: string | null;
  relationship: string;
}