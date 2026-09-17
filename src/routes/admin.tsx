import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import {
  adminIdeaSchema,
  deleteIdea,
  getAdminIdeas,
  getAdminStatus,
  loginAdmin,
  logoutAdmin,
  updateIdea,
} from '#/server/admin'
import { getTopics } from '#/server/topics'

export const Route = createFileRoute('/admin')({
  component: Admin,
  validateSearch: z.object({
    topic: z.number().int().optional().catch(undefined),
  }),
  loader: async () => {
    const { isAdmin } = await getAdminStatus()
    if (!isAdmin) {
      return { isAdmin, ideas: [], topics: [] }
    }
    const [ideas, topics] = await Promise.all([getAdminIdeas(), getTopics()])
    return { isAdmin, ideas, topics }
  },
})

type Idea = Awaited<ReturnType<typeof getAdminIdeas>>[number]
type Topic = Awaited<ReturnType<typeof getTopics>>[number]

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
const primaryButtonClass =
  'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50'
const secondaryButtonClass =
  'rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-50'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

function Admin() {
  const { isAdmin } = Route.useLoaderData()
  return isAdmin ? <AdminIdeas /> : <PasscodeForm />
}

function PasscodeForm() {
  const router = useRouter()
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)
    setError(null)
    try {
      await loginAdmin({ data: { passcode } })
      await router.invalidate()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="display-title text-4xl font-bold">Admin</h1>
      <form className="mt-6 space-y-1" onSubmit={submit}>
        <label htmlFor="passcode" className="block text-sm font-medium">
          Passcode
        </label>
        <div className="flex gap-2">
          <input
            id="passcode"
            name="passcode"
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={isPending || passcode.length === 0}
            className={`shrink-0 ${primaryButtonClass}`}
          >
            {isPending ? 'Checking…' : 'Unlock'}
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </main>
  )
}

function AdminIdeas() {
  const { ideas, topics } = Route.useLoaderData()
  const { topic: topicFilter } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()

  const filteredIdeas =
    topicFilter === undefined
      ? ideas
      : ideas.filter((item) => item.topicId === topicFilter)

  async function logout() {
    await logoutAdmin()
    await router.invalidate()
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="display-title text-4xl font-bold">Admin</h1>
        <button type="button" onClick={logout} className={secondaryButtonClass}>
          Log out
        </button>
      </div>

      <div className="mt-6 space-y-1">
        <label htmlFor="topic-filter" className="block text-sm font-medium">
          Filter by topic
        </label>
        <select
          id="topic-filter"
          value={topicFilter === undefined ? '' : String(topicFilter)}
          onChange={(e) =>
            navigate({
              search: {
                topic: e.target.value === '' ? undefined : Number(e.target.value),
              },
              replace: true,
            })
          }
          className={inputClass}
        >
          <option value="">All topics</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name} ({topic.ideaCount})
            </option>
          ))}
        </select>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">
          Ideas · {filteredIdeas.length}
        </h2>
        {filteredIdeas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No ideas found.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {filteredIdeas.map((item) => (
              <IdeaRow key={item.id} item={item} topics={topics} />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function IdeaRow({ item, topics }: { item: Idea; topics: Topic[] }) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [idea, setIdea] = useState(item.idea)
  const [topicId, setTopicId] = useState(item.topicId)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const topicName = topics.find((topic) => topic.id === item.topicId)?.name

  async function run(action: () => Promise<unknown>) {
    setIsPending(true)
    setError(null)
    try {
      await action()
      await router.invalidate()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      setIsPending(false)
    }
  }

  function startEditing() {
    setIdea(item.idea)
    setTopicId(item.topicId)
    setError(null)
    setIsEditing(true)
  }

  async function save() {
    const parsed = adminIdeaSchema.safeParse({ idea, topicId })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    const ok = await run(() =>
      updateIdea({ data: { id: item.id, ...parsed.data } }),
    )
    if (ok) setIsEditing(false)
  }

  async function remove() {
    if (!window.confirm('Delete this idea?')) return
    await run(() => deleteIdea({ data: { id: item.id } }))
  }

  return (
    <li className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
          {topicName}
        </span>
        <time dateTime={new Date(item.createdAt).toISOString()}>
          {new Date(item.createdAt).toLocaleString()}
        </time>
      </div>

      {isEditing ? (
        <div className="mt-3 space-y-2">
          <select
            aria-label="Topic"
            value={String(topicId)}
            onChange={(e) => setTopicId(Number(e.target.value))}
            className={inputClass}
          >
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
          <textarea
            aria-label="Idea"
            rows={4}
            value={idea}
            // biome-ignore lint/a11y/noAutofocus: focus follows the user's Edit click
            autoFocus
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsEditing(false)
            }}
            className={inputClass}
          />
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap">{item.idea}</p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className={primaryButtonClass}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isPending}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startEditing}
              className={secondaryButtonClass}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              className={`${secondaryButtonClass} text-destructive`}
            >
              Delete
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </li>
  )
}
