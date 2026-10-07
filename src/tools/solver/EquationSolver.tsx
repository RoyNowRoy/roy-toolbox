import { useState } from 'react'
import { useLanguage } from '../../i18n/language'
import { parseEquation } from './parser'
import { solveEquation } from './solver'
import { canDirectSolve } from './solver'
import { formatFixed, readField } from './fields'
import { SolverError } from './types'
import type { Equation, ErrorCode, Field, Values } from './types'

const copy = {
  zh: {
    equation: '方程', apply: '应用方程', active: '当前方程', solve: '求解', clear: '清除数值', advanced: '高级求解',
    guess1: '估计值 1', guess2: '估计值 2', help: '使用说明', direct: '直接求解', iterative: '迭代求解',
    intro: '输入一个方程，应用后填写已知值，再点击未知变量旁的“求解”。',
    helpText: '先尝试直接隔离未知变量，否则使用迭代求解。估计值 1 / 估计值 2 仅引导迭代寻找一个实数根，不是变量值。FIX 只控制显示，计算保留完整精度。乘法必须明确写出 *；多参数函数使用 HP 风格的冒号 :。变量名不区分大小写。',
    functions: '支持函数：ABS、SQ、SQRT、INV、EXP、EXPM1、LN、LNP1、LOG、ALOG、MIN、MAX；常量 PI。',
  },
  en: {
    equation: 'Equation', apply: 'Apply', active: 'Active equation', solve: 'Solve', clear: 'Clear Values', advanced: 'Advanced Solver',
    guess1: 'Guess 1', guess2: 'Guess 2', help: 'How to use', direct: 'Direct Solve', iterative: 'Iterative Solve',
    intro: 'Enter one equation, select Apply, enter known values, then select Solve beside the unknown variable.',
    helpText: 'Direct isolation is tried first; otherwise iterative solving is used. Guess 1 / Guess 2 guide the search for one real root and are not variable values. FIX affects display only; calculations retain full precision. Multiplication requires an explicit *; multi-argument functions use the HP-style colon :. Variable names are case-insensitive.',
    functions: 'Functions: ABS, SQ, SQRT, INV, EXP, EXPM1, LN, LNP1, LOG, ALOG, MIN, MAX; constant PI.',
  },
}
const errors: Record<'zh' | 'en', Record<ErrorCode, string>> = {
  zh: {
    syntax: '请输入两侧非空且仅含一个等号的有效方程；乘法需写出 *，函数参数用 : 分隔，变量名最长 10 个字符。',
    numeric: '请输入有效数字，不要使用千位分隔符。', missing: '请填写目标以外的所有变量值。',
    division: '除数不能为零。', domain: '数值不在函数的实数定义域内。', overflow: '数值超出可计算范围。',
    noReal: '方程没有有效的实数解。', notUnique: '方程不能唯一确定该变量。', search: '未找到可靠的实数根，请尝试不同的估计值。',
  },
  en: {
    syntax: 'Enter a valid equation with exactly one = and two non-empty sides. Use explicit *, : between function arguments, and variable names of at most 10 characters.',
    numeric: 'Enter a valid number without thousands separators.', missing: 'Enter values for all variables other than the target.',
    division: 'Division by zero is not allowed.', domain: 'A value is outside the real domain of the function.', overflow: 'A value exceeds the calculation range.',
    noReal: 'The equation has no valid real solution.', notUnique: 'The equation does not uniquely determine this variable.', search: 'No reliable real root was found. Try different guesses.',
  },
}

export default function EquationSolver() {
  const { language } = useLanguage()
  const labels = copy[language]
  const [draft, setDraft] = useState('')
  const [active, setActive] = useState<{ text: string; equation: Equation } | null>(null)
  const [fields, setFields] = useState<Record<string, Field>>({})
  const [guesses, setGuesses] = useState(['', ''])
  const [fix, setFix] = useState(4)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [solved, setSolved] = useState<{ target: string; method: 'direct' | 'iterative' } | null>(null)
  const display = (field: Field) => !field.edited && field.value !== undefined ? formatFixed(field.value, fix) : field.text
  function apply() {
    try {
      const equation = parseEquation(draft)
      setActive({ text: draft, equation })
      setFields(Object.fromEntries(equation.variables.map((name) => [name, { text: '' }])))
      setGuesses(['', '']); setError(null); setSolved(null)
    } catch (failure) { if (failure instanceof SolverError) setError(failure.code); else throw failure }
  }
  function solve(target: string) {
    if (!active) return
    try {
      const values: Values = {}
      const next = { ...fields }
      for (const name of active.equation.variables) {
        if (name === target) continue
        values[name] = readField(fields[name])
        next[name] = { text: fields[name].text, value: values[name] }
      }
      // Guesses are irrelevant to direct solving, including malformed guesses.
      const estimates = canDirectSolve(active.equation, target) ? [] : guesses.map((text) => text.trim() ? readField({ text }) : undefined)
      const result = solveEquation(active.equation, target, values, estimates[0], estimates[1])
      if (!result.ok) { setError(result.error); return }
      next[target] = { text: String(result.value), value: result.value }
      setFields(next); setError(null); setSolved({ target, method: result.method })
    } catch (failure) { if (failure instanceof SolverError) setError(failure.code); else throw failure }
  }
  return <section className="counter-panel tvm-panel" aria-label="SOLVE">
    <p>{labels.intro}</p>
    <form onSubmit={(event) => { event.preventDefault(); apply() }}>
      <div className="input-heading" style={{ marginTop: 20 }}>
        <label htmlFor="solver-equation">{labels.equation}</label>
        <button className="clear-button" type="submit">{labels.apply}</button>
      </div>
      <input id="solver-equation" type="text" style={{ width: '100%' }} value={draft} placeholder="A+B=C"
        onChange={(event) => setDraft(event.target.value)} autoComplete="off" spellCheck={false} />
    </form>
    {active && <p className="tvm-status">{labels.active}: <code>{active.text}</code></p>}
    <div className="tvm-settings">
      <fieldset className="tvm-fix"><legend>FIX</legend><div className="tvm-fix-options">
        {[0, 1, 2, 3, 4].map((digits) => <button key={digits} type="button" aria-label={`FIX ${digits}`}
          aria-pressed={fix === digits} onClick={() => setFix(digits)}>{digits}</button>)}
      </div></fieldset>
      <button className="clear-button" onClick={() => {
        setFields(Object.fromEntries((active?.equation.variables ?? []).map((name) => [name, { text: '' }])))
        setGuesses(['', '']); setError(null); setSolved(null)
      }}>{labels.clear}</button>
    </div>
    <div className="tvm-fields">
      {active?.equation.variables.map((name) => <div className="tvm-row" style={{ gridTemplateColumns: 'minmax(70px, 110px) minmax(0, 1fr) auto' }} key={name}>
        <label htmlFor={`solver-${name}`} style={{ overflowWrap: 'anywhere' }}>{name}</label>
        <input id={`solver-${name}`} type="text" inputMode="decimal" value={display(fields[name])} aria-describedby="solver-status"
          onChange={(event) => {
            setFields((current) => ({ ...current, [name]: { ...current[name], text: event.target.value, edited: true } }))
            setError(null); setSolved(null)
          }} onBlur={() => {
            try {
              const value = readField(fields[name])
              setFields((current) => ({ ...current, [name]: { text: fields[name].text, value } }))
            } catch (failure) { if (!(failure instanceof SolverError)) throw failure }
          }} />
        <button className="clear-button" aria-label={`${labels.solve} ${name}`} onClick={() => solve(name)}>{labels.solve}</button>
      </div>)}
    </div>
    <p id="solver-status" className={error ? 'tvm-error' : 'tvm-status'} role="status" aria-live="polite">
      {error ? errors[language][error] : solved ? `${solved.target} = ${display(fields[solved.target])} · ${labels[solved.method]}` : ''}
    </p>
    <details className="counter-help"><summary>{labels.advanced}</summary>
      <div className="tvm-settings">{guesses.map((text, index) => <label key={index} htmlFor={`solver-guess-${index}`}>
        {index === 0 ? labels.guess1 : labels.guess2}
        <input id={`solver-guess-${index}`} type="text" inputMode="decimal" value={text}
          onChange={(event) => setGuesses((current) => current.map((value, i) => i === index ? event.target.value : value))} />
      </label>)}</div>
    </details>
    <details className="counter-help"><summary>{labels.help}</summary>
      <p>{labels.intro}</p><p>{labels.helpText}</p><p>{labels.functions}</p>
      <ul>{['A+B=C', 'DIST=SPEED*TIME', 'A^2=B', 'X+LN(X)=10', 'ABS(X)=5'].map((example) => <li key={example}><code>{example}</code></li>)}</ul>
    </details>
  </section>
}
