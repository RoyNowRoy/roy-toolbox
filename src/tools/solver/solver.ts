import { SolverError } from './types'
import type { Equation, Node, SolveResult, Values } from './types'

function finite(value: number): number {
  if (Number.isNaN(value)) throw new SolverError('domain')
  if (!Number.isFinite(value)) throw new SolverError('overflow')
  return value
}
function divide(a: number, b: number): number {
  if (b === 0) throw new SolverError('division')
  return finite(a / b)
}
export function evaluate(node: Node, values: Values): number {
  if (node.kind === 'number') return node.value
  if (node.kind === 'variable') {
    if (!Object.hasOwn(values, node.name)) throw new SolverError('missing')
    return finite(values[node.name])
  }
  if (node.kind === 'unary') return finite((node.op === '-' ? -1 : 1) * evaluate(node.arg, values))
  if (node.kind === 'binary') {
    const a = evaluate(node.left, values), b = evaluate(node.right, values)
    switch (node.op) {
      case '+': return finite(a + b)
      case '-': return finite(a - b)
      case '*': return finite(a * b)
      case '/': return divide(a, b)
      case '^': return finite(a ** b)
    }
  }
  const a = evaluate(node.args[0], values)
  switch (node.name) {
    case 'ABS': return Math.abs(a)
    case 'SQ': return finite(a * a)
    case 'SQRT': if (a < 0) throw new SolverError('domain'); return Math.sqrt(a)
    case 'INV': return divide(1, a)
    case 'EXP': return finite(Math.exp(a))
    case 'EXPM1': return finite(Math.expm1(a))
    case 'LN': case 'LOG':
      if (a <= 0) throw new SolverError('domain')
      return node.name === 'LN' ? Math.log(a) : Math.log10(a)
    case 'LNP1': if (a <= -1) throw new SolverError('domain'); return Math.log1p(a)
    case 'ALOG': return finite(10 ** a)
    case 'MIN': return Math.min(a, evaluate(node.args[1], values))
    case 'MAX': return Math.max(a, evaluate(node.args[1], values))
  }
}
export function occurrences(node: Node, target: string): number {
  switch (node.kind) {
    case 'number': return 0
    case 'variable': return Number(node.name === target)
    case 'unary': return occurrences(node.arg, target)
    case 'binary': return occurrences(node.left, target) + occurrences(node.right, target)
    case 'call': return node.args.reduce((sum, arg) => sum + occurrences(arg, target), 0)
  }
}
function invertible(node: Node, target: string): boolean {
  if (node.kind === 'variable') return true
  if (node.kind === 'unary') return invertible(node.arg, target)
  if (node.kind === 'call') return !['ABS', 'MIN', 'MAX'].includes(node.name) && invertible(node.args[0], target)
  if (node.kind === 'binary') {
    const onLeft = occurrences(node.left, target) > 0
    return !(node.op === '^' && !onLeft) && invertible(onLeft ? node.left : node.right, target)
  }
  return false
}
function root(y: number, exponent: number): number {
  if (exponent === 0) throw new SolverError(y === 1 ? 'notUnique' : 'noReal')
  if (y === 0 && exponent < 0) throw new SolverError('noReal')
  if (y < 0) {
    if (!Number.isInteger(exponent) || Math.abs(exponent % 2) !== 1) throw new SolverError('noReal')
    return finite(-((-y) ** (1 / exponent)))
  }
  return finite(y ** (1 / exponent))
}
function isolate(node: Node, y: number, target: string, values: Values): number {
  finite(y)
  if (node.kind === 'variable') return y
  if (node.kind === 'unary') return isolate(node.arg, node.op === '-' ? -y : y, target, values)
  if (node.kind === 'binary') {
    const onLeft = occurrences(node.left, target) > 0
    const known = evaluate(onLeft ? node.right : node.left, values)
    let next: number
    switch (node.op) {
      case '+': next = y - known; break
      case '-': next = onLeft ? y + known : known - y; break
      case '*':
        if (known === 0) throw new SolverError(y === 0 ? 'notUnique' : 'noReal')
        next = divide(y, known); break
      case '/':
        if (onLeft) { if (known === 0) throw new SolverError('division'); next = y * known }
        else {
          if (known === 0) throw new SolverError(y === 0 ? 'notUnique' : 'noReal')
          if (y === 0) throw new SolverError('noReal')
          next = divide(known, y)
        }
        break
      case '^': next = root(y, known); break
    }
    return isolate(onLeft ? node.left : node.right, finite(next), target, values)
  }
  if (node.kind === 'call') {
    let next: number
    switch (node.name) {
      case 'SQ': next = root(y, 2); break
      case 'SQRT': if (y < 0) throw new SolverError('noReal'); next = y * y; break
      case 'INV': next = divide(1, y); break
      case 'EXP': if (y <= 0) throw new SolverError('noReal'); next = Math.log(y); break
      case 'EXPM1': if (y <= -1) throw new SolverError('noReal'); next = Math.log1p(y); break
      case 'LN': next = Math.exp(y); break
      case 'LNP1': next = Math.expm1(y); break
      case 'LOG': next = 10 ** y; break
      case 'ALOG': if (y <= 0) throw new SolverError('noReal'); next = Math.log10(y); break
      default: throw new SolverError('search')
    }
    return isolate(node.args[0], finite(next), target, values)
  }
  throw new SolverError('search')
}

interface Sample { x: number; residual: number; scale: number }
const tolerance = 1e-11
const verified = (sample: Sample) => Math.abs(sample.residual) / sample.scale <= tolerance
function iterative(sample: (x: number) => Sample, first?: number, second?: number): number {
  const points: Sample[] = []
  const safe = (x: number) => {
    if (!Number.isFinite(x)) return undefined
    try { return sample(x) } catch (error) { if (!(error instanceof SolverError)) throw error; return undefined }
  }
  const a = first ?? (second === undefined ? 0 : second + Math.max(1, Math.abs(second) * 0.1))
  const b = second ?? a + Math.max(1, Math.abs(a) * 0.1)
  const center = a / 2 + b / 2
  const initialStep = Math.max(1, Math.abs(b - a), Math.abs(center) * 0.1)
  let allZero = true
  function add(x: number): Sample | undefined {
    const point = safe(x)
    if (point && !points.some((p) => p.x === x)) { points.push(point); allZero &&= point.residual === 0 }
    return point
  }
  add(a); add(b)
  // Local probes avoid returning an arbitrary estimate for an identity.
  for (const offset of [0.37, -0.61, 1.41, -2.13]) add(center + offset * initialStep)
  if (points.length >= 3 && allZero) throw new SolverError('notUnique')
  function bracket(): [Sample, Sample] | undefined {
    const sorted = [...points].sort((p, q) => p.x - q.x)
    for (let i = 1; i < sorted.length; i++) {
      if (Math.sign(sorted[i - 1].residual) !== Math.sign(sorted[i].residual)) return [sorted[i - 1], sorted[i]]
    }
  }
  for (let expansion = 0; expansion < 32; expansion++) {
    const exact = points.find(verified)
    if (exact) return exact.x
    const bounds = bracket()
    if (bounds) {
      let [lo, hi] = bounds
      for (let iteration = 0; iteration < 160; iteration++) {
        const width = hi.x - lo.x
        const ratio = lo.residual / (lo.residual - hi.residual)
        const secant = lo.x + width * ratio
        const x = Number.isFinite(secant) && secant > lo.x + width * 0.1 && secant < hi.x - width * 0.1 ? secant : lo.x / 2 + hi.x / 2
        const point = safe(x)
        if (!point) break // A domain gap is not evidence of a root.
        if (verified(point)) return point.x
        if (x === lo.x || x === hi.x) break
        if (Math.sign(point.residual) === Math.sign(lo.residual)) lo = point
        else hi = point
      }
    }
    // Bounded secant steps also allow roots without a sign change.
    const best = [...points].sort((p, q) => Math.abs(p.residual) / p.scale - Math.abs(q.residual) / q.scale)
    if (best.length >= 2) {
      let p = best[1], q = best[0]
      const radius = initialStep * 2 ** expansion
      for (let iteration = 0; iteration < 40; iteration++) {
        if (p.residual === q.residual) break
        const x = q.x - q.residual * ((q.x - p.x) / (q.residual - p.residual))
        if (Math.abs(x - center) > radius * 4) break
        const next = add(x)
        if (!next) break
        if (verified(next)) return next.x
        p = q; q = next
      }
    }
    const distance = initialStep * 2 ** expansion
    add(center - distance); add(center + distance)
  }
  throw new SolverError('search')
}

export function canDirectSolve(equation: Equation, target: string): boolean {
  return occurrences(equation.left, target) + occurrences(equation.right, target) === 1 &&
    invertible(occurrences(equation.left, target) ? equation.left : equation.right, target)
}
export function solveEquation(equation: Equation, target: string, values: Values, guess1?: number, guess2?: number): SolveResult {
  try {
    for (const name of equation.variables) if (name !== target && !Object.hasOwn(values, name)) throw new SolverError('missing')
    const count = occurrences(equation.left, target) + occurrences(equation.right, target)
    if (!count) throw new SolverError('notUnique')
    const sample = (x: number): Sample => {
      const inputs = { ...values, [target]: finite(x) }
      const left = evaluate(equation.left, inputs), right = evaluate(equation.right, inputs)
      return { x, residual: finite(left - right), scale: Math.max(1, Math.abs(left), Math.abs(right)) }
    }
    const onLeft = occurrences(equation.left, target) > 0
    const path = onLeft ? equation.left : equation.right
    const direct = canDirectSolve(equation, target)
    const value = direct ? isolate(path, evaluate(onLeft ? equation.right : equation.left, values), target, values) : iterative(sample, guess1, guess2)
    if (!verified(sample(value))) throw new SolverError(direct ? 'noReal' : 'search')
    return { ok: true, value, method: direct ? 'direct' : 'iterative' }
  } catch (error) {
    if (!(error instanceof SolverError)) throw error
    return { ok: false, error: error.code }
  }
}
