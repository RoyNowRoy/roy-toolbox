export const variables = ['N', 'I%YR', 'PV', 'PMT', 'FV'] as const
export type Variable = typeof variables[number]
export type Timing = 'END' | 'BEGIN'
export type TVMValues = Record<Variable, number>
export type ErrorCode = 'missing' | 'numeric' | 'finite' | 'frequency' | 'periods' | 'rateDomain' | 'degenerate' | 'logDomain' | 'unsolvable' | 'rateNotFound' | 'multipleRates'
export type SolveResult = { ok: true; value: number } | { ok: false; error: ErrorCode }
export type Field = { text: string; precise?: number }
