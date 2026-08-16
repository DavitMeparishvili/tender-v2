export type GeorgianPlaceKind =
  "CAPITAL" | "REGIONAL_CENTER" | "MUNICIPAL_CENTER" | "SETTLEMENT";

export type GeorgianPlace = Readonly<{
  id: number;
  nameEn: string;
  nameKa: string;
  kind: GeorgianPlaceKind;
  latitude: number;
  longitude: number;
  population: number;
  admin1Code: string | null;
}>;
