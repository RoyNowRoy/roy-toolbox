import type { Localized } from './language'

type ShellMessages = {
  skipToContent: string
  homeLabel: string
  tagline: string
  languageLabel: string
  workspace: string
  navigation: string
  home: string
  categories: string
  sidebarNote: string
  backHome: string
  eyebrow: string
  heading: string
  description: string
  descriptionEnd: string
  allTools: string
  toolCount: (count: number) => string
  openTool: string
  homeNote: string
}

export const messages: Localized<ShellMessages> = {
  zh: {
    skipToContent: '跳转到内容',
    homeLabel: 'Roy Toolbox 首页',
    tagline: '小工具，让日常更轻松。',
    languageLabel: '界面语言',
    workspace: '工作空间',
    navigation: '工具导航',
    home: '首页',
    categories: '工具分类',
    sidebarNote: '为你的日常工作而造。',
    backHome: '返回首页',
    eyebrow: '你的日常工具箱',
    heading: '少一点琐事，多一点从容。',
    description: '简单、专注的工具，帮你完成日常工作。',
    descriptionEnd: '选一个工具，把时间留给重要的事。',
    allTools: '全部工具',
    toolCount: (count) => `${count} 个工具`,
    openTool: '打开工具',
    homeNote: '每次添一个实用工具，让工具箱慢慢成长。',
  },
  en: {
    skipToContent: 'Skip to content',
    homeLabel: 'Roy Toolbox home',
    tagline: 'Small tools. Everyday clarity.',
    languageLabel: 'Interface language',
    workspace: 'WORKSPACE',
    navigation: 'Tool navigation',
    home: 'Home',
    categories: 'CATEGORIES',
    sidebarNote: 'Made for your everyday work.',
    backHome: 'Back to Home',
    eyebrow: 'YOUR EVERYDAY TOOLKIT',
    heading: 'A little less busywork.',
    description: 'Simple, focused tools to help you get things done.',
    descriptionEnd: 'Pick a tool and make room for what matters.',
    allTools: 'All tools',
    toolCount: (count) => `${count} ${count === 1 ? 'tool' : 'tools'}`,
    openTool: 'Open tool',
    homeNote: 'A growing collection, one useful tool at a time.',
  },
}
