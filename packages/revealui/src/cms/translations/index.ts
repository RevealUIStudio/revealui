// Minimal translations interface for RevealUI
export interface GenericLanguages {
  [key: string]: {
    [key: string]: string | { [key: string]: string };
  };
}

export interface GenericTranslationsObject {
  [key: string]: string | { [key: string]: string };
}

export interface I18n {
  t(key: string, options?: any): string;
}

export interface I18nClient extends I18n {
  // Client-specific methods if needed
}
