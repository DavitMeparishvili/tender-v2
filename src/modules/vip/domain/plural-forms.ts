export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/**
 * One message per plural category, as stored in the message catalogs. `other`
 * is required; the other categories are optional and fall back to it.
 */
export type PluralForms = Readonly<Partial<Record<PluralCategory, string>>> &
  Readonly<{ other: string }>;

/**
 * Picks the message for `count` in `locale`. Russian has three noun forms
 * (1 партнёр, 2 партнёра, 5 партнёров), which Intl.PluralRules resolves.
 */
export function pluralTemplate(
  forms: PluralForms,
  count: number,
  locale: string,
): string {
  const category = new Intl.PluralRules(locale).select(count) as PluralCategory;
  return forms[category] ?? forms.other;
}

/** Replaces `{name}` placeholders. Unknown placeholders are left in place. */
export function fillTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in values ? String(values[key]) : placeholder,
  );
}
