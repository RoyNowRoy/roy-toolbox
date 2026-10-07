import { parseEquation } from './parser'

export const STORAGE_KEY = 'roy-toolbox:solver'
export interface SavedEquation { id: string; name: string; equation: string }
export interface SolverData {
  equations: SavedEquation[]
  sharedValues: Map<string, number>
  activeEquationId: string | null
}
export type StorageIssue = 'storageLoad' | 'storageWrite'
const empty = (): SolverData => ({ equations: [], sharedValues: new Map(), activeEquationId: null })
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function loadSolverData(): { data: SolverData; issue: StorageIssue | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return { data: empty(), issue: null }
    const payload: unknown = JSON.parse(raw)
    if (!record(payload) || payload.version !== 1 || !Array.isArray(payload.equations) || !Array.isArray(payload.sharedValues)) {
      return { data: empty(), issue: 'storageLoad' }
    }
    const data = empty()
    const ids = new Set<string>()
    const names = new Set<string>()
    for (const entry of payload.equations) {
      if (!record(entry) || typeof entry.id !== 'string' || !entry.id.trim() || typeof entry.name !== 'string' || typeof entry.equation !== 'string') continue
      const name = entry.name.trim()
      if (!name || Array.from(name).length > 40 || ids.has(entry.id) || names.has(name.toLowerCase())) continue
      try { if (!parseEquation(entry.equation).variables.length) continue } catch { continue }
      data.equations.push({ id: entry.id, name, equation: entry.equation })
      ids.add(entry.id); names.add(name.toLowerCase())
    }
    for (const entry of payload.sharedValues) {
      if (!record(entry) || typeof entry.name !== 'string' || typeof entry.value !== 'number' || !Number.isFinite(entry.value)) continue
      const name = entry.name.toUpperCase()
      if (!/^[A-Z_%][A-Z0-9_%]{0,9}$/.test(name)) continue
      // Ask the existing parser whether this token is a variable, rather than a function or PI.
      try { if (!parseEquation(`${name}=0`).variables.includes(name)) continue } catch { continue }
      data.sharedValues.set(name, entry.value)
    }
    data.activeEquationId = typeof payload.activeEquationId === 'string' && ids.has(payload.activeEquationId) ? payload.activeEquationId : null
    return { data, issue: null }
  } catch { return { data: empty(), issue: 'storageLoad' } }
}

export function saveSolverData(data: SolverData): StorageIssue | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      equations: data.equations,
      sharedValues: Array.from(data.sharedValues, ([name, value]) => ({ name, value })),
      activeEquationId: data.activeEquationId,
    }))
    return null
  } catch { return 'storageWrite' }
}

export function createEquationId(equations: SavedEquation[]): string {
  let id: string
  do {
    id = globalThis.crypto?.randomUUID?.() ?? `eq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  } while (equations.some((equation) => equation.id === id))
  return id
}
