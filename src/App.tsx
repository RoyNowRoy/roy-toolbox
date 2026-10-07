import { useRef, useState } from 'react'
import { toolCategories, tools } from './tools/registry'
import './App.css'

function App() {
  const [category, setCategory] = useState<string | null>(null)
  const [activeToolId, setActiveToolId] = useState<string | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const activeTool = tools.find((tool) => tool.id === activeToolId)
  const ToolComponent = activeTool?.component
  const visibleTools = tools.filter((tool) => !category || tool.category === category)

  function navigate(toolId: string | null, nextCategory: string | null = null) {
    setActiveToolId(toolId)
    setCategory(nextCategory)
    mainRef.current?.focus()
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="header">
        <button className="brand" onClick={() => navigate(null)} aria-label="Roy Toolbox home">
          <span className="brand-mark" aria-hidden="true">R<span>.</span></span>
          Roy Toolbox
        </button>
        <span className="header-note">Small tools. Everyday clarity.</span>
      </header>
      <aside className="sidebar">
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Tool navigation">
          <button className={`nav-item ${!activeTool && !category ? 'selected' : ''}`}
            aria-current={!activeTool && !category ? 'page' : undefined}
            onClick={() => navigate(null)}>
            <span aria-hidden="true">⌂</span> Home
            <span className="nav-count">{tools.length}</span>
          </button>
          <p className="nav-label category-label">CATEGORIES</p>
          {toolCategories.map((name) => (
            <button key={name}
              className={`nav-item ${category === name || activeTool?.category === name ? 'selected' : ''}`}
              aria-current={category === name || activeTool?.category === name ? 'page' : undefined}
              onClick={() => navigate(null, name)}>
              <span aria-hidden="true">Aa</span> {name}
              <span className="nav-count">{tools.filter((tool) => tool.category === name).length}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note"><span className="status-dot" /> Made for your everyday work.</div>
      </aside>
      <main id="main-content" className="main-content" ref={mainRef} tabIndex={-1}>
        {activeTool && ToolComponent ? (
          <>
            <button className="back-button" onClick={() => navigate(null)}>← Back to Home</button>
            <div className="page-heading">
              <p className="eyebrow">{activeTool.category}</p>
              <h1>{activeTool.name}</h1>
              <p className="page-description">{activeTool.description}</p>
            </div>
            <ToolComponent />
          </>
        ) : (
          <>
            <div className="page-heading home-heading">
              <p className="eyebrow">YOUR EVERYDAY TOOLKIT</p>
              <h1>A little less busywork.</h1>
              <p className="page-description">Simple, focused tools to help you get things done.<br />Pick a tool and make room for what matters.</p>
            </div>
            <section aria-labelledby="tools-heading">
              <div className="section-heading">
                <h2 id="tools-heading">{category ?? 'All tools'}</h2>
                <span>{visibleTools.length} {visibleTools.length === 1 ? 'tool' : 'tools'}</span>
              </div>
              <div className="tool-grid">
                {visibleTools.map((tool) => (
                  <button key={tool.id} className="tool-card" onClick={() => navigate(tool.id)}>
                    <span className="tool-icon" aria-hidden="true">Aa</span>
                    <span className="tool-category">{tool.category}</span>
                    <span className="tool-name">{tool.name}</span>
                    <span className="tool-description">{tool.description}</span>
                    <span className="card-action">Open tool <span aria-hidden="true">↗</span></span>
                  </button>
                ))}
              </div>
            </section>
            <p className="home-note">A growing collection, one useful tool at a time.</p>
          </>
        )}
      </main>
    </div>
  )
}

export default App
