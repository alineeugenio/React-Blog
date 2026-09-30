import { useState } from 'react'
import {
  DashboardPage, EditorPage, LoginPage,
  dashboardAction, dashboardLoader, editorAction, editorLoader, newStoryLoader,
} from './author/AuthorArea'
import { storyRequest, type Story } from './lib/supabase'
import {
  createBrowserRouter,
  Form,
  isRouteErrorResponse,
  Link,
  NavLink,
  Outlet,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'

type Post = { id: number; userId: number; title: string; body: string }
type Author = { id: number; name: string; username: string; email: string; company: { name: string } }
type Todo = { id: number; userId: number; title: string; completed: boolean }
type Comment = { id: number; postId: number; name: string; email: string; body: string }
type StoryComment = { id: string; name: string; body: string; createdAt: string }
type CommentResult = { error?: string; success?: boolean }

const API = 'https://jsonplaceholder.typicode.com'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`)
  if (!response.ok) throw new Response('Não foi possível carregar o conteúdo.', { status: response.status })
  return response.json() as Promise<T>
}

function idFromParams(value: string | undefined) {
  const id = Number(value)
  if (!value || !Number.isSafeInteger(id) || id < 1) throw new Response('Página não encontrada.', { status: 404 })
  return id
}

async function homeLoader() {
  const [posts, authors, stories] = await Promise.all([
    getJson<Post[]>('/posts'), getJson<Author[]>('/users'),
    storyRequest<Story[]>('/stories').catch(() => [] as Story[]),
  ])
  return { posts, authors, stories }
}

async function storyLoader({ params }: LoaderFunctionArgs) {
  if (!params.storyId) throw new Response('Publicação não encontrada.', { status: 404 })
  const path = `/stories/${encodeURIComponent(params.storyId)}`
  const [story, comments] = await Promise.all([
    storyRequest<Story>(path), storyRequest<StoryComment[]>(`${path}/comments`),
  ])
  return { story, comments }
}

async function storyCommentAction({ request, params }: ActionFunctionArgs): Promise<CommentResult> {
  if (!params.storyId) throw new Response('Publicação não encontrada.', { status: 404 })
  const data = await request.formData()
  const name = String(data.get('name') ?? '').trim()
  const email = String(data.get('email') ?? '').trim()
  const body = String(data.get('body') ?? '').trim()
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !body) return { error: 'Preencha seu nome, um e-mail válido e o comentário.' }
  try {
    await storyRequest<StoryComment>(`/stories/${encodeURIComponent(params.storyId)}/comments`, {
      method: 'POST', body: JSON.stringify({ name, email, body }),
    })
    return { success: true }
  } catch (error) {
    return { error: error instanceof Response ? await error.text() : 'Não foi possível enviar o comentário. Tente novamente.' }
  }
}

async function writerLoader({ params }: LoaderFunctionArgs) {
  if (!params.writerId) throw new Response('Autor não encontrado.', { status: 404 })
  const stories = await storyRequest<Story[]>(`/authors/${encodeURIComponent(params.writerId)}/stories`)
  if (!stories.length) throw new Response('Autor não encontrado.', { status: 404 })
  return stories
}

async function postLoader({ params }: LoaderFunctionArgs) {
  const id = idFromParams(params.postId)
  const [post, comments] = await Promise.all([
    getJson<Post>(`/posts/${id}`),
    getJson<Comment[]>(`/posts/${id}/comments`),
  ])
  if (!post.id) throw new Response('Post não encontrado.', { status: 404 })
  const author = await getJson<Author>(`/users/${post.userId}`)
  return { post, author, comments }
}

async function authorLoader({ params }: LoaderFunctionArgs) {
  const id = idFromParams(params.authorId)
  const [author, posts] = await Promise.all([
    getJson<Author>(`/users/${id}`),
    getJson<Post[]>(`/users/${id}/posts`),
  ])
  if (!author.id) throw new Response('Autor não encontrado.', { status: 404 })
  return { author, posts }
}

async function todosLoader() {
  const [todos, users] = await Promise.all([
    getJson<Todo[]>('/todos'),
    getJson<Author[]>('/users'),
  ])
  return { todos, users }
}

async function commentAction({ request, params }: ActionFunctionArgs): Promise<CommentResult> {
  const postId = idFromParams(params.postId)
  const data = await request.formData()
  const name = String(data.get('name') ?? '').trim()
  const email = String(data.get('email') ?? '').trim()
  const body = String(data.get('body') ?? '').trim()

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !body) {
    return { error: 'Preencha seu nome, um e-mail válido e o comentário.' }
  }

  try {
    const response = await fetch(`${API}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ postId, name, email, body }),
    })
    if (!response.ok) throw new Error('Falha ao enviar comentário')
    return { success: true }
  } catch {
    return { error: 'Não foi possível enviar o comentário. Tente novamente.' }
  }
}

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return diagonal ? (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19 19 5M8 5h11v11" /></svg>
  ) : (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16m-7-7 7 7-7 7" /></svg>
  )
}

function RootLayout() {
  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#24372e]">
      <header className="border-b border-[#e5e5dc] bg-[#f8f7f2]">
        <div className="mx-auto flex min-h-[82px] max-w-[1320px] flex-col items-start justify-center gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <Link to="/" className="font-display text-[22px] font-bold leading-tight tracking-[-0.04em] lg:text-[28px]" aria-label="Histórias que prendem sua imaginação — página inicial">Histórias que prendem sua imaginação</Link>
          <nav aria-label="Navegação principal" className="flex items-center gap-3 text-[13px] font-semibold sm:gap-7 md:gap-10">
            <NavLink to="/" end className={({ isActive }) => `transition-colors hover:text-[#a35c3a] ${isActive ? 'text-[#a35c3a]' : ''}`}>Início</NavLink>
            <Link to="/#historias" className="transition-colors hover:text-[#a35c3a]">Histórias</Link>
            <NavLink to="/tarefas" className={({ isActive }) => `transition-colors hover:text-[#a35c3a] ${isActive ? 'text-[#a35c3a]' : ''}`}>Tarefas</NavLink>
            <span className="hidden h-4 w-px bg-[#d8d8ce] xl:block" />
            <Link to="/painel" className="text-[#a35c3a] transition-colors hover:text-[#294b39]">Área do autor</Link>
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="mt-20 border-t border-[#e1e2d8] bg-[#f1f1e9]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-6 py-10 text-sm text-[#6b786c] sm:flex-row sm:items-center sm:justify-between md:px-10">
          <Link to="/" className="font-display text-xl font-bold tracking-[-0.04em] text-[#24372e]">Histórias que prendem sua imaginação</Link>
          <p>Histórias, ideias e conversas para ler sem pressa.</p>
          <p>Histórias da comunidade e JSONPlaceholder</p>
        </div>
      </footer>
    </div>
  )
}

function PostCard({ post, author }: { post: Post; author?: Author }) {
  return (
    <article className="group flex min-h-[250px] flex-col justify-between border-t border-[#d9ddd2] pt-6">
      <div>
        <div className="mb-6 flex items-center justify-between text-[11px] font-bold tracking-[0.16em] text-[#8b968b] uppercase">
          <span>Leitura · {String(post.id).padStart(2, '0')}</span>
          <Link to={`/posts/${post.id}`} aria-label={`Ler ${post.title}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d4dacf] text-[#365644] transition-colors group-hover:border-[#365644] group-hover:bg-[#365644] group-hover:text-white"><ArrowIcon diagonal /></Link>
        </div>
        <h3 className="font-display max-w-[340px] text-[27px] leading-[1.18] font-medium tracking-[-0.025em] first-letter:uppercase transition-colors group-hover:text-[#a35c3a]">
          <Link to={`/posts/${post.id}`}>{post.title}</Link>
        </h3>
      </div>
      {author && <Link to={`/autores/${author.id}`} className="mt-7 w-fit text-[13px] font-medium text-[#68776b] hover:text-[#a35c3a]">Por <span className="underline decoration-[#ccd2c6] underline-offset-4">{author.name}</span></Link>}
    </article>
  )
}

function StoryCard({ story }: { story: Story }) {
  return <article className="group flex min-h-[250px] flex-col justify-between border-t border-[#d9ddd2] pt-6"><div><div className="mb-6 flex items-center justify-between text-[11px] font-bold tracking-[0.16em] text-[#8b968b] uppercase"><span>{new Date(story.createdAt).toLocaleDateString('pt-BR')}</span><Link to={`/historias/${story.id}`} aria-label={`Ler ${story.title}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d4dacf] text-[#365644] transition-colors group-hover:bg-[#365644] group-hover:text-white"><ArrowIcon diagonal /></Link></div><h3 className="font-display max-w-[340px] text-[27px] leading-[1.18] tracking-[-0.025em] group-hover:text-[#a35c3a]"><Link to={`/historias/${story.id}`}>{story.title}</Link></h3></div><Link to={`/escritores/${story.authorId}`} className="mt-7 w-fit text-[13px] font-medium text-[#68776b] hover:text-[#a35c3a]">Por <span className="underline decoration-[#ccd2c6] underline-offset-4">{story.authorName}</span></Link></article>
}

function Home() {
  const { posts, authors, stories } = useLoaderData<typeof homeLoader>()
  const [visible, setVisible] = useState(9)
  const authorsById = new Map(authors.map((author) => [author.id, author]))

  return (
    <main>
      <section className="mx-auto grid max-w-[1320px] gap-10 px-6 pt-14 pb-20 md:px-10 lg:grid-cols-[1fr_0.92fr] lg:items-center lg:gap-20 lg:pt-20 lg:pb-24">
        <div className="max-w-[610px]">
          <p className="eyebrow"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ba7654]" /> UM ESPAÇO PARA IDEIAS</p>
          <h1 className="font-display mt-8 text-[clamp(56px,6.2vw,94px)] leading-[0.99] font-medium tracking-[-0.065em]">Histórias para<br /><span className="italic text-[#a86647]">ler com calma.</span></h1>
          <p className="mt-8 max-w-[440px] text-[16px] leading-[1.85] text-[#6d796f]">Uma coleção de pensamentos, descobertas e perspectivas. Encontre uma história, fique por uma conversa.</p>
          <a href="#historias" className="mt-9 inline-flex items-center gap-4 rounded-full bg-[#294b39] px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#1c382a]">Explorar histórias <ArrowIcon /></a>
          <div className="mt-16 flex items-center gap-6 border-t border-[#dce0d5] pt-6 text-xs text-[#879187]"><span><strong className="mr-2 font-display text-2xl font-medium text-[#24372e]">{posts.length + stories.length}</strong> histórias</span><span className="h-5 w-px bg-[#dce0d5]" /><span><strong className="mr-2 font-display text-2xl font-medium text-[#24372e]">{authors.length}</strong> autores da coleção</span></div>
        </div>
        <div className="relative min-h-[430px] lg:h-[555px]">
          <img className="h-full min-h-[430px] w-full rounded-[3px] object-cover object-center lg:min-h-0" src="https://images.unsplash.com/photo-1723210844933-8727aeea8b9f?auto=format&fit=crop&w=1100&q=85" alt="Livro aberto sobre uma mesa" />
          <div className="absolute right-[-8px] bottom-[-18px] max-w-[230px] bg-[#e8e9dc] px-7 py-6 shadow-[0_16px_32px_#21362a14] md:right-[-20px] md:bottom-[-22px]"><span className="text-[10px] font-bold tracking-[0.18em] text-[#a36244] uppercase">A pausa que inspira</span><p className="font-display mt-2 text-[21px] leading-[1.2] italic">Sempre há algo novo para descobrir.</p></div>
        </div>
      </section>

      <section id="historias" className="border-t border-[#e1e2d8] bg-[#f1f2e9] py-20 scroll-mt-6">
        <div className="mx-auto max-w-[1320px] px-6 md:px-10">
          {stories.length > 0 && <div className="mb-20"><div className="mb-10 flex items-end justify-between gap-4"><div><p className="eyebrow">VOZES DA COMUNIDADE</p><h2 className="font-display mt-4 text-[clamp(36px,4vw,52px)] tracking-[-0.045em]">Novas publicações<span className="text-[#ba7654]">.</span></h2></div></div><div className="grid gap-x-9 gap-y-12 md:grid-cols-2 lg:grid-cols-3">{stories.map((story) => <StoryCard key={story.id} story={story} />)}</div></div>}
          <div className="mb-14 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">EXPLORE O ACERVO</p><h2 className="font-display mt-4 text-[clamp(40px,4vw,60px)] leading-none tracking-[-0.045em]">Últimas histórias<span className="text-[#ba7654]">.</span></h2></div><p className="pb-1 text-sm text-[#79857a]">{posts.length} histórias para explorar</p></div>
          <div className="grid gap-x-9 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {posts.slice(0, visible).map((post) => <PostCard key={post.id} post={post} author={authorsById.get(post.userId)} />)}
          </div>
          {visible < posts.length && <div className="mt-16 text-center"><button type="button" onClick={() => setVisible((count) => count + 9)} className="inline-flex items-center gap-3 rounded-full border border-[#91a394] px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-[#294b39] hover:text-white">Carregar mais histórias <ArrowIcon /></button></div>}
        </div>
      </section>
    </main>
  )
}

function PostPage() {
  const { post, author, comments } = useLoaderData<typeof postLoader>()
  const result = useActionData<CommentResult>()
  const navigation = useNavigation()
  const submitting = navigation.state === 'submitting'

  return (
    <main className="mx-auto max-w-[1320px] px-6 pt-10 md:px-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#69796e] hover:text-[#a35c3a]">← Voltar às histórias</Link>
      <article className="mx-auto max-w-[780px] pt-16">
        <p className="eyebrow">HISTÓRIA Nº {String(post.id).padStart(2, '0')}</p>
        <h1 className="font-display mt-6 text-[clamp(48px,6vw,78px)] leading-[1.06] font-medium tracking-[-0.055em] first-letter:uppercase">{post.title}</h1>
        <div className="mt-9 flex items-center gap-4 border-b border-[#dce0d5] pb-10"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dfe7d9] font-display text-xl text-[#365644]">{author.name.charAt(0)}</div><div><p className="text-xs text-[#859187]">Escrito por</p><Link to={`/autores/${author.id}`} className="text-sm font-semibold hover:text-[#a35c3a] hover:underline">{author.name}</Link></div></div>
        <div className="font-display my-14 whitespace-pre-line text-[24px] leading-[1.8] text-[#39483c] first-letter:uppercase">{post.body}</div>
        <div className="border-y border-[#dce0d5] py-7 text-sm text-[#758176]">Gostou da leitura? Continue a conversa nos comentários abaixo.</div>
      </article>

      <section className="mx-auto max-w-[780px] pt-20" aria-labelledby="comments-title">
        <p className="eyebrow">A CONVERSA CONTINUA</p>
        <h2 id="comments-title" className="font-display mt-3 text-[clamp(36px,4vw,52px)] tracking-[-0.04em]">Comentários <span className="font-sans text-xl text-[#a96748]">({comments.length})</span></h2>
        <div className="mt-10 divide-y divide-[#dce0d5] border-t border-[#dce0d5]">
          {comments.map((comment) => <div key={comment.id} className="flex gap-5 py-7"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5e9df] font-display text-lg text-[#44614c]">{comment.name.charAt(0).toUpperCase()}</div><div><h3 className="text-sm font-semibold first-letter:uppercase">{comment.name}</h3><p className="mt-2 text-[15px] leading-7 text-[#69776b] first-letter:uppercase">{comment.body}</p></div></div>)}
          {comments.length === 0 && <p className="py-8 text-[#69776b]">Ainda não há comentários para este post.</p>}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-[780px] bg-[#e9ede3] p-7 md:p-12" aria-labelledby="comment-form-title">
        <p className="eyebrow">PARTICIPE DA CONVERSA</p>
        <h2 id="comment-form-title" className="font-display mt-3 text-4xl tracking-[-0.04em]">Deixe um comentário.</h2>
        <p className="mt-3 text-sm leading-6 text-[#6a786d]">Sua perspectiva também faz parte desta história. Todos os campos são obrigatórios.</p>
        <Form method="post" className="mt-8 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2"><label className="form-label">Seu nome<input required name="name" maxLength={100} autoComplete="name" placeholder="Como podemos chamar você?" className="form-input" /></label><label className="form-label">Seu e-mail<input required name="email" type="email" maxLength={150} autoComplete="email" placeholder="voce@exemplo.com" className="form-input" /></label></div>
          <label className="form-label">Seu comentário<textarea required name="body" rows={5} maxLength={3000} placeholder="Compartilhe o que você achou..." className="form-input resize-y" /></label>
          {result?.error && <p role="alert" className="text-sm font-medium text-[#a34335]">{result.error}</p>}
          {result?.success && <p role="status" className="text-sm font-medium text-[#365644]">Comentário enviado à API de demonstração. O JSONPlaceholder não salva nem aprova comentários; por isso ele não aparecerá na lista.</p>}
          <div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-sm text-xs leading-5 text-[#7d897e]">Os comentários exibidos acima são os disponíveis na API. Ela não fornece um status de aprovação.</p><button disabled={submitting} type="submit" className="inline-flex items-center gap-3 rounded-full bg-[#294b39] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#1c382a] disabled:opacity-60">{submitting ? 'Enviando...' : 'Enviar comentário'} <ArrowIcon /></button></div>
        </Form>
      </section>
    </main>
  )
}

function AuthorPage() {
  const { author, posts } = useLoaderData<typeof authorLoader>()
  return <main className="mx-auto max-w-[1320px] px-6 pt-10 md:px-10"><Link to="/" className="text-sm font-medium text-[#69796e] hover:text-[#a35c3a]">← Voltar às histórias</Link><section className="mt-16 border-b border-[#dce0d5] pb-16"><p className="eyebrow">CONHEÇA QUEM ESCREVE</p><div className="mt-5 flex flex-wrap items-center gap-6"><div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#dfe7d9] font-display text-4xl text-[#365644]">{author.name.charAt(0)}</div><h1 className="font-display text-[clamp(48px,6vw,76px)] leading-none tracking-[-0.055em]">{author.name}</h1></div><p className="mt-7 max-w-xl text-[#6d796f]">Explore todas as histórias publicadas por {author.name}.</p></section><section className="pt-16"><div className="mb-12 flex items-end justify-between gap-4"><div><p className="eyebrow">TODAS AS HISTÓRIAS</p><h2 className="font-display mt-3 text-4xl tracking-[-0.04em]">Publicações do autor<span className="text-[#ba7654]">.</span></h2></div><span className="text-sm text-[#79857a]">{posts.length} posts</span></div><div className="grid gap-x-9 gap-y-12 md:grid-cols-2 lg:grid-cols-3">{posts.map((post) => <PostCard key={post.id} post={post} author={author} />)}</div></section></main>
}

function TodosPage() {
  const { todos: initialTodos, users } = useLoaderData<typeof todosLoader>()
  const [todos, setTodos] = useState(initialTodos)
  const [status, setStatus] = useState<'all' | 'pending' | 'completed'>('all')
  const [search, setSearch] = useState('')
  const [activeUserId, setActiveUserId] = useState(users[0]?.id ?? 0)
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const userTodos = todos.filter((todo) => todo.userId === activeUserId)
  const filteredTodos = userTodos.filter((todo) => {
    const matchesStatus = status === 'all' || todo.completed === (status === 'completed')
    return matchesStatus && todo.title.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
  })
  const completedCount = todos.filter((todo) => todo.completed).length
  const activeUser = users.find((user) => user.id === activeUserId)

  async function toggleTodo(todo: Todo) {
    const completed = !todo.completed
    setError('')
    setBusyIds((current) => new Set(current).add(todo.id))
    try {
      const response = await fetch(`${API}/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ completed }),
      })
      if (!response.ok) throw new Error('Falha ao atualizar tarefa')
      const updatedTodo = await response.json() as Partial<Todo>
      setTodos((current) => current.map((item) => item.id === todo.id
        ? { ...item, completed: typeof updatedTodo.completed === 'boolean' ? updatedTodo.completed : completed }
        : item))
    } catch {
      setError('Não foi possível atualizar a tarefa. Tente novamente.')
    } finally {
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(todo.id)
        return next
      })
    }
  }

  async function deleteTodo(todo: Todo) {
    setError('')
    setBusyIds((current) => new Set(current).add(todo.id))
    try {
      const response = await fetch(`${API}/todos/${todo.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Falha ao excluir tarefa')
      setTodos((current) => current.filter((item) => item.id !== todo.id))
    } catch {
      setError('Não foi possível excluir a tarefa. Tente novamente.')
    } finally {
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(todo.id)
        return next
      })
    }
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = users.findIndex((user) => user.id === activeUserId)
    let nextIndex = currentIndex
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % users.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + users.length) % users.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = users.length - 1
    else return
    event.preventDefault()
    setActiveUserId(users[nextIndex].id)
    document.getElementById(`user-tab-${users[nextIndex].id}`)?.focus()
  }

  return (
    <main className="mx-auto max-w-[1320px] px-6 py-12 md:px-10 md:py-16">
      <section className="border-b border-[#dce0d5] pb-10">
        <p className="eyebrow">ORGANIZAÇÃO JSONPLACEHOLDER</p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-7">
          <div>
            <h1 className="font-display text-[clamp(48px,6vw,76px)] leading-none tracking-[-0.055em]">Tarefas<span className="text-[#ba7654]">.</span></h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#6d796f]">Todas as tarefas, organizadas por usuário.</p>
          </div>
          <p className="text-sm text-[#79857a]"><strong className="font-display mr-2 text-3xl font-medium text-[#24372e]">{completedCount}/{todos.length}</strong> concluídas</p>
        </div>
      </section>

      <section className="border-b border-[#dce0d5] py-6" aria-label="Filtros de tarefas">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Buscar tarefa</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="form-input !bg-white !py-3 !pl-10" placeholder="Buscar tarefa..." type="search" />
            <svg aria-hidden="true" className="absolute top-1/2 left-3 -translate-y-1/2 text-[#879187]" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
          </label>
          <div className="flex w-fit border border-[#d4dacf]" role="group" aria-label="Filtrar por status">
            {([
              ['all', 'Todas'],
              ['pending', 'Pendentes'],
              ['completed', 'Concluídas'],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`px-4 py-2.5 text-xs font-semibold transition-colors ${status === value ? 'bg-[#294b39] text-white' : 'text-[#5f7063] hover:bg-[#edf0e8]'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-8 overflow-x-auto border-b border-[#dce0d5]" role="tablist" aria-label="Tarefas por usuário">
        <div className="flex min-w-max gap-1">
          {users.map((user) => {
            const selected = user.id === activeUserId
            return <button key={user.id} id={`user-tab-${user.id}`} type="button" role="tab" aria-selected={selected} aria-controls={`user-panel-${user.id}`} tabIndex={selected ? 0 : -1} onClick={() => setActiveUserId(user.id)} onKeyDown={handleTabKeyDown} className={`border-b-2 px-4 py-3 text-left transition-colors ${selected ? 'border-[#a86647] text-[#294b39]' : 'border-transparent text-[#79857a] hover:text-[#294b39]'}`}><span className="block text-sm font-semibold">{user.name}</span><span className="mt-1 block text-[10px] font-bold tracking-[0.12em] uppercase">Usuário {user.id}</span></button>
          })}
        </div>
      </div>

      {activeUser && <section id={`user-panel-${activeUser.id}`} role="tabpanel" aria-labelledby={`user-tab-${activeUser.id}`} className="py-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[25px] tracking-[-0.025em]">{activeUser.name}<span className="ml-3 font-sans text-xs font-semibold tracking-[0.12em] text-[#a86647] uppercase">Usuário {activeUser.id}</span></h2>
          <p className="text-xs text-[#79857a]">{userTodos.filter((todo) => todo.completed).length}/{userTodos.length} concluídas</p>
        </div>
        {error && <p role="alert" className="mb-4 text-sm text-[#a34335]">{error}</p>}
        <ul className="divide-y divide-[#e8e9e1] border-t border-[#e8e9e1]">
          {filteredTodos.map((todo) => (
            <li key={todo.id} className="flex items-start justify-between gap-4 py-3.5">
              <div className="flex min-w-0 items-start gap-3">
                <button type="button" aria-label={`Marcar "${todo.title}" como ${todo.completed ? 'pendente' : 'concluída'}`} aria-pressed={todo.completed} aria-busy={busyIds.has(todo.id)} disabled={busyIds.has(todo.id)} onClick={() => toggleTodo(todo)} className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294b39] disabled:cursor-wait disabled:opacity-60 ${todo.completed ? 'border-[#52735b] bg-[#52735b] text-white' : 'border-[#b9c3b7] text-transparent hover:border-[#52735b]'}`}>
                  {todo.completed && <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3 3 7-7" /></svg>}
                </button>
                <span className={`min-w-0 text-sm leading-6 ${todo.completed ? 'text-[#879187] line-through' : 'text-[#39483c]'}`}>{todo.title}</span>
              </div>
              <button type="button" aria-label={`Excluir tarefa: ${todo.title}`} aria-busy={busyIds.has(todo.id)} disabled={busyIds.has(todo.id)} onClick={() => deleteTodo(todo)} className="flex h-8 w-8 shrink-0 items-center justify-center text-[#a34335] transition-colors hover:bg-[#f3e8e4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34335] disabled:cursor-wait disabled:opacity-50">
                <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></svg>
              </button>
            </li>
          ))}
        </ul>
        {filteredTodos.length === 0 && <p className="py-16 text-center text-sm text-[#6d796f]">Nenhuma tarefa encontrada com esses filtros.</p>}
      </section>}
    </main>
  )
}

function StoryPage() {
  const { story, comments } = useLoaderData<typeof storyLoader>()
  const result = useActionData<CommentResult>()
  const submitting = useNavigation().state === 'submitting'
  return <main className="mx-auto max-w-[1320px] px-6 pt-10 md:px-10"><Link to="/" className="text-sm font-medium text-[#69796e] hover:text-[#a35c3a]">← Voltar às histórias</Link><article className="mx-auto max-w-[780px] pt-16"><p className="eyebrow">HISTÓRIAS DA COMUNIDADE · {new Date(story.createdAt).toLocaleDateString('pt-BR')}</p><h1 className="font-display mt-6 text-[clamp(48px,6vw,78px)] leading-[1.06] tracking-[-0.055em]">{story.title}</h1><div className="mt-9 border-b border-[#dce0d5] pb-10 text-sm text-[#6d796f]">Escrito por <Link to={`/escritores/${story.authorId}`} className="font-semibold text-[#24372e] hover:underline">{story.authorName}</Link></div><div className="font-display my-14 whitespace-pre-wrap text-[24px] leading-[1.8] text-[#39483c]">{story.body}</div></article><section className="mx-auto max-w-[780px] pt-12" aria-labelledby="story-comments"><p className="eyebrow">A CONVERSA CONTINUA</p><h2 id="story-comments" className="font-display mt-3 text-4xl tracking-[-0.04em]">Comentários <span className="font-sans text-xl text-[#a96748]">({comments.length})</span></h2><div className="mt-8 divide-y divide-[#dce0d5] border-t border-[#dce0d5]">{comments.length ? comments.map((comment) => <article key={comment.id} className="py-6"><h3 className="text-sm font-semibold">{comment.name}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#69776b]">{comment.body}</p></article>) : <p className="py-7 text-sm text-[#69776b]">Ainda não há comentários. Seja a primeira pessoa a participar.</p>}</div></section><section className="mx-auto mt-12 max-w-[780px] bg-[#e9ede3] p-7 md:p-12"><p className="eyebrow">PARTICIPE DA CONVERSA</p><h2 className="font-display mt-3 text-4xl tracking-[-0.04em]">Deixe um comentário.</h2><Form method="post" className="mt-8 space-y-5"><div className="grid gap-5 sm:grid-cols-2"><label className="form-label">Seu nome<input required name="name" maxLength={100} autoComplete="name" className="form-input" /></label><label className="form-label">Seu e-mail<input required name="email" type="email" maxLength={150} autoComplete="email" className="form-input" /></label></div><label className="form-label">Seu comentário<textarea required name="body" rows={5} maxLength={3000} className="form-input resize-y" /></label>{result?.error && <p role="alert" className="text-sm text-[#a34335]">{result.error}</p>}{result?.success && <p role="status" className="text-sm text-[#365644]">Comentário publicado. Obrigado por participar!</p>}<div className="flex justify-end"><button disabled={submitting} type="submit" className="rounded-full bg-[#294b39] px-7 py-3.5 text-sm font-semibold text-white hover:bg-[#1c382a] disabled:opacity-60">{submitting ? 'Enviando...' : 'Enviar comentário'}</button></div></Form></section></main>
}

function WriterPage() {
  const stories = useLoaderData<typeof writerLoader>()
  return <main className="mx-auto max-w-[1320px] px-6 pt-10 md:px-10"><Link to="/" className="text-sm font-medium text-[#69796e] hover:text-[#a35c3a]">← Voltar às histórias</Link><section className="mt-16 border-b border-[#dce0d5] pb-14"><p className="eyebrow">CONHEÇA QUEM ESCREVE</p><h1 className="font-display mt-5 text-[clamp(48px,6vw,76px)] tracking-[-0.055em]">{stories[0].authorName}</h1><p className="mt-5 text-[#6d796f]">{stories.length} {stories.length === 1 ? 'história publicada' : 'histórias publicadas'} por este autor.</p></section><section className="grid gap-x-9 gap-y-12 pt-16 md:grid-cols-2 lg:grid-cols-3">{stories.map((story) => <StoryCard key={story.id} story={story} />)}</section></main>
}

function ErrorPage() {
  const error = useRouteError()
  const is404 = isRouteErrorResponse(error) && error.status === 404
  return <main className="mx-auto flex min-h-[65vh] max-w-[1320px] flex-col items-start justify-center px-6 md:px-10"><p className="eyebrow">{is404 ? 'ERRO 404' : 'ALGO DEU ERRADO'}</p><h1 className="font-display mt-4 text-[clamp(48px,6vw,76px)] tracking-[-0.055em]">{is404 ? 'Página não encontrada.' : 'Não conseguimos carregar esta página.'}</h1><p className="mt-4 text-[#6d796f]">{is404 ? 'Este endereço não existe ou o conteúdo não está disponível.' : 'Verifique sua conexão e tente novamente.'}</p><Link to="/" className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#294b39] px-6 py-3.5 text-sm font-semibold text-white">Voltar ao início <ArrowIcon /></Link></main>
}

function NotFound() {
  return <main className="mx-auto flex min-h-[65vh] max-w-[1320px] flex-col items-start justify-center px-6 md:px-10"><p className="eyebrow">ERRO 404</p><h1 className="font-display mt-4 text-[clamp(48px,6vw,76px)] tracking-[-0.055em]">Página não encontrada.</h1><p className="mt-4 text-[#6d796f]">Este endereço não existe ou o conteúdo não está disponível.</p><Link to="/" className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#294b39] px-6 py-3.5 text-sm font-semibold text-white">Voltar ao início <ArrowIcon /></Link></main>
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: ErrorPage,
    children: [
      { index: true, loader: homeLoader, Component: Home },
      { path: 'posts/:postId', loader: postLoader, action: commentAction, Component: PostPage },
      { path: 'autores/:authorId', loader: authorLoader, Component: AuthorPage },
      { path: 'historias/:storyId', loader: storyLoader, action: storyCommentAction, Component: StoryPage },
      { path: 'escritores/:writerId', loader: writerLoader, Component: WriterPage },
      { path: 'tarefas', loader: todosLoader, Component: TodosPage },
      { path: 'entrar', Component: LoginPage },
      { path: 'painel', loader: dashboardLoader, action: dashboardAction, Component: DashboardPage },
      { path: 'painel/novo', loader: newStoryLoader, action: editorAction, Component: EditorPage },
      { path: 'painel/editar/:storyId', loader: editorLoader, action: editorAction, element: <EditorPage editing /> },
      { path: '*', Component: NotFound },
    ],
  },
])
