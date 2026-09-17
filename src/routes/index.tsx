import { useForm, useStore } from '@tanstack/react-form'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { desc } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { ideas } from '#/db/schema'

const TOPICS = ['Nex10', '釋經講道', '其它'] as const

const ideaSchema = z.object({
  idea: z.string().trim().min(1, 'Please enter an idea'),
  topic: z.enum(TOPICS),
})

const getIdeas = createServerFn({ method: 'GET' }).handler(() =>
  db.select().from(ideas).orderBy(desc(ideas.createdAt)),
)

const createIdea = createServerFn({ method: 'POST' })
  .validator(ideaSchema)
  .handler(async ({ data }) => {
    const [row] = await db.insert(ideas).values(data).returning()
    return row
  })

export const Route = createFileRoute('/')({
  component: Home,
  loader: () => getIdeas(),
})

function Home() {
  const savedIdeas = Route.useLoaderData()
  const router = useRouter()

  const form = useForm({
    defaultValues: {
      idea: '',
      topic: TOPICS[0] as (typeof TOPICS)[number],
    },
    validators: { onSubmit: ideaSchema },
    onSubmit: async ({ value, formApi }) => {
      await createIdea({ data: value })
      formApi.resetField('idea')
      await router.invalidate()
    },
  })

  const selectedTopic = useStore(form.store, (state) => state.values.topic)
  const filteredIdeas = savedIdeas.filter((item) => item.topic === selectedTopic)

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="display-title text-4xl font-bold">Brainstorm</h1>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <form.Field name="topic">
          {(field) => (
            <div className="space-y-1">
              <label htmlFor={field.name} className="block text-sm font-medium">
                Topic
              </label>
              <select
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) =>
                  field.handleChange(e.target.value as (typeof TOPICS)[number])
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form.Field>

        <form.Field name="idea">
          {(field) => (
            <div className="space-y-1">
              <label htmlFor={field.name} className="block text-sm font-medium">
                Idea
              </label>
              <textarea
                id={field.name}
                name={field.name}
                rows={4}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-sm text-destructive">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save idea'}
            </button>
          )}
        </form.Subscribe>
      </form>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Ideas · {selectedTopic}</h2>
        {filteredIdeas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No ideas for this topic yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {filteredIdeas.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                    {item.topic}
                  </span>
                  <time dateTime={new Date(item.createdAt).toISOString()}>
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap">{item.idea}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
