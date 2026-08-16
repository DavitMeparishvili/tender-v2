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

const REGIONS: Readonly<Record<string, Readonly<{ en: string; ka: string }>>> =
  {
    "02": { en: "Abkhazia", ka: "აფხაზეთი" },
    "04": { en: "Adjara", ka: "აჭარა" },
    "51": { en: "Tbilisi", ka: "თბილისი" },
    "65": { en: "Guria", ka: "გურია" },
    "66": { en: "Imereti", ka: "იმერეთი" },
    "67": { en: "Kakheti", ka: "კახეთი" },
    "68": { en: "Kvemo Kartli", ka: "ქვემო ქართლი" },
    "69": { en: "Mtskheta-Mtianeti", ka: "მცხეთა-მთიანეთი" },
    "70": {
      en: "Racha-Lechkhumi and Kvemo Svaneti",
      ka: "რაჭა-ლეჩხუმი და ქვემო სვანეთი",
    },
    "71": {
      en: "Samegrelo and Zemo Svaneti",
      ka: "სამეგრელო-ზემო სვანეთი",
    },
    "72": { en: "Samtskhe-Javakheti", ka: "სამცხე-ჯავახეთი" },
    "73": { en: "Shida Kartli", ka: "შიდა ქართლი" },
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
        (locale === "ka" ? "საქართველო" : "Georgia"),
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
