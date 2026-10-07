import { useState } from 'react'

function TextCounter() {
  const [text, setText] = useState('')
  const counts = {
    Characters: Array.from(text).length,
    Words: text.trim() ? text.trim().split(/\s+/u).length : 0,
    Lines: text ? text.split(/\r\n|\r|\n/u).length : 0,
  }

  return (
    <section className="counter-panel" aria-label="Text counter">
      <div className="input-heading">
        <label htmlFor="counter-text">Your text</label>
        <button className="clear-button" disabled={!text} onClick={() => setText('')}>Clear</button>
      </div>
      <textarea id="counter-text" value={text} onChange={(event) => setText(event.target.value)}
        placeholder="Type or paste your text here…" aria-describedby="counter-help" />
      <dl className="counter-stats" aria-live="polite" aria-atomic="true">
        {Object.entries(counts).map(([label, count]) => (
          <div key={label}><dt>{label}</dt><dd>{count.toLocaleString()}</dd></div>
        ))}
      </dl>
      <p id="counter-help" className="counter-help">
        Characters include spaces and line breaks, counted as Unicode code points.
        Words are separated by whitespace. Empty text has 0 lines; a trailing line break adds a line.
        Your text stays in this browser and is cleared when you leave this tool.
      </p>
    </section>
  )
}

export default TextCounter
