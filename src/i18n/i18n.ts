import type { LocaleKey, LocaleMessages } from '../core/types'
import { zhCN } from './zh-CN'
import { en } from './en'

const BUILTIN: Record<LocaleKey, LocaleMessages> = { 'zh-CN': zhCN, en }

export class I18nManager {
  private locale: LocaleKey
  private messages: LocaleMessages

  constructor(locale: LocaleKey, customMessages?: LocaleMessages) {
    this.locale = locale
    this.messages = customMessages ?? BUILTIN[locale] ?? zhCN
  }

  t(key: keyof LocaleMessages, params?: Record<string, string | number>): string {
    const template = this.messages[key] ?? key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (_, name) =>
      params[name] != null ? String(params[name]) : `{${name}}`,
    )
  }

  getLocale(): LocaleKey {
    return this.locale
  }

  setLocale(locale: LocaleKey, customMessages?: LocaleMessages): void {
    this.locale = locale
    this.messages = customMessages ?? BUILTIN[locale] ?? zhCN
  }
}
