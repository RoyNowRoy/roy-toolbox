import { SolverError } from './types'
import type { Equation, FunctionName, Node } from './types'

const functions: Record<FunctionName, number> = { ABS: 1, SQ: 1, SQRT: 1, INV: 1, EXP: 1, EXPM1: 1, LN: 1, LNP1: 1, LOG: 1, ALOG: 1, MIN: 2, MAX: 2 }
interface Token { kind: 'number' | 'name' | 'symbol'; text: string }
export function tokenize(source: string): Token[] {
  if (source.length > 4096) throw new SolverError('syntax')
  const tokens: Token[] = []
  let pos = 0
  while (pos < source.length) {
    if (/\s/.test(source[pos])) { pos++; continue }
    const rest = source.slice(pos)
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest)
    const name = /^[A-Za-z_%][A-Za-z0-9_%]*/.exec(rest)
    if (number) { tokens.push({ kind: 'number', text: number[0] }); pos += number[0].length }
    else if (name) {
      if (name[0].length > 10) throw new SolverError('syntax')
      tokens.push({ kind: 'name', text: name[0].toUpperCase() }); pos += name[0].length
    } else if ('+-*/^()=:'.includes(source[pos])) { tokens.push({ kind: 'symbol', text: source[pos++] }) }
    else throw new SolverError('syntax')
  }
  return tokens
}

export function parseEquation(source: string): Equation {
  const tokens = tokenize(source)
  if (tokens.filter((token) => token.text === '=').length !== 1) throw new SolverError('syntax')
  const variables: string[] = []
  let pos = 0
  let depth = 0
  const peek = () => tokens[pos]?.text
  const take = (text: string) => { if (peek() !== text) throw new SolverError('syntax'); pos++ }
  function primary(): Node {
    const token = tokens[pos++]
    if (!token) throw new SolverError('syntax')
    if (token.kind === 'number') {
      const value = Number(token.text)
      if (!Number.isFinite(value)) throw new SolverError('overflow')
      return { kind: 'number', value }
    }
    if (token.text === '(') { const node = expression(); take(')'); return node }
    if (token.kind !== 'name') throw new SolverError('syntax')
    if (token.text === 'PI') return { kind: 'number', value: Math.PI }
    if (Object.hasOwn(functions, token.text)) {
      const name = token.text as FunctionName
      take('(')
      const args = [expression()]
      if (functions[name] === 2) { take(':'); args.push(expression()) }
      take(')')
      return { kind: 'call', name, args }
    }
    if (!variables.includes(token.text)) variables.push(token.text)
    return { kind: 'variable', name: token.text }
  }
  function power(): Node {
    const left = primary()
    if (peek() === '^') { pos++; return { kind: 'binary', op: '^', left, right: unary() } }
    return left
  }
  function unary(): Node {
    if (++depth > 128) throw new SolverError('syntax')
    let result: Node
    if (peek() === '+' || peek() === '-') { const op = tokens[pos++].text as '+' | '-'; result = { kind: 'unary', op, arg: unary() } }
    else result = power()
    depth--
    return result
  }
  function product(): Node {
    let left = unary()
    while (peek() === '*' || peek() === '/') { const op = tokens[pos++].text as '*' | '/'; left = { kind: 'binary', op, left, right: unary() } }
    return left
  }
  function expression(): Node {
    let left = product()
    while (peek() === '+' || peek() === '-') { const op = tokens[pos++].text as '+' | '-'; left = { kind: 'binary', op, left, right: product() } }
    return left
  }
  const left = expression()
  take('=')
  const right = expression()
  if (pos !== tokens.length) throw new SolverError('syntax')
  return { left, right, variables }
}
