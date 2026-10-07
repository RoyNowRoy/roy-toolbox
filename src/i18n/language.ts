import { createContext, useContext } from 'react'

export type Language = 'zh' | 'en'
export type Localized<T> = Record<Language, T>

export const LanguageContext = createContext<{
  language: Language
  setLanguage: (language: Language) => void
} | null>(null)

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
