import type { Locale } from "../../localization/config";
import type { GeorgianPlace } from "../domain/georgian-place";

export type GeorgianPlaceOption = Readonly<{
  id: number;
  nameEn: string;
  label: string;
  secondaryLabel: string;
  regionLabel: string;
  latitude: number;
  longitude: number;
}>;

const REGIONS: Readonly<Record<string, Readonly<Record<Locale, string>>>> = {
  "02": { en: "Abkhazia", ka: "აფხაზეთი", ru: "Абхазия" },
  "04": { en: "Adjara", ka: "აჭარა", ru: "Аджария" },
  "51": { en: "Tbilisi", ka: "თბილისი", ru: "Тбилиси" },
  "65": { en: "Guria", ka: "გურია", ru: "Гурия" },
  "66": { en: "Imereti", ka: "იმერეთი", ru: "Имерети" },
  "67": { en: "Kakheti", ka: "კახეთი", ru: "Кахети" },
  "68": { en: "Kvemo Kartli", ka: "ქვემო ქართლი", ru: "Квемо-Картли" },
  "69": {
    en: "Mtskheta-Mtianeti",
    ka: "მცხეთა-მთიანეთი",
    ru: "Мцхета-Мтианети",
  },
  "70": {
    en: "Racha-Lechkhumi and Kvemo Svaneti",
    ka: "რაჭა-ლეჩხუმი და ქვემო სვანეთი",
    ru: "Рача-Лечхуми и Квемо-Сванети",
  },
  "71": {
    en: "Samegrelo and Zemo Svaneti",
    ka: "სამეგრელო-ზემო სვანეთი",
    ru: "Самегрело — Земо-Сванети",
  },
  "72": {
    en: "Samtskhe-Javakheti",
    ka: "სამცხე-ჯავახეთი",
    ru: "Самцхе-Джавахети",
  },
  "73": { en: "Shida Kartli", ka: "შიდა ქართლი", ru: "Шида-Картли" },
};

export interface GeorgianPlaceCatalog {
  listActive(): Promise<readonly GeorgianPlace[]>;
}

export function createListGeorgianPlaces(catalog: GeorgianPlaceCatalog) {
  return async function listGeorgianPlaces(
    locale: Locale,
  ): Promise<readonly GeorgianPlaceOption[]> {
    const places = await catalog.listActive();
    return places.map((place) => ({
      id: place.id,
      nameEn: place.nameEn,
      label: locale === "ka" ? place.nameKa : place.nameEn,
      secondaryLabel: locale === "ka" ? place.nameEn : place.nameKa,
      regionLabel:
        (place.admin1Code ? REGIONS[place.admin1Code]?.[locale] : undefined) ??
        (locale === "ka"
          ? "საქართველო"
          : locale === "ru"
            ? "Грузия"
            : "Georgia"),
      latitude: place.latitude,
      longitude: place.longitude,
    }));
  };
}

export async function listGeorgianPlaces(
  locale: Locale,
): Promise<readonly GeorgianPlaceOption[]> {
  const { prismaGeorgianPlaceCatalog } =
    await import("../infrastructure/prisma-georgian-place-catalog");
  return createListGeorgianPlaces(prismaGeorgianPlaceCatalog)(locale);
}
