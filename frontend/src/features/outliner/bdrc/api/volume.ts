const BDRC_OTAPI_BASE = import.meta.env.VITE_BDRC_BACKEND_URL;
const BDRC_VERSION = 'v1';

export interface BdrcOtVolumesQueryParams {
  batch_id?: number | string | null;
  offset?: number;
  limit?: number;
}

export interface BdrcOtVolumeRow {
  id?: string;
  [key: string]: unknown;
}

export type BdrcOtVolumeDetail = BdrcOtVolumeRow;

export interface BdrcOtVolumesListResponse {
  total: number;
  offset: number;
  limit: number;
  items: BdrcOtVolumeRow[];
}

function appendParam(
  params: URLSearchParams,
  key: string,
  value: string | number | null | undefined
): void {
  if (value == null) return;
  const t = typeof value === 'string' ? value.trim() : String(value);
  if (t !== '') params.set(key, t);
}

function normalizeVolumesPayload(data: unknown): BdrcOtVolumesListResponse {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const items = Array.isArray(o.items) ? (o.items as BdrcOtVolumeRow[]) : [];
    const total = typeof o.total === 'number' ? o.total : items.length;
    const offset = typeof o.offset === 'number' ? o.offset : 0;
    const limit = typeof o.limit === 'number' ? o.limit : items.length;
    return { total, offset, limit, items };
  }
  return { total: 0, offset: 0, limit: 0, items: [] };
}

/**
 * List / filter volume records via BEC OT API `GET /api/v1/volumes`.
 *
 * Example:
 * `GET /api/v1/volumes?batch_id=1&offset=0&limit=200`
 */
export async function fetchBdrcOtVolumes(
  query: BdrcOtVolumesQueryParams,
  init?: RequestInit
): Promise<BdrcOtVolumesListResponse> {
  const params = new URLSearchParams();
  appendParam(params, 'batch_id', query.batch_id ?? undefined);

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  params.set('offset', String(Math.max(0, offset)));
  params.set('limit', String(Math.min(200, Math.max(1, limit))));

  const qs = params.toString();
  const basePath = `${BDRC_OTAPI_BASE}/api/${BDRC_VERSION}/volumes`;
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
      `BDRC volumes list failed: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();
  return normalizeVolumesPayload(data);
}

/**
 * Fetch a single volume via BEC OT API `GET /api/v1/volumes/{volume_id}`.
 */
export async function fetchBdrcOtVolume(
  volumeId: string,
  init?: RequestInit
): Promise<BdrcOtVolumeDetail> {
  const trimmed = volumeId.trim();
  if (!trimmed) throw new Error('volumeId is required');

  const url = `${BDRC_OTAPI_BASE}/api/${BDRC_VERSION}/volumes/${encodeURIComponent(
    trimmed
  )}`;

  const headers = new Headers(init?.headers);
  headers.set('accept', 'application/json');

  const response = await fetch(url, {
    ...init,
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `BDRC volume fetch failed: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();
  if (data && typeof data === 'object') return data as BdrcOtVolumeDetail;
  return {};
}

