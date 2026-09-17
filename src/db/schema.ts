import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const todos = pgTable('todos', {
  id: serial().primaryKey(),
  title: text().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const topics = pgTable('topics', {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const ideas = pgTable('ideas', {
  id: serial().primaryKey(),
  idea: text().notNull(),
  topicId: integer('topic_id')
    .notNull()
    .references(() => topics.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
