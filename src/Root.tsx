import App from './App.tsx'
import { useLang } from './lib/i18n'

/** Re-creates the whole UI when the language changes, so every translated string is looked up again. */
export default function Root() {
  const lang = useLang()
  return <App key={lang} />
}
