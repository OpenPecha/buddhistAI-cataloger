const BDRC_OTAPI_BASE = import.meta.env.VITE_BDRC_BACKEND_URL;
const BDRC_VERSION = 'v1';

export interface BdrcOtPersonsQueryParams {
  pref_label_bo?: string | null;
  modified_by?: string | null;
  record_origin?: string | null;
  record_status?: string | null;
  offset?: number;
  limit?: number;
}

export interface BdrcOtPersonRow {
  id: string;
  origin?: string;
  record_status?: string;
  record_status_matching?: string;
  canonical_id?: string | null;
  curation?: {
    modified?: boolean;
    modified_at?: string | null;
    modified_by?: string | null;
    edit_version?: number;
    status?: string;
    status_matching?: string;
  } | null;
  source_meta?: { updated_at?: string };
  import_meta?: { last_run_at?: string; last_result?: string };
  db_score?: number;
  pref_label_bo?: string | null;
  alt_label_bo?: string[];
  dates?: string | null;
}

export interface BdrcOtPersonsListResponse {
  total: number;
  offset: number;
  limit: number;
  items: BdrcOtPersonRow[];
}

function appendParam(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined
): void {
  if (value == null) return;
  const t = typeof value === 'string' ? value.trim() : String(value);
  if (t !== '') params.set(key, t);
}

function normalizePersonsPayload(data: unknown): BdrcOtPersonsListResponse {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const items = Array.isArray(o.items)
      ? (o.items as BdrcOtPersonRow[])
      : [];
    const total = typeof o.total === 'number' ? o.total : items.length;
    const offset = typeof o.offset === 'number' ? o.offset : 0;
    const limit = typeof o.limit === 'number' ? o.limit : items.length;
    return { total, offset, limit, items };
  }
  return { total: 0, offset: 0, limit: 0, items: [] };
}

/**
 * List / filter person records via BEC OT API `GET /api/v1/persons`.
 */
export async function fetchBdrcOtPersons(
  query: BdrcOtPersonsQueryParams,
  init?: RequestInit
): Promise<BdrcOtPersonsListResponse> {
  const params = new URLSearchParams();
  appendParam(params, 'pref_label_bo', query.pref_label_bo ?? undefined);
  appendParam(params, 'modified_by', query.modified_by ?? undefined);
  appendParam(params, 'record_origin', query.record_origin ?? undefined);
  appendParam(params, 'record_status', query.record_status ?? undefined);

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  params.set('offset', String(Math.max(0, offset)));
  params.set('limit', String(Math.min(200, Math.max(1, limit))));

  const qs = params.toString();
  const basePath = `${BDRC_OTAPI_BASE}/api/${BDRC_VERSION}/persons`;
  const url = qs ? `${basePath}?${qs}` : basePath;
  const headers = new Headers(init?.headers);
  headers.set('accept', 'application/json');
  const response = await fetch(url, {
    ...init,
    method: 'GET',
    headers,
  });
  if (!response.ok) {
    throw new Error(
      `BDRC persons list failed: ${response.status} ${response.statusText}`
    );
  }
  const data: unknown = await response.json();
  return normalizePersonsPayload(data);
}
