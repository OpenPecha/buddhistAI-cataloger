const BDRC_OTAPI_BASE = import.meta.env.VITE_BDRC_BACKEND_URL;
const BDRC_VERSION = 'v1';

/** Query params for GET /api/v1/works (same filters as /works/search per OTAPI). */
export interface BdrcOtWorksQueryParams {
  /** Legacy / alternate filter; sent when non-empty. */
  title?: string | null;
  pref_label_bo?: string | null;
  modified_by?: string | null;
  record_origin?: string | null;
  record_status?: string | null;
  author_id?: string | null;
  /** Default 0 */
  offset?: number;
  /** Default 20; API max typically 200 */
  limit?: number;
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

function normalizeWorksPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const items = o.results ?? o.items ?? o.data ?? o.works;
    if (Array.isArray(items)) return items;
  }
  return [];
}

/**
 * List / filter work records via BEC OT API `GET /api/v1/works`.
 */
export async function fetchBdrcOtWorks(
  query: BdrcOtWorksQueryParams,
  init?: RequestInit
): Promise<unknown[]> {
  const params = new URLSearchParams();
  appendParam(params, 'title', query.title ?? undefined);
  appendParam(params, 'pref_label_bo', query.pref_label_bo ?? undefined);
  appendParam(params, 'modified_by', query.modified_by ?? undefined);
  appendParam(params, 'record_origin', query.record_origin ?? undefined);
  appendParam(params, 'record_status', query.record_status ?? undefined);
  appendParam(params, 'author_id', query.author_id ?? undefined);

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 20;
  params.set('offset', String(Math.max(0, offset)));
  params.set('limit', String(Math.min(200, Math.max(1, limit))));

  const qs = params.toString();
  const basePath = `${BDRC_OTAPI_BASE}/api/${BDRC_VERSION}/works`;
  const url = qs ? `${basePath}?${qs}` : basePath;
  const headers = new Headers(init?.headers);
  headers.set('accept', 'application/json');
  const response = await fetch(url, {
    ...init,
    method: 'GET',
    headers,
  });
  if (!response.ok) {
    throw new Error(`BDRC works list failed: ${response.status} ${response.statusText}`);
  }
  const data: unknown = await response.json();
  return normalizeWorksPayload(data);
}

/** @deprecated Use {@link fetchBdrcOtWorks} with `{ title }`. */
export async function searchBdrcOtWorksByTitle(
  title: string,
  init?: RequestInit
): Promise<unknown[]> {
  return fetchBdrcOtWorks({ title: title.trim() || undefined, limit: 20, offset: 0 }, init);
}
