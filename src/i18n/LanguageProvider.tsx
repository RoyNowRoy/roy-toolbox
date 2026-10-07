import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { LanguageContext } from './language'
import type { Language } from './language'

const storageKey = 'roy-toolbox.language'

function readLanguage(): Language {
  try {
    return localStorage.getItem(storageKey) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(readLanguage)

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    try {
      localStorage.setItem(storageKey, language)
    } catch {
      // Language switching still works when browser storage is unavailable.
    }
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}
