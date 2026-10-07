import { SolverError } from './types'
import type { Field } from './types'

export function formatFixed(value: number, digits: number): string {
  const text = new Intl.NumberFormat('en-US', { useGrouping: false, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
  return Number(text) === 0 ? text.replace(/^-/, '') : text
}
export function readField(field: Field): number {
  if (!field.edited && field.value !== undefined) return field.value
  const text = field.text.trim()
  if (!text) throw new SolverError('missing')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) throw new SolverError('numeric')
  const value = Number(text)
  if (!Number.isFinite(value)) throw new SolverError('overflow')
  return value
}
