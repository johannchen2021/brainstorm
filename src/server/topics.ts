import { createServerFn } from '@tanstack/react-start'
import { and, asc, count, eq, ne } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { ideas, topics } from '#/db/schema'

export const topicSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter a topic name')
    .max(50, 'Topic name must be 50 characters or fewer'),
})

const topicIdSchema = z.object({ id: z.number().int() })

async function assertNameAvailable(name: string, excludeId?: number) {
  const [existing] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(
      excludeId === undefined
        ? eq(topics.name, name)
        : and(eq(topics.name, name), ne(topics.id, excludeId)),
    )
  if (existing) {
    throw new Error(`Topic "${name}" already exists`)
  }
}

export const getTopics = createServerFn({ method: 'GET' }).handler(() =>
  db
    .select({
      id: topics.id,
      name: topics.name,
      ideaCount: count(ideas.id),
    })
    .from(topics)
    .leftJoin(ideas, eq(ideas.topicId, topics.id))
    .groupBy(topics.id)
    .orderBy(asc(topics.id)),
)

export const createTopic = createServerFn({ method: 'POST' })
  .validator(topicSchema)
  .handler(async ({ data }) => {
    await assertNameAvailable(data.name)
    const [row] = await db.insert(topics).values(data).returning()
    return row
  })

export const updateTopic = createServerFn({ method: 'POST' })
  .validator(topicSchema.extend(topicIdSchema.shape))
  .handler(async ({ data }) => {
    await assertNameAvailable(data.name, data.id)
    const [row] = await db
      .update(topics)
      .set({ name: data.name })
      .where(eq(topics.id, data.id))
      .returning()
    return row
  })

export const deleteTopic = createServerFn({ method: 'POST' })
  .validator(topicIdSchema)
  .handler(async ({ data }) => {
    const [{ ideaCount }] = await db
      .select({ ideaCount: count() })
      .from(ideas)
      .where(eq(ideas.topicId, data.id))
    if (ideaCount > 0) {
      throw new Error('Cannot delete a topic that still has ideas')
    }
    await db.delete(topics).where(eq(topics.id, data.id))
  })
