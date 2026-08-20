import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiPost, getToken, setToken, UNAUTHORIZED_EVENT } from '@/api/client'
import { QK, useMe } from '@/api/hooks'
import type { LoginResponse, Org, User } from '@/api/types'

interface AuthCtxValue {
  user: User | null
  org: Org | null
  /** 已持有 token（可能正在拉取 /auth/me） */
  hasToken: boolean
  loading: boolean
  login: (phone: string, password: string) => Promise<void>
  logout: () => void
}

const AuthCtx = createContext<AuthCtxValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [hasToken, setHasToken] = useState(() => getToken() != null)
  const me = useMe(hasToken)

  useEffect(() => {
    const onExpire = () => {
      setHasToken(false)
      qc.clear()
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onExpire)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onExpire)
  }, [qc])

  const login = useCallback(async (phone: string, password: string) => {
    const r = await apiPost<LoginResponse>('/auth/login', { phone, password })
    setToken(r.token)
    qc.clear()
    qc.setQueryData(QK.me, { user: r.user, org: r.org })
    setHasToken(true)
  }, [qc])

  const logout = useCallback(() => {
    setToken(null)
    qc.clear()
    setHasToken(false)
  }, [qc])

  const value = useMemo<AuthCtxValue>(() => ({
    user: me.data?.user ?? null,
    org: me.data?.org ?? null,
    hasToken,
    loading: hasToken && me.isPending,
    login,
    logout,
  }), [me.data, me.isPending, hasToken, login, logout])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('auth missing')
  return ctx
}
