import type { Locale } from "./config";
import en from "./messages/en.json";
import ka from "./messages/ka.json";

const catalogs = { en, ka } as const;

export type Messages = (typeof catalogs)["en"];

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] as Messages;
}
