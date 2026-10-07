import type { ComponentType } from 'react'
import TextCounter from './text-counter/TextCounter'

export interface ToolDefinition {
  id: string
  name: string
  description: string
  category: string
  component: ComponentType
}

// Add independent tools here; navigation and home cards use this registry.
export const tools: readonly ToolDefinition[] = [
  {
    id: 'text-counter',
    name: 'Text Counter',
    description: 'Count characters, words, and lines as you type or paste your text.',
    category: 'Text',
    component: TextCounter,
  },
]

export const toolCategories = [...new Set(tools.map((tool) => tool.category))]
