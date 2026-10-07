export type FunctionName = 'ABS' | 'SQ' | 'SQRT' | 'INV' | 'EXP' | 'EXPM1' | 'LN' | 'LNP1' | 'LOG' | 'ALOG' | 'MIN' | 'MAX'
export type Node =
  | { kind: 'number'; value: number }
  | { kind: 'variable'; name: string }
  | { kind: 'unary'; op: '+' | '-'; arg: Node }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node }
  | { kind: 'call'; name: FunctionName; args: Node[] }
export interface Equation { left: Node; right: Node; variables: string[] }
export type ErrorCode = 'syntax' | 'numeric' | 'missing' | 'division' | 'domain' | 'overflow' | 'noReal' | 'notUnique' | 'search'
export class SolverError extends Error {
  code: ErrorCode
  constructor(code: ErrorCode) { super(code); this.code = code }
}
export interface Field { text: string; value?: number; edited?: boolean }
export type Values = Record<string, number>
export type SolveResult = { ok: true; value: number; method: 'direct' | 'iterative' } | { ok: false; error: ErrorCode }
