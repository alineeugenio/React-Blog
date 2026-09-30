import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-9a700259/health", (c) => {
  return c.json({ status: "ok" });
});

const base = "/make-server-9a700259";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Story = { id: string; authorId: string; authorName: string; title: string; body: string; createdAt: string; updatedAt: string };
type StoryComment = { id: string; storyId: string; name: string; email: string; body: string; approved: boolean; createdAt: string };
const key = (id: string) => `story:${id}`;

async function authenticatedUser(c: any) {
  const token = c.req.header("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

function storyInput(input: any) {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  return title.length >= 3 && title.length <= 180 && body.length >= 10 && body.length <= 20000
    ? { title, body }
    : null;
}

app.get(`${base}/stories`, async (c) => {
  const stories = await kv.getByPrefix("story:") as Story[];
  return c.json(stories.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.get(`${base}/stories/:id`, async (c) => {
  if (!uuid.test(c.req.param("id"))) return c.json({ error: "Não encontrado" }, 404);
  const story = await kv.get(key(c.req.param("id"))) as Story | undefined;
  return story ? c.json(story) : c.json({ error: "Não encontrado" }, 404);
});

app.get(`${base}/stories/:id/comments`, async (c) => {
  if (!uuid.test(c.req.param("id"))) return c.json({ error: "Não encontrado" }, 404);
  const story = await kv.get(key(c.req.param("id"))) as Story | undefined;
  if (!story) return c.json({ error: "Não encontrado" }, 404);
  const comments = await kv.getByPrefix(`comment:${story.id}:`) as StoryComment[];
  return c.json(comments.filter((comment) => comment.approved).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(({ id, name, body, createdAt }) => ({ id, name, body, createdAt })));
});

app.post(`${base}/stories/:id/comments`, async (c) => {
  if (!uuid.test(c.req.param("id"))) return c.json({ error: "Não encontrado" }, 404);
  const story = await kv.get(key(c.req.param("id"))) as Story | undefined;
  if (!story) return c.json({ error: "Não encontrado" }, 404);
  const input = await c.req.json().catch(() => null);
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150 || !body || body.length > 3000) {
    return c.json({ error: "Preencha nome, e-mail válido e comentário (até 3.000 caracteres)." }, 400);
  }
  // This publication currently uses automatic approval; only approved comments are exposed publicly.
  const comment: StoryComment = { id: crypto.randomUUID(), storyId: story.id, name, email, body, approved: true, createdAt: new Date().toISOString() };
  await kv.set(`comment:${story.id}:${comment.id}`, comment);
  return c.json({ id: comment.id, name, body, createdAt: comment.createdAt }, 201);
});

app.get(`${base}/authors/:id/stories`, async (c) => {
  if (!uuid.test(c.req.param("id"))) return c.json({ error: "Não encontrado" }, 404);
  const stories = await kv.getByPrefix("story:") as Story[];
  return c.json(stories.filter((story) => story.authorId === c.req.param("id")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.get(`${base}/my/stories`, async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Não autorizado" }, 401);
  const stories = await kv.getByPrefix("story:") as Story[];
  return c.json(stories.filter((story) => story.authorId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.post(`${base}/my/stories`, async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Não autorizado" }, 401);
  const input = storyInput(await c.req.json().catch(() => null));
  if (!input) return c.json({ error: "Informe um título de 3 a 180 caracteres e um conteúdo de 10 a 20.000 caracteres." }, 400);
  const now = new Date().toISOString();
  const story: Story = {
    id: crypto.randomUUID(), authorId: user.id,
    authorName: (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim().slice(0, 100)) || user.email?.split("@")[0] || "Autor",
    ...input, createdAt: now, updatedAt: now,
  };
  await kv.set(key(story.id), story);
  return c.json(story, 201);
});

app.put(`${base}/my/stories/:id`, async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Não autorizado" }, 401);
  if (!uuid.test(c.req.param("id"))) return c.json({ error: "Não encontrado" }, 404);
  const story = await kv.get(key(c.req.param("id"))) as Story | undefined;
  if (!story || story.authorId !== user.id) return c.json({ error: "Não encontrado" }, 404);
  const input = storyInput(await c.req.json().catch(() => null));
  if (!input) return c.json({ error: "Informe um título de 3 a 180 caracteres e um conteúdo de 10 a 20.000 caracteres." }, 400);
  const updated = { ...story, ...input, updatedAt: new Date().toISOString() };
  await kv.set(key(story.id), updated);
  return c.json(updated);
});

app.delete(`${base}/my/stories/:id`, async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Não autorizado" }, 401);
  if (!uuid.test(c.req.param("id"))) return c.json({ error: "Não encontrado" }, 404);
  const story = await kv.get(key(c.req.param("id"))) as Story | undefined;
  if (!story || story.authorId !== user.id) return c.json({ error: "Não encontrado" }, 404);
  const comments = await kv.getByPrefix(`comment:${story.id}:`) as StoryComment[];
  if (comments.length) await kv.mdel(comments.map((comment) => `comment:${story.id}:${comment.id}`));
  await kv.del(key(story.id));
  return c.json({ success: true });
});

app.onError((error, c) => {
  console.error("Story API error", error);
  return c.json({ error: "Erro interno. Tente novamente." }, 500);
});

Deno.serve(app.fetch);
