import { useState } from 'react'
import { useLanguage } from '../../i18n/language'
import type { Localized } from '../../i18n/language'

const copy: Localized<{
  title: string
  input: string
  clear: string
  placeholder: string
  stats: Record<'characters' | 'words' | 'lines', string>
  helpTitle: string
  usage: string
  characters: string
  words: string
  lines: string
  privacy: string
}> = {
  zh: {
    title: '文本计数器',
    input: '你的文本',
    clear: '清空',
    placeholder: '在此输入或粘贴文本…',
    stats: { characters: '字符数', words: '词数', lines: '行数' },
    helpTitle: '使用说明',
    usage: '输入或粘贴文本即可实时查看统计，点击“清空”可重新开始。',
    characters: '字符按 Unicode 码点计数，包含空格和换行；组合表情可能计为多个字符。',
    words: '词以空白字符分隔，连续的中文文本不会自动分词。',
    lines: '空文本为 0 行；末尾换行会增加一行。',
    privacy: '文本仅在浏览器内处理。切换语言保留输入，离开此工具后清空。',
  },
  en: {
    title: 'Text Counter',
    input: 'Your text',
    clear: 'Clear',
    placeholder: 'Type or paste your text here…',
    stats: { characters: 'Characters', words: 'Words', lines: 'Lines' },
    helpTitle: 'How to use',
    usage: 'Type or paste text to see live counts. Select Clear to start again.',
    characters: 'Characters are Unicode code points, including spaces and line breaks; combined emoji may count as multiple characters.',
    words: 'Words are separated by whitespace. Continuous Chinese text is not automatically segmented.',
    lines: 'Empty text has 0 lines; a trailing line break adds a line.',
    privacy: 'Your text is processed only in this browser. Switching languages keeps your input; leaving this tool clears it.',
  },
}

function TextCounter() {
  const { language } = useLanguage()
  const labels = copy[language]
  const [text, setText] = useState('')
  const counts = {
    characters: Array.from(text).length,
    words: text.trim() ? text.trim().split(/\s+/u).length : 0,
    lines: text ? text.split(/\r\n|\r|\n/u).length : 0,
  }

  return (
    <section className="counter-panel" aria-label={labels.title}>
      <div className="input-heading">
        <label htmlFor="counter-text">{labels.input}</label>
        <button className="clear-button" disabled={!text} onClick={() => setText('')}>{labels.clear}</button>
      </div>
      <textarea id="counter-text" value={text} onChange={(event) => setText(event.target.value)}
        placeholder={labels.placeholder} aria-describedby="counter-help-summary" />
      <dl className="counter-stats" aria-live="polite" aria-atomic="true">
        {(Object.keys(counts) as (keyof typeof counts)[]).map((id) => (
          <div key={id}><dt>{labels.stats[id]}</dt><dd>{counts[id].toLocaleString(language === 'zh' ? 'zh-CN' : 'en')}</dd></div>
        ))}
      </dl>
      <details className="counter-help">
        <summary id="counter-help-summary">{labels.helpTitle}</summary>
        <p>{labels.usage}</p>
        <ul>
          <li>{labels.characters}</li>
          <li>{labels.words}</li>
          <li>{labels.lines}</li>
        </ul>
        <p>{labels.privacy}</p>
      </details>
    </section>
  )
}

export default TextCounter
