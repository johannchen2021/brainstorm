import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { ideas } from '#/db/schema'
import {
  assertAdmin,
  endAdminSession,
  isAdmin,
  startAdminSession,
} from '#/server/admin-session.server'

export const adminIdeaSchema = z.object({
  idea: z.string().trim().min(1, 'Please enter an idea'),
  topicId: z.number().int(),
})

const ideaIdSchema = z.object({ id: z.number().int() })

export const getAdminStatus = createServerFn({ method: 'GET' }).handler(() => ({
  isAdmin: isAdmin(),
}))

export const loginAdmin = createServerFn({ method: 'POST' })
  .validator(z.object({ passcode: z.string() }))
  .handler(({ data }) => {
    startAdminSession(data.passcode)
  })

export const logoutAdmin = createServerFn({ method: 'POST' }).handler(() => {
  endAdminSession()
})

export const getAdminIdeas = createServerFn({ method: 'GET' }).handler(() => {
  assertAdmin()
  return db.select().from(ideas).orderBy(desc(ideas.createdAt))
})

export const updateIdea = createServerFn({ method: 'POST' })
  .validator(adminIdeaSchema.extend(ideaIdSchema.shape))
  .handler(async ({ data }) => {
    assertAdmin()
    const [row] = await db
      .update(ideas)
      .set({ idea: data.idea, topicId: data.topicId })
      .where(eq(ideas.id, data.id))
      .returning()
    if (!row) {
      throw new Error('Idea not found')
    }
    return row
  })

export const deleteIdea = createServerFn({ method: 'POST' })
  .validator(ideaIdSchema)
  .handler(async ({ data }) => {
    assertAdmin()
    await db.delete(ideas).where(eq(ideas.id, data.id))
  })
