import { useRef, useState } from 'react'
import { categoryLabels, toolCategories, tools } from './tools/registry'
import type { CategoryId } from './tools/registry'
import { useLanguage } from './i18n/language'
import { messages } from './i18n/messages'
import './App.css'

function App() {
  const { language, setLanguage } = useLanguage()
  const copy = messages[language]
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [activeToolId, setActiveToolId] = useState<string | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const activeTool = tools.find((tool) => tool.id === activeToolId)
  const ToolComponent = activeTool?.component
  const visibleTools = tools.filter((tool) => !category || tool.category === category)

  function navigate(toolId: string | null, nextCategory: CategoryId | null = null) {
    setActiveToolId(toolId)
    setCategory(nextCategory)
    mainRef.current?.focus()
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{copy.skipToContent}</a>
      <header className="header">
        <button className="brand" onClick={() => navigate(null)} aria-label={copy.homeLabel}>
          <span className="brand-mark" aria-hidden="true">R<span>.</span></span>
          Roy Toolbox
        </button>
        <div className="header-actions">
          <span className="header-note">{copy.tagline}</span>
          <div className="language-switch" role="group" aria-label={copy.languageLabel}>
            <button lang="zh-CN" aria-label="中文" aria-pressed={language === 'zh'}
              onClick={() => setLanguage('zh')}>CN</button>
            <button lang="en" aria-label="English" aria-pressed={language === 'en'}
              onClick={() => setLanguage('en')}>EN</button>
          </div>
        </div>
      </header>
      <aside className="sidebar">
        <p className="nav-label">{copy.workspace}</p>
        <nav aria-label={copy.navigation}>
          <button className={`nav-item ${!activeTool && !category ? 'selected' : ''}`}
            aria-current={!activeTool && !category ? 'page' : undefined}
            onClick={() => navigate(null)}>
            <span aria-hidden="true">⌂</span> {copy.home}
            <span className="nav-count">{tools.length}</span>
          </button>
          <p className="nav-label category-label">{copy.categories}</p>
          {toolCategories.map((categoryId) => (
            <button key={categoryId}
              className={`nav-item ${category === categoryId || activeTool?.category === categoryId ? 'selected' : ''}`}
              aria-current={category === categoryId || activeTool?.category === categoryId ? 'page' : undefined}
              onClick={() => navigate(null, categoryId)}>
              <span aria-hidden="true">Aa</span> {categoryLabels[categoryId][language]}
              <span className="nav-count">{tools.filter((tool) => tool.category === categoryId).length}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note"><span className="status-dot" /> {copy.sidebarNote}</div>
      </aside>
      <main id="main-content" className="main-content" ref={mainRef} tabIndex={-1}>
        {activeTool && ToolComponent ? (
          <>
            <button className="back-button" onClick={() => navigate(null)}>← {copy.backHome}</button>
            <div className="page-heading">
              <p className="eyebrow">{categoryLabels[activeTool.category][language]}</p>
              <h1>{activeTool.name[language]}</h1>
              <p className="page-description">{activeTool.description[language]}</p>
            </div>
            <ToolComponent />
          </>
        ) : (
          <>
            <div className="page-heading home-heading">
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1>{copy.heading}</h1>
              <p className="page-description">{copy.description}<br />{copy.descriptionEnd}</p>
            </div>
            <section aria-labelledby="tools-heading">
              <div className="section-heading">
                <h2 id="tools-heading">{category ? categoryLabels[category][language] : copy.allTools}</h2>
                <span>{copy.toolCount(visibleTools.length)}</span>
              </div>
              <div className="tool-grid">
                {visibleTools.map((tool) => (
                  <button key={tool.id} className="tool-card" onClick={() => navigate(tool.id)}>
                    <span className="tool-icon" aria-hidden="true">Aa</span>
                    <span className="tool-category">{categoryLabels[tool.category][language]}</span>
                    <span className="tool-name">{tool.name[language]}</span>
                    <span className="tool-description">{tool.description[language]}</span>
                    <span className="card-action">{copy.openTool} <span aria-hidden="true">↗</span></span>
                  </button>
                ))}
              </div>
            </section>
            <p className="home-note">{copy.homeNote}</p>
          </>
        )}
      </main>
    </div>
  )
}

export default App
