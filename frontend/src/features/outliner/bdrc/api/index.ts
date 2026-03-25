const BDRC_OTAPI_BASE = import.meta.env.VITE_BDRC_BACKEND_URL;
const BDRC_VERSION='v1';


export async function searchBdrcOtWorksByTitle(
  title: string,
  init?: RequestInit
): Promise<unknown[]> {
  const params = new URLSearchParams({ title });
  const url = `${BDRC_OTAPI_BASE}/api/${BDRC_VERSION}/works/search?${params.toString()}`;
  const headers = new Headers(init?.headers);
  headers.set('accept', 'application/json');
  const response = await fetch(url, {
    ...init,
    method: 'GET',
    headers,
  });
  if (!response.ok) {
    throw new Error(`BDRC works search failed: ${response.status} ${response.statusText}`);
  }
  const data: unknown = await response.json();
  return Array.isArray(data) ? data : [];
}
