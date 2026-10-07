import type { Timing } from './types'

export type FixDigits = 0 | 1 | 2 | 3 | 4

export type AmortizationInput = { PV: number; PMT: number; annualRate: number; frequency: number; timing: Timing; digits?: FixDigits }
export type AmortizationError = 'finite' | 'frequency' | 'rateDomain' | 'payment' | 'blockSize'
export type AmortizationRow = { number: number; payment: number; interest: number; principal: number; balance: number }
export type AmortizationBlock = { cursor: number; interest: number; principal: number; balance: number; rows: AmortizationRow[] }
export type AmortizationResult = { ok: true; block: AmortizationBlock } | { ok: false; error: AmortizationError }

// Decimal shifting avoids binary multiplication errors at monetary half ties.
// Round the magnitude so negative ties use the same half-away rule as positive ties.
export function roundMoney(value: number, digits: FixDigits = 4): number {
  const [coefficient, exponent = '0'] = Math.abs(value).toString().split('e')
  const units = Math.round(Number(`${coefficient}e${Number(exponent) + digits}`))
  const rounded = Math.sign(value) * units / 10 ** digits
  return rounded === 0 ? 0 : rounded
}

export function calculateAmortization(input: AmortizationInput, count: number, previous: AmortizationBlock | null = null): AmortizationResult {
  const digits = input.digits ?? 4
  const monetaryScale = 10 ** digits
  const round = (value: number) => roundMoney(value, digits)
  const fail = (error: AmortizationError): AmortizationResult => ({ ok: false, error })
  if (![input.PV, input.PMT, input.annualRate].every(Number.isFinite)) return fail('finite')
  if (!Number.isInteger(input.frequency) || input.frequency <= 0) return fail('frequency')
  if (!Number.isInteger(count) || count < 1 || count > 1200) return fail('blockSize')
  if (input.PMT === 0) return fail('payment')
  const rate = input.annualRate / 100 / input.frequency
  if (rate <= -1) return fail('rateDomain')
  const payment = round(input.PMT)
  let balance = previous?.balance ?? round(input.PV)
  const cursor = previous?.cursor ?? 0
  // Safe integer monetary units are required to retain the selected FIX precision.
  const safeMoney = (value: number) => Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER / monetaryScale
  if (!safeMoney(payment) || !safeMoney(balance) || !Number.isSafeInteger(cursor + count)) return fail('finite')
  const rows: AmortizationRow[] = []
  let interest = 0, principal = 0
  for (let offset = 1; offset <= count; offset++) {
    const number = cursor + offset
    const rowInterest = input.timing === 'BEGIN' && number === 1 ? 0 : round(-round(balance * rate))
    const rowPrincipal = round(payment - rowInterest)
    balance = round(balance + rowPrincipal)
    interest = round(interest + rowInterest)
    principal = round(principal + rowPrincipal)
    if (![rowInterest, rowPrincipal, balance, interest, principal].every(safeMoney)) return fail('finite')
    rows.push({ number, payment, interest: rowInterest, principal: rowPrincipal, balance })
  }
  return { ok: true, block: { cursor: cursor + count, interest, principal, balance, rows } }
}
