import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getLocales } from "expo-localization";
type Locale = "en" | "ur";
const Context = createContext({
  locale: "en" as Locale,
  setLocale: (_value: Locale) => {},
  t: (en: string, _ur: string) => en,
  rtl: false,
});
export function LocaleProvider({ children }: { children: ReactNode }) {
  const deviceLocale = useSyncExternalStore(
    subscribe,
    readLocale,
    serverLocale,
  );
  const [choice, setLocale] = useState<Locale | undefined>(undefined);
  const locale = choice ?? deviceLocale;
  return (
    <Context.Provider
      value={{
        locale,
        setLocale,
        t: (en, ur) => (locale === "ur" ? ur : en),
        rtl: locale === "ur",
      }}
    >
      {children}
    </Context.Provider>
  );
}
const subscribe = () => () => {};
const readLocale = (): Locale =>
  getLocales()[0]?.languageCode === "ur" ? "ur" : "en";
const serverLocale = (): Locale => "en";
export const useLocale = () => useContext(Context);
