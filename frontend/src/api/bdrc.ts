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
