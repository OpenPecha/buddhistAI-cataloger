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

export interface MergeBdrcWorksPayload {
  parent_work_id: string
  searched_work_id: string
  modified_by?: string
}

/**
 * Merge a duplicate work into the canonical parent (POST /bdrc/works/merge).
 * OTAPI absorbs searched_work_id into parent_work_id.
 */
export async function mergeBdrcWorks(
  payload: MergeBdrcWorksPayload
): Promise<Record<string, unknown>> {
  const modifiedBy = payload.modified_by?.trim()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (modifiedBy) {
    headers['X-User-Email'] = modifiedBy
  }
  const response = await fetch(`${API_URL}/bdrc/works/merge`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Failed to merge BDRC works (${response.status})`)
  }

  const text = await response.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

export interface MergeBdrcPersonsPayload {
  parent_person_id: string
  searched_person_id: string
  modified_by?: string
}

/**
 * Merge a duplicate person into the canonical parent (POST /bdrc/persons/merge).
 * OTAPI absorbs searched_person_id into parent_person_id.
 */
export async function mergeBdrcPersons(
  payload: MergeBdrcPersonsPayload
): Promise<Record<string, unknown>> {
  const modifiedBy = payload.modified_by?.trim()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (modifiedBy) {
    headers['X-User-Email'] = modifiedBy
  }
  const response = await fetch(`${API_URL}/bdrc/persons/merge`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Failed to merge BDRC persons (${response.status})`)
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
  authors?: { id: string; name: string; pref_label_bo?: string }[]
}

/**
 * Find matching works for a text span (POST /bdrc/matching/find-work).
 * Returns a list of { id, name, score }.
 */
export async function findMatchingBdrcWork(
  payload: FindMatchingBdrcWorkPayload,
  options?: { signal?: AbortSignal }
): Promise<BdrcMatchingSuggestion[]> {
  const response = await fetch(`${API_URL}/bdrc/matching/find-work`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: options?.signal,
  })
 
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Failed to find matching BDRC work (${response.status})`)
  }

  const data: unknown = await response.json()
  if (!Array.isArray(data)) {
    return []
  }
  
  return data
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
