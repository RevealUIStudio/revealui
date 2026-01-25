// Minimal translations interface for RevealUI
export interface GenericLanguages {
  [key: string]: {
    [key: string]: string | { [key: string]: string }
  }
}

export interface GenericTranslationsObject {
  [key: string]: string | { [key: string]: string }
}

export interface I18n {
  t(key: string, options?: Record<string, unknown>): string
}

export type I18nClient = I18n
