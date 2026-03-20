import { API_URL } from '@/config/api'

export interface CreateBdrcWorkPayload {
  pref_label_bo?: string
  alt_label_bo?: string[]
  authors?: string[]
  versions?: string[]
  modified_by?: string
}

export interface CreateBdrcWorkResponse {
  id: string
  pref_label_bo?: string
  [key: string]: unknown
}

/**
 * Create a work in BDRC via OTAPI (POST /bdrc/works).
 * Returns the created work; use response.id and response.pref_label_bo for selection.
 */
export async function createBdrcWork(
  payload: CreateBdrcWorkPayload
): Promise<CreateBdrcWorkResponse> {
  const response = await fetch(`${API_URL}/bdrc/works`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Failed to create BDRC work (${response.status})`)
  }

  const data = (await response.json()) as Record<string, unknown>
  const id = (data?.id ?? data?.work_id) as string | undefined
  if (!id) {
    throw new Error('Invalid response: missing work id')
  }
  return { ...data, id } as CreateBdrcWorkResponse
}

export type UpdateBdrcWorkPayload = CreateBdrcWorkPayload

/**
 * Update a work in BDRC via OTAPI (PUT /bdrc/works/{workId}).
 */
export async function updateBdrcWork(
  workId: string,
  payload: UpdateBdrcWorkPayload
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_URL}/bdrc/works/${encodeURIComponent(workId)}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Failed to update BDRC work (${response.status})`)
  }

  const text = await response.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

export interface FindMatchingBdrcWorkPayload {
  text_bo: string
  volume_id: string
  cstart: number
  cend: number
}

/** Normalized row from POST /bdrc/matching/find-work */
export interface BdrcMatchingSuggestion {
  id: string
  name?: string
  score?: number | null
}

/**
 * Find matching works for a text span (POST /bdrc/matching/find-work).
 * Returns a list of { id, name, score }.
 */
export async function findMatchingBdrcWork(
  payload: FindMatchingBdrcWorkPayload
): Promise<BdrcMatchingSuggestion[]> {
  const response = await fetch(`${API_URL}/bdrc/matching/find-work`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Failed to find matching BDRC work (${response.status})`)
  }

  const data: unknown = await response.json()
  if (!Array.isArray(data)) {
    return []
  }
  const out: BdrcMatchingSuggestion[] = []
  for (const row of data) {
    if (typeof row !== 'object' || row === null || !('id' in row)) continue
    const r = row as { id?: unknown; name?: unknown; score?: unknown }
    const id =
      typeof r.id === 'string' || typeof r.id === 'number' ? String(r.id) : ''
    if (!id) continue
    let name: string | undefined
    if (typeof r.name === 'string') name = r.name
    else if (typeof r.name === 'number') name = String(r.name)
    let score: number | null = null
    if (typeof r.score === 'number') score = r.score
    else if (typeof r.score === 'string' && r.score.trim() !== '') {
      const n = Number(r.score)
      if (!Number.isNaN(n)) score = n
    }
    out.push({ id, name, score })
  }
  return out
}

export interface CreateBdrcPersonPayload {
  pref_label_bo?: string
  alt_label_bo?: string[]
  dates?: string
  modified_by?: string
}

export interface CreateBdrcPersonResponse {
  id: string
  pref_label_bo?: string
  [key: string]: unknown
}

/**
 * Create a person in BDRC via OTAPI (POST /bdrc/persons).
 * Returns the created person; use response.id and response.pref_label_bo for selection.
 */
export async function createBdrcPerson(
  payload: CreateBdrcPersonPayload
): Promise<CreateBdrcPersonResponse> {
  const response = await fetch(`${API_URL}/bdrc/persons`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Failed to create BDRC person (${response.status})`)
  }

  const data = (await response.json()) as Record<string, unknown>
  const id = (data?.id ?? data?.person_id) as string | undefined
  if (!id) {
    throw new Error('Invalid response: missing person id')
  }
  return { ...data, id } as CreateBdrcPersonResponse
}
