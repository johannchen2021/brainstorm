import { createHmac, timingSafeEqual } from 'node:crypto'

import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'

const SESSION_COOKIE = 'admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7

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

export function isAdmin() {
  const token = getCookie(SESSION_COOKIE)
  return token !== undefined && safeEqual(token, sessionToken(getPasscode()))
}

export function assertAdmin() {
  if (!isAdmin()) {
    throw new Error('Unauthorized')
  }
}

export function startAdminSession(submittedPasscode: string) {
  const passcode = getPasscode()
  if (!safeEqual(submittedPasscode, passcode)) {
    throw new Error('Incorrect passcode')
  }
  setCookie(SESSION_COOKIE, sessionToken(passcode), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export function endAdminSession() {
  deleteCookie(SESSION_COOKIE, { path: '/' })
}
