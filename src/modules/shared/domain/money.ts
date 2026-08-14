export type Currency = "GEL" | "USD";

export type Money = Readonly<{ minor: number; currency: Currency }>;

export const Money: { create(minor: number, currency: Currency): Money } = {
  create(minor, currency) {
    if (!Number.isSafeInteger(minor)) {
      throw new Error("Money minor units must be an integer");
    }

    if (minor < 0) {
      throw new Error("Money minor units must be non-negative");
    }

    if (currency !== "GEL" && currency !== "USD") {
      throw new Error("Money currency is unsupported");
    }

    return { minor, currency };
  },
};
