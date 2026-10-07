import type { ComponentType } from 'react'
import type { Localized } from '../i18n/language'
import TextCounter from './text-counter/TextCounter'
import TVMCalculator from './tvm/TVMCalculator'

// Define each category label once; tools reference only its language-neutral ID.
export const categoryLabels = {
  text: { zh: '文本', en: 'Text' },
  finance: { zh: '金融', en: 'Finance' },
} satisfies Record<string, Localized<string>>

export type CategoryId = keyof typeof categoryLabels

export interface ToolDefinition {
  id: string
  name: Localized<string>
  description: Localized<string>
  category: CategoryId
  component: ComponentType
}

// Add independent tools here; navigation and home cards use this registry.
export const tools: readonly ToolDefinition[] = [
  {
    id: 'tvm',
    name: { zh: 'TVM 货币时间价值', en: 'TVM Calculator' },
    description: {
      zh: '根据 N、I%YR、PV、PMT、FV 中任意四项求第五项。',
      en: 'Solve any one of N, I%YR, PV, PMT, and FV from the other four.',
    },
    category: 'finance',
    component: TVMCalculator,
  },
  {
    id: 'text-counter',
    name: { zh: '文本计数器', en: 'Text Counter' },
    description: {
      zh: '输入或粘贴文本，实时统计字符数、词数和行数。',
      en: 'Count characters, words, and lines as you type or paste your text.',
    },
    category: 'text',
    component: TextCounter,
  },
]

export const toolCategories = [...new Set(tools.map((tool) => tool.category))]
