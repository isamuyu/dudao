import type { FileMeta, PresignResponse } from './types'

const BASE: string = import.meta.env.VITE_API_BASE ?? '/api'
const TOKEN_KEY = 'wza-token'

/** 401 时广播，AuthContext 监听后回到登录页 */
export const UNAUTHORIZED_EVENT = 'wza:unauthorized'

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (typeof options.body === 'string') headers['Content-Type'] = 'application/json'

  const res = await fetch(BASE + path, { ...options, headers })

  if (res.status === 401) {
    setToken(null)
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new ApiError(401, '登录已过期，请重新登录')
  }
  if (!res.ok) {
    let message = `请求失败（${res.status}）`
    let data: unknown
    try {
      data = await res.json()
      const m = (data as { message?: unknown })?.message
      if (typeof m === 'string') message = m
      else if (Array.isArray(m)) message = m.join('；')
    } catch { /* 非 JSON 响应 */ }
    throw new ApiError(res.status, message, data)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const apiGet = <T>(path: string) => api<T>(path)
export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
export const apiPatch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) })

/** 供 <img> 使用的文件 URL（鉴权走 ?token=） */
export function fileUrl(id: string): string {
  return `${BASE}/files/${id}?token=${encodeURIComponent(getToken() ?? '')}`
}

/** 预签名 + PUT 上传，返回 FileMeta（photos 存 file.id） */
export async function uploadFile(file: File): Promise<FileMeta> {
  const { file: meta, uploadUrl } = await apiPost<PresignResponse>('/files/presign', {
    filename: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
  })
  const headers: Record<string, string> = { 'Content-Type': file.type || 'application/octet-stream' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(uploadUrl, { method: 'PUT', headers, body: file })
  if (!res.ok) {
    let message = `文件上传失败（${res.status}）`
    try {
      const data = await res.json()
      if (typeof data?.message === 'string') message = data.message
    } catch { /* ignore */ }
    throw new ApiError(res.status, message)
  }
  return meta
}
