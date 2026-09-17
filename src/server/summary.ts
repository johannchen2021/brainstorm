import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { ideas, topics } from '#/db/schema'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-5.6-luna'

const SYSTEM_PROMPT = `你是一位協助整理腦力激盪結果的助理。
使用者會提供一個主題以及該主題下收集到的想法。
請用繁體中文撰寫一份簡潔的總結報告，使用 Markdown 格式，包含：
1. 整體概述（2–3 句）
2. 主要主題或想法分類（條列）
3. 建議的下一步行動（條列）
只根據提供的想法撰寫，不要虛構內容。`

type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[]
  error?: { message?: string }
}

export const summarizeIdeas = createServerFn({ method: 'POST' })
  .validator(z.object({ topicId: z.number().int() }))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set')
    }

    const [topic] = await db
      .select({ name: topics.name })
      .from(topics)
      .where(eq(topics.id, data.topicId))
    if (!topic) {
      throw new Error('Topic not found')
    }

    const topicIdeas = await db
      .select({ idea: ideas.idea })
      .from(ideas)
      .where(eq(ideas.topicId, data.topicId))
      .orderBy(asc(ideas.createdAt))
    if (topicIdeas.length === 0) {
      throw new Error('This topic has no ideas to summarize')
    }

    const ideaList = topicIdeas
      .map((item, index) => `${index + 1}. ${item.idea}`)
      .join('\n')

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Brainstorm',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `主題：${topic.name}\n\n想法：\n${ideaList}`,
          },
        ],
      }),
    })

    const result = (await response.json()) as ChatCompletionResponse
    if (!response.ok) {
      throw new Error(
        `OpenRouter request failed: ${result.error?.message ?? response.statusText}`,
      )
    }

    const summary = result.choices?.[0]?.message?.content?.trim()
    if (!summary) {
      throw new Error('OpenRouter returned an empty summary')
    }
    return { summary }
  })
