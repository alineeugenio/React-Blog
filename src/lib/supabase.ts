import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from '../../utils/supabase/info'

export const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey)

const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-9a700259`

export type Story = {
  id: string
  authorId: string
  authorName: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

export async function storyRequest<T>(path: string, options: RequestInit = {}, protectedRoute = false): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('apikey', publicAnonKey)
  if (options.body) headers.set('Content-Type', 'application/json')

  if (protectedRoute) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Response('Faça login para continuar.', { status: 401 })
    headers.set('Authorization', `Bearer ${session.access_token}`)
  } else {
    headers.set('Authorization', `Bearer ${publicAnonKey}`)
  }

  let response: globalThis.Response
  try {
    response = await fetch(`${apiUrl}${path}`, { ...options, headers })
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.')
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Response(payload.error || 'Não foi possível concluir a operação.', { status: response.status })
  }
  return response.json() as Promise<T>
}
