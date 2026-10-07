import { useRef, useState } from 'react'
import { useLanguage } from '../../i18n/language'
import { parseEquation } from './parser'
import { solveEquation } from './solver'
import { canDirectSolve } from './solver'
import { formatFixed, readField } from './fields'
import { SolverError } from './types'
import type { Equation, ErrorCode, Field, Values } from './types'
import { createEquationId, loadSolverData, saveSolverData } from './storage'
import type { SolverData, StorageIssue } from './storage'

const copy = {
  zh: {
    equation: '方程', apply: '应用方程', active: '当前方程', solve: '求解', clear: '清除当前变量', advanced: '高级求解',
    catalog: '公式库', new: '新建', save: '保存', delete: '删除', name: '公式名称', unsaved: '未保存公式', clearAll: '清除全部共享变量',
    discardConfirm: '放弃当前公式名称或方程的未保存修改？', deleteConfirm: '删除当前保存的公式？共享变量将保留。', clearConfirm: '清除全部共享变量？保存的公式将保留。',
    guess1: '估计值 1', guess2: '估计值 2', help: '使用说明', direct: '直接求解', iterative: '迭代求解',
    intro: '输入一个方程，应用后填写已知值，再点击未知变量旁的“求解”。',
    helpText: '先尝试直接隔离未知变量，否则使用迭代求解。估计值 1 / 估计值 2 仅引导迭代寻找一个实数根，不是变量值。FIX 只控制显示，计算保留完整精度。乘法必须明确写出 *；多参数函数使用 HP 风格的冒号 :。变量名不区分大小写。',
    functions: '支持函数：ABS、SQ、SQRT、INV、EXP、EXPM1、LN、LNP1、LOG、ALOG、MIN、MAX；常量 PI。',
  },
  en: {
    equation: 'Equation', apply: 'Apply', active: 'Active equation', solve: 'Solve', clear: 'Clear Current Values', advanced: 'Advanced Solver',
    catalog: 'Equation Catalog', new: 'New', save: 'Save', delete: 'Delete', name: 'Formula Name', unsaved: 'Unsaved formula', clearAll: 'Clear All Shared Values',
    discardConfirm: 'Discard unsaved changes to this formula name or equation?', deleteConfirm: 'Delete the selected saved formula? Shared values will be kept.', clearConfirm: 'Clear all shared values? Saved formulas will be kept.',
    guess1: 'Guess 1', guess2: 'Guess 2', help: 'How to use', direct: 'Direct Solve', iterative: 'Iterative Solve',
    intro: 'Enter one equation, select Apply, enter known values, then select Solve beside the unknown variable.',
    helpText: 'Direct isolation is tried first; otherwise iterative solving is used. Guess 1 / Guess 2 guide the search for one real root and are not variable values. FIX affects display only; calculations retain full precision. Multiplication requires an explicit *; multi-argument functions use the HP-style colon :. Variable names are case-insensitive.',
    functions: 'Functions: ABS, SQ, SQRT, INV, EXP, EXPM1, LN, LNP1, LOG, ALOG, MIN, MAX; constant PI.',
  },
}
const catalogErrors = {
  zh: {
    nameRequired: '请输入公式名称。', nameLength: '公式名称最多 40 个字符。', nameDuplicate: '公式名称已存在（不区分大小写）。',
    variablesRequired: '保存的方程必须至少包含一个变量。', storageLoad: '无法读取部分或全部 Solver 存储数据，已使用可用数据继续运行。原存储未被自动覆盖。',
    storageWrite: '无法保存到本地存储；本次更改仍在内存中可用，刷新后可能丢失。',
  },
  en: {
    nameRequired: 'Enter a formula name.', nameLength: 'Formula names must be at most 40 characters.', nameDuplicate: 'This formula name already exists (case-insensitive).',
    variablesRequired: 'A saved equation must contain at least one variable.', storageLoad: 'Some or all Solver storage could not be loaded. Continuing with available data. Stored data was not automatically overwritten.',
    storageWrite: 'Local storage could not be saved. Changes remain usable in memory but may be lost on reload.',
  },
}
type CatalogError = keyof typeof catalogErrors.en

function fieldsFromShared(equation: Equation, shared: Map<string, number>): Record<string, Field> {
  return Object.fromEntries(equation.variables.map((name) => {
    const value = shared.get(name)
    return [name, value === undefined ? { text: '' } : { text: String(value), value }]
  }))
}

function initialState() {
  const { data, issue } = loadSolverData()
  const selected = data.equations.find((entry) => entry.id === data.activeEquationId)
  const active = selected ? { text: selected.equation, equation: parseEquation(selected.equation) } : null
  return { data, issue, selected, active }
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
  const [initial] = useState(initialState)
  const durable = useRef<SolverData>(initial.data)
  const [catalog, setCatalog] = useState(initial.data.equations)
  const [selectedId, setSelectedId] = useState(initial.data.activeEquationId)
  const [nameDraft, setNameDraft] = useState(initial.selected?.name ?? '')
  const [draft, setDraft] = useState(initial.selected?.equation ?? '')
  const [active, setActive] = useState<{ text: string; equation: Equation } | null>(initial.active)
  const [fields, setFields] = useState<Record<string, Field>>(() => initial.active ? fieldsFromShared(initial.active.equation, initial.data.sharedValues) : {})
  const [guesses, setGuesses] = useState(['', ''])
  const [fix, setFix] = useState(4)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [catalogError, setCatalogError] = useState<CatalogError | null>(null)
  const [storageIssue, setStorageIssue] = useState<StorageIssue | null>(initial.issue)
  const [solved, setSolved] = useState<{ target: string; method: 'direct' | 'iterative' } | null>(null)
  const display = (field: Field) => !field.edited && field.value !== undefined ? formatFixed(field.value, fix) : field.text
  const selected = catalog.find((entry) => entry.id === selectedId)
  const dirty = selected !== undefined && (selected.name !== nameDraft || selected.equation !== draft)
  function persist() { setStorageIssue(saveSolverData(durable.current)) }
  function activate(text: string, equation: Equation) {
    setActive({ text, equation })
    setFields(fieldsFromShared(equation, durable.current.sharedValues))
    setGuesses(['', '']); setError(null); setCatalogError(null); setSolved(null)
  }
  function clearEditor() {
    setSelectedId(null); setNameDraft(''); setDraft(''); setActive(null); setFields({})
    setGuesses(['', '']); setError(null); setCatalogError(null); setSolved(null)
  }
  function newFormula() {
    if (dirty && !window.confirm(labels.discardConfirm)) return
    clearEditor()
    if (durable.current.activeEquationId !== null) { durable.current.activeEquationId = null; persist() }
  }
  function selectFormula(id: string) {
    if (id === selectedId || (dirty && !window.confirm(labels.discardConfirm))) return
    const formula = catalog.find((entry) => entry.id === id)
    if (!formula) { newFormula(); return }
    setSelectedId(id); setNameDraft(formula.name); setDraft(formula.equation)
    activate(formula.equation, parseEquation(formula.equation))
    if (durable.current.activeEquationId !== id) { durable.current.activeEquationId = id; persist() }
  }
  function saveFormula() {
    const name = nameDraft.trim()
    setError(null); setCatalogError(null)
    if (!name) { setCatalogError('nameRequired'); return }
    if (Array.from(name).length > 40) { setCatalogError('nameLength'); return }
    if (catalog.some((entry) => entry.id !== selectedId && entry.name.toLowerCase() === name.toLowerCase())) { setCatalogError('nameDuplicate'); return }
    try {
      const equation = parseEquation(draft)
      if (!equation.variables.length) { setCatalogError('variablesRequired'); return }
      const formula = { id: selectedId ?? createEquationId(catalog), name, equation: draft }
      const equations = selectedId ? catalog.map((entry) => entry.id === selectedId ? formula : entry) : [...catalog, formula]
      durable.current.equations = equations; durable.current.activeEquationId = formula.id
      setCatalog(equations); setSelectedId(formula.id); setNameDraft(name)
      activate(draft, equation); persist()
    } catch (failure) { if (failure instanceof SolverError) setError(failure.code); else throw failure }
  }
  function deleteFormula() {
    if (!selectedId || !window.confirm(labels.deleteConfirm)) return
    const equations = catalog.filter((entry) => entry.id !== selectedId)
    durable.current.equations = equations; durable.current.activeEquationId = null
    setCatalog(equations); clearEditor(); persist()
  }
  function clearValues(all: boolean) {
    if (all && !window.confirm(labels.clearConfirm)) return
    if (all) durable.current.sharedValues.clear()
    else for (const name of active?.equation.variables ?? []) durable.current.sharedValues.delete(name)
    setFields(Object.fromEntries((active?.equation.variables ?? []).map((name) => [name, { text: '' }])))
    setGuesses(['', '']); setError(null); setSolved(null); persist()
  }
  function commitField(name: string) {
    try {
      const value = readField(fields[name])
      setFields((current) => ({ ...current, [name]: { text: fields[name].text, value } }))
      if (durable.current.sharedValues.get(name) !== value) { durable.current.sharedValues.set(name, value); persist() }
    } catch (failure) { if (!(failure instanceof SolverError)) throw failure }
  }
  function apply() {
    try {
      const equation = parseEquation(draft)
      activate(draft, equation)
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
      for (const name of active.equation.variables) durable.current.sharedValues.set(name, next[name].value!)
      setFields(next); setError(null); setSolved({ target, method: result.method })
      persist()
    } catch (failure) { if (failure instanceof SolverError) setError(failure.code); else throw failure }
  }
  return <section className="counter-panel tvm-panel" aria-label="SOLVE">
    <p>{labels.intro}</p>
    <fieldset style={{ border: '1px solid #dbe4dc', borderRadius: 8, padding: 12 }}>
      <legend>{labels.catalog}</legend>
      <label htmlFor="solver-catalog">{labels.catalog}</label>
      <select id="solver-catalog" style={{ width: '100%', padding: 8, margin: '8px 0 12px' }} value={selectedId ?? ''}
        onChange={(event) => event.target.value ? selectFormula(event.target.value) : newFormula()}>
        <option value="">{labels.unsaved}</option>
        {catalog.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select>
      <label htmlFor="solver-name">{labels.name}</label>
      <input id="solver-name" type="text" style={{ width: '100%', margin: '8px 0 12px' }} value={nameDraft}
        onChange={(event) => setNameDraft(event.target.value)} autoComplete="off" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <button type="button" className="clear-button" onClick={newFormula}>{labels.new}</button>
        <button type="button" className="clear-button" onClick={saveFormula}>{labels.save}</button>
        <button type="button" className="clear-button" disabled={!selectedId} onClick={deleteFormula}>{labels.delete}</button>
      </div>
    </fieldset>
    <p className="tvm-error" role="status" aria-live="polite">{storageIssue ? catalogErrors[language][storageIssue] : ''}</p>
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
      <button className="clear-button" onClick={() => clearValues(false)}>{labels.clear}</button>
      <button className="clear-button" onClick={() => clearValues(true)}>{labels.clearAll}</button>
    </div>
    <div className="tvm-fields">
      {active?.equation.variables.map((name) => <div className="tvm-row" style={{ gridTemplateColumns: 'minmax(70px, 110px) minmax(0, 1fr) auto' }} key={name}>
        <label htmlFor={`solver-${name}`} style={{ overflowWrap: 'anywhere' }}>{name}</label>
        <input id={`solver-${name}`} type="text" inputMode="decimal" value={display(fields[name])} aria-describedby="solver-status"
          onChange={(event) => {
            setFields((current) => ({ ...current, [name]: { ...current[name], text: event.target.value, edited: true } }))
            setError(null); setSolved(null)
          }} onBlur={() => commitField(name)} />
        <button className="clear-button" aria-label={`${labels.solve} ${name}`} onClick={() => solve(name)}>{labels.solve}</button>
      </div>)}
    </div>
    <p id="solver-status" className={error || catalogError ? 'tvm-error' : 'tvm-status'} role="status" aria-live="polite">
      {error ? errors[language][error] : catalogError ? catalogErrors[language][catalogError] : solved ? `${solved.target} = ${display(fields[solved.target])} · ${labels[solved.method]}` : ''}
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
