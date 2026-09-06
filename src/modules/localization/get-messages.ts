import type { Locale } from "./config";
import en from "./messages/en.json";
import ka from "./messages/ka.json";
import ru from "./messages/ru.json";

const catalogs = { en, ka, ru } as const;

export type Messages = (typeof catalogs)["en"];

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] as Messages;
}
