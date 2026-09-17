import { useForm } from '@tanstack/react-form'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import {
  createTopic,
  deleteTopic,
  getTopics,
  topicSchema,
  updateTopic,
} from '#/server/topics'

export const Route = createFileRoute('/topics')({
  component: Topics,
  loader: () => getTopics(),
})

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

function Topics() {
  const topics = Route.useLoaderData()
  const router = useRouter()
  const [createError, setCreateError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { name: '' },
    validators: { onSubmit: topicSchema },
    onSubmit: async ({ value, formApi }) => {
      setCreateError(null)
      try {
        await createTopic({ data: value })
        formApi.reset()
        await router.invalidate()
      } catch (error) {
        setCreateError(errorMessage(error))
      }
    },
  })

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="display-title text-4xl font-bold">Topics</h1>

      <form
        className="mt-6 space-y-1"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <label htmlFor="name" className="block text-sm font-medium">
          New topic
        </label>
        <form.Field name="name">
          {(field) => (
            <>
              <div className="flex gap-2">
                <input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    setCreateError(null)
                    field.handleChange(e.target.value)
                  }}
                  className={inputClass}
                />
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`shrink-0 ${primaryButtonClass}`}
                    >
                      {isSubmitting ? 'Adding…' : 'Add topic'}
                    </button>
                  )}
                </form.Subscribe>
              </div>
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-sm text-destructive">
                  {error?.message}
                </p>
              ))}
            </>
          )}
        </form.Field>
        {createError && (
          <p className="text-sm text-destructive">{createError}</p>
        )}
      </form>

      <section className="mt-10">
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No topics yet.</p>
        ) : (
          <ul className="space-y-3">
            {topics.map((topic) => (
              <TopicRow key={topic.id} topic={topic} />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function TopicRow({ topic }: { topic: Topic }) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(topic.name)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setName(topic.name)
    setError(null)
    setIsEditing(true)
  }

  async function save() {
    const parsed = topicSchema.safeParse({ name })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    if (parsed.data.name === topic.name) {
      setIsEditing(false)
      return
    }
    const ok = await run(() =>
      updateTopic({ data: { id: topic.id, name: parsed.data.name } }),
    )
    if (ok) setIsEditing(false)
  }

  async function remove() {
    if (!window.confirm(`Delete topic "${topic.name}"?`)) return
    await run(() => deleteTopic({ data: { id: topic.id } }))
  }

  const hasIdeas = topic.ideaCount > 0

  return (
    <li className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        {isEditing ? (
          <input
            aria-label="Topic name"
            value={name}
            // biome-ignore lint/a11y/noAutofocus: focus follows the user's Rename click
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setIsEditing(false)
            }}
            className={inputClass}
          />
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{topic.name}</p>
            <p className="text-xs text-muted-foreground">
              {topic.ideaCount} {topic.ideaCount === 1 ? 'idea' : 'ideas'}
            </p>
          </div>
        )}

        <div className="flex shrink-0 gap-2">
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
                Rename
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={isPending || hasIdeas}
                title={hasIdeas ? 'This topic still has ideas' : undefined}
                className={`${secondaryButtonClass} text-destructive`}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </li>
  )
}
