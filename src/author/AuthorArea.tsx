import { useState, type FormEvent } from 'react'
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'
import { storyRequest, supabase, type Story } from '../lib/supabase'

async function requireAuthor() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw redirect('/entrar')
  return user
}

export async function dashboardLoader() {
  const user = await requireAuthor()
  const stories = await storyRequest<Story[]>('/my/stories', {}, true)
  return { user: { id: user.id, email: user.email, name: user.user_metadata?.name as string | undefined }, stories }
}

export async function editorLoader({ params }: LoaderFunctionArgs) {
  const user = await requireAuthor()
  if (!params.storyId) throw new Response('Publicação não encontrada', { status: 404 })
  const story = await storyRequest<Story>(`/stories/${encodeURIComponent(params.storyId)}`)
  if (story.authorId !== user.id) throw new Response('Publicação não encontrada', { status: 404 })
  return story
}

export async function newStoryLoader() {
  await requireAuthor()
  return null
}

type ActionResult = { error: string }

export async function editorAction({ request, params }: ActionFunctionArgs): Promise<ActionResult | Response> {
  await requireAuthor()
  const data = await request.formData()
  const title = String(data.get('title') ?? '').trim()
  const body = String(data.get('body') ?? '').trim()
  if (title.length < 3 || title.length > 180 || body.length < 10 || body.length > 20000) {
    return { error: 'O título deve ter de 3 a 180 caracteres e o conteúdo de 10 a 20.000 caracteres.' }
  }
  try {
    const path = params.storyId ? `/my/stories/${encodeURIComponent(params.storyId)}` : '/my/stories'
    await storyRequest<Story>(path, { method: params.storyId ? 'PUT' : 'POST', body: JSON.stringify({ title, body }) }, true)
    return redirect('/painel')
  } catch (error) {
    if (error instanceof Response && error.status === 401) return redirect('/entrar')
    return { error: error instanceof Response ? await error.text() : 'Não foi possível salvar. Tente novamente.' }
  }
}

export async function dashboardAction({ request }: ActionFunctionArgs): Promise<ActionResult | Response> {
  await requireAuthor()
  const data = await request.formData()
  const id = String(data.get('id') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'Publicação inválida.' }
  try {
    await storyRequest<{ success: boolean }>(`/my/stories/${id}`, { method: 'DELETE' }, true)
    return redirect('/painel')
  } catch (error) {
    if (error instanceof Response && error.status === 401) return redirect('/entrar')
    return { error: error instanceof Response ? await error.text() : 'Não foi possível excluir. Tente novamente.' }
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const [registering, setRegistering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const name = String(form.get('name') ?? '').trim()
    try {
      if (registering) {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
        if (authError) throw authError
        if (data.session) navigate('/painel')
        else setMessage('Cadastro recebido. Confira seu e-mail e confirme sua conta antes de entrar.')
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
        navigate('/painel')
      }
    } catch {
      setError(registering ? 'Não foi possível criar a conta. Verifique os dados e tente novamente.' : 'E-mail ou senha inválidos. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto grid max-w-[1200px] gap-12 px-6 py-16 md:grid-cols-2 md:items-center md:px-10 md:py-24">
      <div className="max-w-md"><p className="eyebrow">ESPAÇO DO AUTOR</p><h1 className="font-display mt-6 text-[clamp(48px,5vw,72px)] leading-[1.05] tracking-[-0.055em]">Toda história começa por aqui<span className="text-[#ba7654]">.</span></h1><p className="mt-7 text-base leading-8 text-[#6d796f]">Entre na sua conta para escrever, revisar e acompanhar suas publicações em um lugar só.</p><div className="mt-12 border-t border-[#dce0d5] pt-6 text-sm leading-7 text-[#879187]">Suas histórias são salvas com segurança e só você pode editá-las ou excluí-las.</div></div>
      <div className="border border-[#e0e4d9] bg-white p-7 shadow-[0_24px_60px_#21362a0a] sm:p-10"><p className="eyebrow">{registering ? 'CRIE SEU ESPAÇO' : 'BEM-VINDO DE VOLTA'}</p><h2 className="font-display mt-4 text-4xl tracking-[-0.04em]">{registering ? 'Criar conta' : 'Entrar no painel'}</h2><p className="mt-3 text-sm text-[#6d796f]">{registering ? 'Compartilhe suas ideias com novos leitores.' : 'Continue de onde sua escrita parou.'}</p>
        <form onSubmit={submit} className="mt-9 space-y-5">{registering && <label className="form-label">Seu nome<input name="name" required maxLength={100} autoComplete="name" className="form-input" placeholder="Como assinar suas histórias" /></label>}<label className="form-label">E-mail<input name="email" type="email" required autoComplete="email" className="form-input" placeholder="voce@exemplo.com" /></label><label className="form-label">Senha<input name="password" type="password" required minLength={6} autoComplete={registering ? 'new-password' : 'current-password'} className="form-input" placeholder="Mínimo de 6 caracteres" /></label>
          {error && <p role="alert" className="text-sm text-[#a34335]">{error}</p>}{message && <p role="status" className="text-sm text-[#365644]">{message}</p>}
          <button disabled={busy} type="submit" className="w-full rounded-full bg-[#294b39] px-6 py-4 text-sm font-semibold text-white hover:bg-[#1c382a] disabled:opacity-60">{busy ? 'Aguarde...' : registering ? 'Criar conta' : 'Entrar'}</button>
        </form><p className="mt-7 text-center text-sm text-[#6d796f]">{registering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'} <button type="button" onClick={() => { setRegistering(!registering); setError(''); setMessage('') }} className="font-semibold text-[#a35c3a] hover:underline">{registering ? 'Entrar' : 'Cadastre-se'}</button></p>
      </div>
    </main>
  )
}

export function DashboardPage() {
  const { user, stories } = useLoaderData<typeof dashboardLoader>()
  const result = useActionData<ActionResult>()
  const navigation = useNavigation()
  const navigate = useNavigate()

  async function logout() {
    await supabase.auth.signOut()
    navigate('/entrar')
  }

  return <main className="mx-auto max-w-[1200px] px-6 py-12 md:px-10 md:py-20"><div className="flex flex-wrap items-center justify-between gap-4"><Link to="/" className="text-sm font-medium text-[#69796e] hover:text-[#a35c3a]">← Voltar ao site</Link><button onClick={logout} className="text-sm font-semibold text-[#a35c3a] hover:underline">Sair da conta</button></div><div className="mt-16 flex flex-wrap items-end justify-between gap-6 border-b border-[#dce0d5] pb-12"><div><p className="eyebrow">PAINEL DO AUTOR</p><h1 className="font-display mt-4 text-[clamp(48px,5vw,72px)] leading-[1.05] tracking-[-0.055em]">Suas histórias<span className="text-[#ba7654]">.</span></h1><p className="mt-4 text-sm text-[#6d796f]">Olá, {user.name || user.email}. Você tem {stories.length} {stories.length === 1 ? 'publicação' : 'publicações'}.</p></div><Link to="/painel/novo" className="rounded-full bg-[#294b39] px-7 py-4 text-sm font-semibold text-white hover:bg-[#1c382a]">+ Escrever novo post</Link></div>
    {result?.error && <p role="alert" className="mt-6 text-sm text-[#a34335]">{result.error}</p>}
    {stories.length === 0 ? <div className="py-24 text-center"><p className="font-display text-3xl">Sua próxima história começa aqui.</p><p className="mt-3 text-[#6d796f]">Você ainda não publicou nenhum post.</p><Link className="mt-6 inline-block font-semibold text-[#a35c3a] hover:underline" to="/painel/novo">Criar primeiro post →</Link></div> : <div className="divide-y divide-[#dce0d5]">{stories.map((story) => <article key={story.id} className="flex flex-wrap items-center justify-between gap-6 py-7"><div className="max-w-[700px]"><p className="eyebrow">PUBLICADO EM {new Date(story.createdAt).toLocaleDateString('pt-BR')}</p><h2 className="font-display mt-2 text-[27px] leading-tight first-letter:uppercase"><Link to={`/historias/${story.id}`} className="hover:text-[#a35c3a]">{story.title}</Link></h2><p className="mt-2 line-clamp-1 text-sm text-[#6d796f]">{story.body}</p></div><div className="flex items-center gap-5"><Link to={`/painel/editar/${story.id}`} className="text-sm font-semibold text-[#365644] hover:underline">Editar</Link><Form method="post" onSubmit={(event) => { if (!window.confirm('Excluir este post permanentemente?')) event.preventDefault() }}><input type="hidden" name="id" value={story.id} /><button disabled={navigation.state !== 'idle'} className="text-sm font-semibold text-[#a34335] hover:underline disabled:opacity-50" type="submit">Excluir</button></Form></div></article>)}</div>}
  </main>
}

export function EditorPage({ editing = false }: { editing?: boolean }) {
  const story = useLoaderData() as Story | null
  const result = useActionData<ActionResult>()
  const navigation = useNavigation()
  const saving = navigation.state === 'submitting'
  return <main className="mx-auto max-w-[900px] px-6 py-12 md:px-10 md:py-20"><Link to="/painel" className="text-sm font-medium text-[#69796e] hover:text-[#a35c3a]">← Voltar ao painel</Link><div className="mt-14 border-b border-[#dce0d5] pb-8"><p className="eyebrow">{editing ? 'REVISE SUA HISTÓRIA' : 'UMA NOVA HISTÓRIA'}</p><h1 className="font-display mt-4 text-[clamp(44px,5vw,68px)] tracking-[-0.055em]">{editing ? 'Editar publicação.' : 'O que vamos contar hoje?'}</h1><p className="mt-3 text-[#6d796f]">Escolha um título e escreva o conteúdo do seu post.</p></div><Form method="post" className="mt-10 space-y-7"><label className="form-label">Título<input name="title" required minLength={3} maxLength={180} defaultValue={editing ? story?.title : ''} className="form-input" placeholder="Dê um nome à sua história" /></label><label className="form-label">Conteúdo<textarea name="body" required minLength={10} maxLength={20000} rows={15} defaultValue={editing ? story?.body : ''} className="form-input resize-y" placeholder="Comece a escrever..." /></label>{result?.error && <p role="alert" className="text-sm text-[#a34335]">{result.error}</p>}<div className="flex items-center justify-end gap-5"><Link to="/painel" className="text-sm font-semibold text-[#69796e] hover:underline">Cancelar</Link><button disabled={saving} type="submit" className="rounded-full bg-[#294b39] px-8 py-4 text-sm font-semibold text-white hover:bg-[#1c382a] disabled:opacity-60">{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Publicar post'}</button></div></Form></main>
}
