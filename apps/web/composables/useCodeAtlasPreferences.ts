import {
  CODEATLAS_LOCALE_TAGS,
  CODEATLAS_LOCALES,
  CODEATLAS_THEMES,
  DEFAULT_CODEATLAS_LOCALE,
  DEFAULT_CODEATLAS_THEME,
  isCodeAtlasLocale,
  isCodeAtlasThemePreference,
  translateCodeAtlas,
  type CodeAtlasLocale,
  type CodeAtlasMessageKey,
  type CodeAtlasResolvedTheme,
  type CodeAtlasThemePreference
} from '~/utils/codeatlas-i18n'

export const CODEATLAS_LOCALE_STORAGE_KEY = 'codeatlas:locale'
export const CODEATLAS_THEME_STORAGE_KEY = 'codeatlas:theme'

export const useCodeAtlasPreferences = () => {
  const locale = useState<CodeAtlasLocale>('codeatlas:locale', () => DEFAULT_CODEATLAS_LOCALE)
  const themePreference = useState<CodeAtlasThemePreference>('codeatlas:theme', () => DEFAULT_CODEATLAS_THEME)
  const activeTheme = useState<CodeAtlasResolvedTheme>('codeatlas:active-theme', () => 'light')

  const setLocale = (value: unknown) => {
    if (isCodeAtlasLocale(value)) {
      locale.value = value
    }
  }

  const setThemePreference = (value: unknown) => {
    if (isCodeAtlasThemePreference(value)) {
      themePreference.value = value
    }
  }

  return {
    activeTheme,
    locale,
    localeOptions: CODEATLAS_LOCALES,
    setLocale,
    setThemePreference,
    themeOptions: CODEATLAS_THEMES,
    themePreference
  }
}

export const useCodeAtlasI18n = () => {
  const preferences = useCodeAtlasPreferences()
  const localeTag = computed(() => CODEATLAS_LOCALE_TAGS[preferences.locale.value])
  const activeThemeLabel = computed(() =>
    translateCodeAtlas(
      preferences.locale.value,
      preferences.activeTheme.value === 'dark' ? 'theme.activeDark' : 'theme.activeLight'
    )
  )

  const t = (key: CodeAtlasMessageKey, params?: Record<string, string | number>) =>
    translateCodeAtlas(preferences.locale.value, key, params)

  const formatNumber = (value: number) => new Intl.NumberFormat(localeTag.value).format(value)

  return {
    ...preferences,
    activeThemeLabel,
    formatNumber,
    localeTag,
    t
  }
}
