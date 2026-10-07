import { useState } from 'react'
import { useLanguage } from '../../i18n/language'
import type { Localized } from '../../i18n/language'
import { formatValue, parseValue, solveTVM } from './tvm'
import { variables } from './types'
import { calculateAmortization, formatMoney } from './amortization'
import type { AmortizationBlock, AmortizationError } from './amortization'
import type { ErrorCode, Field, Timing, TVMValues, Variable } from './types'

const errors: Localized<Record<ErrorCode, string>> = {
  zh: {
    missing: '请填写目标以外的四个变量及 P/YR。',
    numeric: '请输入有效数字，不要使用千位分隔符。',
    finite: '数值超出可计算范围，请检查输入。',
    frequency: 'P/YR 必须是正整数。',
    periods: '输入的 N 必须大于 0。',
    rateDomain: '每期利率必须大于 -100%，请检查 I%YR 和 P/YR。',
    degenerate: '这些数值使方程无法确定唯一结果，请检查现金流。',
    logDomain: '这些现金流不满足求解 N 的对数条件。',
    unsolvable: '这些数值无法得到有效的正数 N。',
    rateNotFound: '未找到可靠的利率解，请检查现金流及正负号。',
    multipleRates: '存在多个利率解，结果不唯一，请检查现金流。',
  },
  en: {
    missing: 'Enter the other four variables and P/YR.',
    numeric: 'Enter a valid number without thousands separators.',
    finite: 'A value exceeds the calculation range. Check your inputs.',
    frequency: 'P/YR must be a positive integer.',
    periods: 'The input N must be greater than 0.',
    rateDomain: 'The periodic rate must exceed -100%. Check I%YR and P/YR.',
    degenerate: 'These values do not determine a unique result. Check the cash flows.',
    logDomain: 'These cash flows do not meet the logarithm conditions for solving N.',
    unsolvable: 'These values cannot produce a valid positive N.',
    rateNotFound: 'No reliable rate solution was found. Check cash flows and signs.',
    multipleRates: 'Multiple interest rate solutions exist; the result is not unique.',
  },
}

const copy = {
  zh: {
    calculate: '计算', restart: '重新开始', range: '当前付款范围', before: '尚未计算，下一笔为付款 1', table: '摊销表',
    amrtHelp: 'AMRT 将付款分为利息和本金。#P 为当前块的付款笔数；INT 为块利息，PRIN 为块本金，BAL 为期末余额。NEXT 从下一笔继续；修改 #P 只影响下一块。重新开始返回付款 1，不清除 TVM 值。AMRT 按四位小数逐期舍入，与 HP 17bII+ FIX 4 行为一致；TVM Core 保留原有的更高内部精度。',
    solve: '求解', clear: '清除', timing: '付款时点', help: '使用说明',
    intro: '输入四个变量，设置 P/YR 和 BEGIN/END，再点击未知变量旁的“求解”。',
    purpose: 'TVM 根据现金流和复利关系求解 N、I%YR、PV、PMT、FV 中的任意一项。',
    definitions: ['N：付款期数，不是年数；允许数学上有效的小数期数。', 'I%YR：名义年利率，单位为百分比。每期利率 = I%YR / 100 / P/YR。', 'PV：现值。', 'PMT：每期付款金额。', 'FV：终值。', 'P/YR：每年的付款期数，必须是正整数。', 'END：每期末付款。', 'BEGIN：每期初付款。', '+ 表示收到的钱；− 表示付出的钱。'],
    example: '示例：30 年按月还款的贷款',
    instruction: '输入下列数值，再求解 PMT。显示结果为 -1206.9339。贷款本金是收到的钱（+PV），还款是付出的钱（−PMT）。',
    precision: '界面最多显示四位小数；求解结果保留完整内部精度。手动编辑后使用重新提交的数值。',
  },
  en: {
    calculate: 'Calculate', restart: 'Restart', range: 'Current payment range', before: 'No block calculated; next is payment 1', table: 'Amortization table',
    amrtHelp: 'AMRT splits payments into interest and principal. #P is the number of payments in the current block; INT is block interest, PRIN is block principal, and BAL is the ending balance. NEXT continues with the next payment; changing #P affects only the next block. Restart returns to payment 1 without clearing TVM values. AMRT uses sequential four-decimal monetary rounding, matching HP 17bII+ FIX 4 behavior; TVM Core retains its existing higher internal precision.',
    solve: 'Solve', clear: 'Clear', timing: 'Payment timing', help: 'How to use',
    intro: 'Enter four variables, set P/YR and BEGIN/END, then select Solve beside the unknown variable.',
    purpose: 'TVM uses cash flows and compound interest to solve any one of N, I%YR, PV, PMT, and FV.',
    definitions: ['N: number of payment periods, not years; mathematically valid fractional periods are allowed.', 'I%YR: nominal annual interest rate in percent. Periodic rate = I%YR / 100 / P/YR.', 'PV: present value.', 'PMT: payment per period.', 'FV: future value.', 'P/YR: payment periods per year; must be a positive integer.', 'END: payment at the end of each period.', 'BEGIN: payment at the beginning of each period.', '+ means money received; − means money paid.'],
    example: 'Example: a 30-year monthly loan',
    instruction: 'Enter the values below and solve PMT. The displayed result is -1206.9339. Loan proceeds are received (+PV), while repayments are money paid (−PMT).',
    precision: 'The interface displays up to four decimals; solved values retain full internal precision. Manual edits use the newly committed value.',
  },
}

const amrtErrors: Localized<Record<AmortizationError, string>> = {
  zh: { finite: '金额超出可安全计算范围，请检查输入。', frequency: 'P/YR 必须是正整数。', rateDomain: '每期利率必须大于 -100%。', payment: 'PMT 不能为 0。', blockSize: '#P 必须是 1–1200 的整数。' },
  en: { finite: 'An amount exceeds the safe calculation range. Check your inputs.', frequency: 'P/YR must be a positive integer.', rateDomain: 'The periodic rate must exceed -100%.', payment: 'PMT must not be zero.', blockSize: '#P must be an integer from 1 through 1200.' },
}
const amrtVariables: Variable[] = ['PV', 'I%YR', 'PMT']

const emptyFields = (): Record<Variable, Field> => ({ N: { text: '' }, 'I%YR': { text: '' }, PV: { text: '' }, PMT: { text: '' }, FV: { text: '' } })

// Solved precision survives commits until the first manual edit removes it.
function commit(field: Field): Field {
  if (field.precise !== undefined) return field
  const parsed = parseValue(field.text)
  return parsed.ok ? { text: formatValue(parsed.value) } : field
}

export default function TVMCalculator() {
  const { language } = useLanguage()
  const labels = copy[language]
  const [fields, setFields] = useState(emptyFields)
  const [frequency, setFrequency] = useState<Field>({ text: '12' })
  const [timing, setTiming] = useState<Timing>('END')
  const [error, setError] = useState<ErrorCode | null>(null)
  const [solved, setSolved] = useState<Variable | null>(null)

  const [blockSize, setBlockSize] = useState('12')
  const [blockSizeEdited, setBlockSizeEdited] = useState(false)
  const [block, setBlock] = useState<AmortizationBlock | null>(null)
  const [amrtError, setAmrtError] = useState<AmortizationError | ErrorCode | null>(null)
  const parsedDefault = parseValue(frequency.text)
  const defaultSize = parsedDefault.ok && Number.isInteger(parsedDefault.value) && parsedDefault.value >= 1 && parsedDefault.value <= 1200 ? String(parsedDefault.value) : '12'
  const countText = blockSizeEdited ? blockSize : defaultSize

  function restartAmrt() {
    setBlock(null)
    setAmrtError(null)
  }

  function calculateBlock() {
    const values: Partial<TVMValues> = {}
    for (const variable of amrtVariables) {
      const field = commit(fields[variable])
      const parsed = parseValue(field.text)
      if (!parsed.ok) { setAmrtError(parsed.error); return }
      values[variable] = field.precise ?? parsed.value
    }
    const parsedFrequency = parseValue(frequency.text)
    if (!parsedFrequency.ok) { setAmrtError(parsedFrequency.error); return }
    const parsedCount = parseValue(countText)
    if (!parsedCount.ok) { setAmrtError('blockSize'); return }
    const result = calculateAmortization({ PV: values.PV!, PMT: values.PMT!, annualRate: values['I%YR']!, frequency: parsedFrequency.value, timing }, parsedCount.value, block)
    if (!result.ok) { setAmrtError(result.error); return }
    setBlock(result.block)
    setAmrtError(null)
  }

  function solve(target: Variable) {
    const next = { ...fields }
    const input: Partial<TVMValues> = {}
    let validation: ErrorCode | null = null
    for (const variable of variables) {
      if (variable === target) continue
      next[variable] = commit(fields[variable])
      const parsed = parseValue(next[variable].text)
      if (!parsed.ok) validation ??= parsed.error
      else input[variable] = next[variable].precise ?? parsed.value
    }
    // Validate the original frequency before rounding: a fractional P/YR is invalid.
    const parsedFrequency = parseValue(frequency.text)
    if (!parsedFrequency.ok) validation ??= parsedFrequency.error
    else if (parsedFrequency.value <= 0 || !Number.isInteger(parsedFrequency.value)) validation ??= 'frequency'
    setFields(next)
    setSolved(null)
    if (validation || !parsedFrequency.ok) { setError(validation); return }
    setFrequency(commit(frequency))
    const result = solveTVM(target, input, parsedFrequency.value, timing)
    if (!result.ok) { setError(result.error); return }
    setFields({ ...next, [target]: { text: formatValue(result.value), precise: result.value } })
    setError(null)
    setSolved(target)
    if (amrtVariables.includes(target)) restartAmrt()
  }

  return (
    <section className="counter-panel tvm-panel" aria-label="TVM">
      <div className="input-heading">
        <p>{labels.intro}</p>
        <button className="clear-button" onClick={() => {
          setFields(emptyFields()); setFrequency({ text: '12' }); setTiming('END'); setError(null); setSolved(null); restartAmrt(); setBlockSizeEdited(false)
        }}>{labels.clear}</button>
      </div>
      <div className="tvm-settings">
        <label htmlFor="tvm-frequency">P/YR
          <input id="tvm-frequency" type="text" inputMode="numeric" value={frequency.text}
            onChange={(event) => { setFrequency({ text: event.target.value }); setError(null); setSolved(null); restartAmrt() }}
            onBlur={() => {
              const parsed = parseValue(frequency.text)
              if (parsed.ok && parsed.value > 0 && Number.isInteger(parsed.value)) setFrequency(commit(frequency))
              else setError(parsed.ok ? 'frequency' : parsed.error)
            }} />
        </label>
        <fieldset><legend>{labels.timing}</legend>
          {(['END', 'BEGIN'] as const).map((value) => <label key={value}>
            <input type="radio" name="tvm-timing" checked={timing === value}
              onChange={() => { setTiming(value); setError(null); setSolved(null); restartAmrt() }} /> {value}
          </label>)}
        </fieldset>
      </div>
      <div className="tvm-fields">
        {variables.map((variable) => <div className="tvm-row" key={variable}>
          <label htmlFor={`tvm-${variable}`}>{variable}</label>
          <input id={`tvm-${variable}`} type="text" inputMode="decimal" value={fields[variable].text}
            aria-describedby="tvm-status"
            onChange={(event) => {
              setFields((current) => ({ ...current, [variable]: { text: event.target.value } }))
              setError(null); setSolved(null)
              if (amrtVariables.includes(variable)) restartAmrt()
            }}
            onBlur={() => setFields((current) => ({ ...current, [variable]: commit(current[variable]) }))} />
          <button className="clear-button" aria-label={`${labels.solve} ${variable}`} onClick={() => solve(variable)}>{labels.solve}</button>
        </div>)}
      </div>
      <p id="tvm-status" className={error ? 'tvm-error' : 'tvm-status'} role="status" aria-live="polite">
        {error ? errors[language][error] : solved ? `${solved} = ${fields[solved].text}` : ''}
      </p>
      <section className="amrt-section" aria-label="AMRT">
        <h2>AMRT</h2>
        <div className="tvm-settings amrt-controls">
          <label htmlFor="amrt-count">#P
            <input id="amrt-count" type="text" inputMode="numeric" value={countText}
              onChange={(event) => { setBlockSize(event.target.value); setBlockSizeEdited(true); setAmrtError(null) }} />
          </label>
          <button className="clear-button" disabled={block !== null} onClick={calculateBlock}>{labels.calculate}</button>
          <button className="clear-button" disabled={block === null} onClick={calculateBlock}>NEXT</button>
          <button className="clear-button" onClick={restartAmrt}>{labels.restart}</button>
        </div>
        <p className="tvm-status" role="status" aria-live="polite">
          {labels.range}: {block ? `${block.rows[0].number}–${block.cursor}` : labels.before}
        </p>
        {amrtError && <p className="tvm-error" role="alert">{amrtError === 'missing' ? (language === 'zh' ? '请填写 PV、I%YR、PMT 和 P/YR。' : 'Enter PV, I%YR, PMT, and P/YR.') : { ...errors[language], ...amrtErrors[language] }[amrtError]}</p>}
        {block && <>
          <dl className="counter-stats amrt-stats">
            <div><dt>INT</dt><dd>{formatMoney(block.interest)}</dd></div>
            <div><dt>PRIN</dt><dd>{formatMoney(block.principal)}</dd></div>
            <div><dt>BAL</dt><dd>{formatMoney(block.balance)}</dd></div>
          </dl>
          <details className="counter-help">
            <summary>{labels.table}</summary>
            <div className="amrt-table-scroll" tabIndex={0} role="region" aria-label={labels.table}>
              <table className="amrt-table">
                <thead><tr>{['#', 'PMT', 'INT', 'PRIN', 'BAL'].map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
                <tbody>{block.rows.map((row) => <tr key={row.number}>
                  <th scope="row">{row.number}</th><td>{formatMoney(row.payment)}</td><td>{formatMoney(row.interest)}</td>
                  <td>{formatMoney(row.principal)}</td><td>{formatMoney(row.balance)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </details>
        </>}
      </section>
      <details className="counter-help">
        <summary>{labels.help}</summary>
        <p>{labels.purpose}</p>
        <ul>{labels.definitions.map((definition) => <li key={definition}>{definition}</li>)}</ul>
        <p>{labels.intro}</p>
        <p><strong>{labels.example}</strong></p>
        <p>N = 360 · I%YR = 9 · PV = 150000 · FV = 0 · P/YR = 12 · END</p>
        <p>{labels.instruction}</p>
        <p>{labels.precision}</p>
        <p><strong>AMRT</strong></p>
        <p>{labels.amrtHelp}</p>
      </details>
    </section>
  )
}
