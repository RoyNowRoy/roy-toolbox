import type { ErrorCode, SolveResult, Timing, TVMValues, Variable } from './types'

export function formatValue(value: number): string {
  if (!Number.isFinite(value)) return ''
  // Locale formatting expands scientific notation without grouping or padding.
  return new Intl.NumberFormat('en-US', { useGrouping: false, maximumFractionDigits: 4 }).format(Object.is(value, -0) ? 0 : value).replace(/^-0$/, '0')
}

export function parseValue(text: string): SolveResult {
  if (!text.trim()) return { ok: false, error: 'missing' }
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text.trim())) return { ok: false, error: 'numeric' }
  const value = Number(text)
  return Number.isFinite(value) ? { ok: true, value } : { ok: false, error: 'finite' }
}

const failure = (error: ErrorCode): SolveResult => ({ ok: false, error })

// Normalize the equation by its largest cash flow and by growth when growth > 1.
// This preserves roots while preventing overflow during bracket searches.
function residual(x: number, v: TVMValues, timing: Timing): number {
  const r = Math.expm1(x)
  const scale = Math.max(Math.abs(v.PV), Math.abs(v.PMT), Math.abs(v.FV))
  if (scale === 0) return 0
  const pv = v.PV / scale, pmt = v.PMT / scale, fv = v.FV / scale
  const k = timing === 'BEGIN' ? Math.exp(x) : 1
  const z = v.N * x
  const growth = Math.exp(-Math.abs(z))
  const annuity = r === 0 ? v.N : (z > 0 ? -Math.expm1(-z) : Math.expm1(z)) / r
  const terms = z > 0 ? [pv, pmt * annuity * k, fv * growth] : [pv * growth, pmt * annuity * k, fv]
  const magnitude = Math.max(...terms.map(Math.abs))
  if (!Number.isFinite(magnitude)) return NaN
  return magnitude === 0 ? 0 : terms.reduce((sum, term) => sum + term / magnitude, 0)
}

function solveRate(v: TVMValues, frequency: number, timing: Timing): SolveResult {
  if (v.PV === 0 && v.PMT === 0 && v.FV === 0) return failure('degenerate')
  // Search log(1+r), covering negative rates close to -1 and large positive rates.
  // Additional points around zero resolve ordinary low-rate cases accurately.
  const points = new Set<number>([0])
  for (let i = -1280; i <= 1280; i++) points.add(i / 40)
  for (let exponent = -14; exponent <= -1; exponent++) {
    points.add(10 ** exponent)
    points.add(-(10 ** exponent))
  }
  const xs = [...points].sort((a, b) => a - b)
  const roots: number[] = []
  const addRoot = (x: number) => {
    if (!roots.some((root) => Math.abs(root - x) < 1e-10)) roots.push(x)
  }
  let previousX = xs[0], previousY = residual(previousX, v, timing)
  for (const x of xs.slice(1)) {
    const y = residual(x, v, timing)
    if (y === 0) addRoot(x)
    if (Number.isFinite(y) && Number.isFinite(previousY) && y * previousY < 0) {
      let low = previousX, high = x, lowY = previousY
      let root = (low + high) / 2
      for (let iteration = 0; iteration < 180; iteration++) {
        root = low + (high - low) / 2
        const midY = residual(root, v, timing)
        if (!Number.isFinite(midY)) return failure('rateNotFound')
        if (Math.abs(midY) < 1e-14 || root === low || root === high) break
        if (lowY * midY < 0) high = root
        else { low = root; lowY = midY }
      }
      if (Math.abs(residual(root, v, timing)) < 1e-9) addRoot(root)
    }
    previousX = x; previousY = y
  }
  if (roots.length > 1) return failure('multipleRates')
  if (roots.length === 0) return failure('rateNotFound')
  const value = Math.expm1(roots[0]) * 100 * frequency
  return Number.isFinite(value) ? { ok: true, value } : failure('finite')
}

// The target is deliberately never read: callers may pass a blank or stale target.
export function solveTVM(target: Variable, input: Partial<TVMValues>, frequency: number, timing: Timing): SolveResult {
  if (!Number.isFinite(frequency) || frequency <= 0 || !Number.isInteger(frequency)) return failure('frequency')
  for (const key of ['N', 'I%YR', 'PV', 'PMT', 'FV'] as const) {
    if (key === target) continue
    if (input[key] === undefined) return failure('missing')
    if (!Number.isFinite(input[key])) return failure('finite')
  }
  const v = { ...input, [target]: 0 } as TVMValues
  if (target !== 'N' && v.N <= 0) return failure('periods')
  if (target === 'I%YR') return solveRate(v, frequency, timing)
  const r = v['I%YR'] / 100 / frequency
  if (r <= -1) return failure('rateDomain')
  const k = timing === 'BEGIN' ? 1 + r : 1
  let value: number
  if (target === 'N') {
    if (r === 0) {
      if (v.PMT === 0) return failure('degenerate')
      value = -(v.PV + v.FV) / v.PMT
    } else {
      const denominator = v.PV * r + v.PMT * k
      if (denominator === 0) return failure('degenerate')
      const delta = -(v.PV + v.FV) * r / denominator
      if (delta <= -1) return failure('logDomain')
      value = Math.log1p(delta) / Math.log1p(r)
    }
    if (value <= 0) return failure('unsolvable')
  } else {
    const z = v.N * Math.log1p(r)
    // Use the same scaled equation as the rate solver, retaining direct algebra.
    const g = Math.exp(-Math.abs(z))
    const a = (r === 0 ? v.N : (z > 0 ? -Math.expm1(-z) : Math.expm1(z)) / r) * k
    const pvFactor = z > 0 ? 1 : g
    const fvFactor = z > 0 ? g : 1
    if (target === 'PV') {
      if (pvFactor === 0) return failure('degenerate')
      value = -(v.PMT * a + v.FV * fvFactor) / pvFactor
    } else if (target === 'PMT') {
      if (a === 0) return failure('degenerate')
      value = -(v.PV * pvFactor + v.FV * fvFactor) / a
    } else {
      if (fvFactor === 0) return failure('degenerate')
      value = -(v.PV * pvFactor + v.PMT * a) / fvFactor
    }
  }
  return Number.isFinite(value) ? { ok: true, value } : failure('finite')
}
