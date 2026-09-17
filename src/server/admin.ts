import { createHmac, timingSafeEqual } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { ideas } from '#/db/schema'

const SESSION_COOKIE = 'admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7

export const adminIdeaSchema = z.object({
  idea: z.string().trim().min(1, 'Please enter an idea'),
  topicId: z.number().int(),
})

const ideaIdSchema = z.object({ id: z.number().int() })

function getPasscode() {
  const passcode = process.env.ADMIN_PASSCODE
  if (!passcode) {
    throw new Error('ADMIN_PASSCODE is not set')
  }
  return passcode
}

// The cookie holds an HMAC derived from the passcode rather than the passcode
// itself, so changing ADMIN_PASSCODE invalidates every existing session.
function sessionToken(passcode: string) {
  return createHmac('sha256', passcode).update('brainstorm-admin').digest('hex')
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

function isAdmin() {
  const token = getCookie(SESSION_COOKIE)
  return token !== undefined && safeEqual(token, sessionToken(getPasscode()))
}

function assertAdmin() {
  if (!isAdmin()) {
    throw new Error('Unauthorized')
  }
}

export const getAdminStatus = createServerFn({ method: 'GET' }).handler(() => ({
  isAdmin: isAdmin(),
}))

export const loginAdmin = createServerFn({ method: 'POST' })
  .validator(z.object({ passcode: z.string() }))
  .handler(({ data }) => {
    const passcode = getPasscode()
    if (!safeEqual(data.passcode, passcode)) {
      throw new Error('Incorrect passcode')
    }
    setCookie(SESSION_COOKIE, sessionToken(passcode), {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })
  })

export const logoutAdmin = createServerFn({ method: 'POST' }).handler(() => {
  deleteCookie(SESSION_COOKIE, { path: '/' })
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
