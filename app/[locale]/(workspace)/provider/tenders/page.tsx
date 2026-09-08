import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/src/modules/localization/config";
import {
  getMessages,
  type Messages,
} from "@/src/modules/localization/get-messages";
import { getMarketplaceOverview } from "@/src/modules/shell/application/marketplace-overview";
import {
  listGeorgianPlaces,
  type GeorgianPlaceOption,
} from "@/src/modules/tenders/application/list-georgian-places";
import { BrandIcon } from "@/src/modules/shell/ui/brand-icon";
import {
  DiscoveryFilters,
  type DiscoveryFilterCopy,
} from "@/src/modules/tenders/ui/discovery-filters";
import { DiscoveryList } from "@/src/modules/tenders/ui/discovery-list";
import type { DiscoverySearchParams } from "@/src/modules/tenders/ui/discovery-query";
import {
  ActiveFilterChips,
  type ActiveFilter,
} from "@/src/modules/tenders/ui/discovery-toolbar";
import {
  isTenderServiceCode,
  isTenderSpecialty,
} from "@/src/modules/tenders/domain/service-taxonomy";
import {
  serviceLabel,
  specialtyLabel,
} from "@/src/modules/tenders/ui/tender-taxonomy";

function filterCopyFor(messages: Messages): DiscoveryFilterCopy {
  return {
    apply: messages.tenders.applyFilters,
    pending: messages.common.working,
    specialty: messages.tenders.filterSpecialty,
    allSpecialties: messages.tenders.filterAllSpecialties,
    service: messages.tenders.filterService,
    allServices: messages.tenders.filterAllServices,
    selectCategory: messages.tenders.serviceSelectCategory,
    serviceHint: messages.tenders.filterServiceHint,
    specialtyLabels: {
      CONSTRUCTION_REPAIR: messages.tenders.specialtyConstructionRepair,
      TRANSPORT: messages.tenders.specialtyTransport,
      EQUIPMENT: messages.tenders.specialtyEquipment,
      DAILY_LABOR: messages.tenders.specialtyDailyLabor,
      MATERIAL_SUPPLIER: messages.tenders.specialtyMaterialSupplier,
    },
    serviceLabels: messages.tenders.serviceLabels,
    city: messages.tenders.city,
    allPlaces: messages.tenders.filterAllPlaces,
    budgetRange: messages.tenders.filterBudget,
    minimumBudget: messages.tenders.filterMinBudget,
    maximumBudget: messages.tenders.filterMaxBudget,
    currency: messages.tenders.filterCurrency,
    currencyHint: messages.tenders.filterCurrencyHint,
    anyCurrency: messages.tenders.filterAnyCurrency,
    currencyRequired: messages.tenders.errors.currencyRequired,
    deadlineBefore: messages.tenders.filterDeadline,
    deadlineHint: messages.tenders.filterDeadlineHint,
    invalidInput: messages.tenders.errors.invalidInput,
    invalidBudgetRange: messages.tenders.errors.invalidBudgetRange,
    summaryOne: messages.errors.summaryOne,
    summaryMany: messages.errors.summaryMany,
    title: messages.discovery.filters,
    clearAll: messages.discovery.clearAll,
    openFilters: messages.discovery.openFilters,
    closeFilters: messages.discovery.closeFilters,
    reset: messages.discovery.reset,
    saveSearch: messages.discovery.saveSearch,
    quickCity: messages.discovery.quickCity,
    dayChips: {
      7: messages.discovery.days7,
      30: messages.discovery.days30,
      90: messages.discovery.days90,
    },
  };
}

/** Only predicates the provider actually set become removable chips. */
function activeFiltersFor(
  searchParams: DiscoverySearchParams,
  messages: Messages,
  places: readonly GeorgianPlaceOption[],
): readonly ActiveFilter[] {
  const read = (key: string) => {
    const value = searchParams[key];
    return typeof value === "string" && value.trim() !== ""
      ? value.trim()
      : undefined;
  };

  const filters: ActiveFilter[] = [];
  const specialty = read("specialty");
  if (specialty !== undefined && isTenderSpecialty(specialty)) {
    filters.push({
      key: "specialty",
      label: specialtyLabel(specialty, messages),
    });
  }
  const serviceCode = read("serviceCode");
  if (serviceCode !== undefined && isTenderServiceCode(serviceCode)) {
    filters.push({
      key: "serviceCode",
      label: serviceLabel(serviceCode, messages),
    });
  }
  const city = read("city");
  if (city !== undefined)
    filters.push({
      key: "city",
      label: places.find((place) => place.nameEn === city)?.label ?? city,
    });

  const currency = read("currency");
  if (currency === "GEL" || currency === "USD")
    filters.push({ key: "currency", label: currency });
  const minBudget = read("minBudget");
  const maxBudget = read("maxBudget");
  if (minBudget !== undefined) {
    filters.push({
      key: "minBudget",
      label: `${messages.tenders.filterMinBudget}: ${minBudget}${currency ? ` ${currency}` : ""}`,
    });
  }
  if (maxBudget !== undefined) {
    filters.push({
      key: "maxBudget",
      label: `${messages.tenders.filterMaxBudget}: ${maxBudget}${currency ? ` ${currency}` : ""}`,
    });
  }
  const deadlineBefore = read("deadlineBefore");
  if (deadlineBefore !== undefined) {
    filters.push({
      key: "deadlineBefore",
      label: `${messages.tenders.filterDeadline}: ${deadlineBefore}`,
    });
  }
  return filters;
}

export default async function ProviderTenderListPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<DiscoverySearchParams>;
}>) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);

  const pathname = `/${locale}/provider/tenders`;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string") query.set(key, value);
  }

  const [overview, places] = await Promise.all([
    getMarketplaceOverview(),
    listGeorgianPlaces(locale),
  ]);

  return (
    <>
      <section className="band discovery-band">
        <div className="motif grid-bg grid-bg--fade-b" />
        <div className="band-inner">
          <h1>{messages.tenders.providerListTitle}</h1>
          <p className="lede">
            {messages.discovery.subline.replace(
              "{count}",
              new Intl.NumberFormat(locale as Locale).format(
                overview.openTenders,
              ),
            )}
          </p>
          {/*
            The band search is a plain GET into the same filter contract the
            rail writes, so a keyword search and an applied filter produce the
            same shareable URL.
          */}
          <form action={pathname} className="search-bar discovery-search">
            <BrandIcon name="magnify" opacity={0.5} size={18} />
            <label className="skip-link" htmlFor="discovery-city">
              {messages.tenders.filterCity}
            </label>
            <input
              className="city"
              defaultValue={query.get("city") ?? ""}
              id="discovery-city"
              name="city"
              placeholder={messages.discovery.cityPlaceholder}
              type="search"
            />
            <button type="submit">{messages.discovery.search}</button>
          </form>
        </div>
      </section>

      <div className="band band-grey">
        <div className="band-inner discovery-layout">
          <DiscoveryFilters
            copy={filterCopyFor(messages)}
            places={places}
            key={query.toString()}
          />
          <div>
            <ActiveFilterChips
              filters={activeFiltersFor(filters, messages, places)}
              messages={messages}
              pathname={pathname}
              searchParams={query}
            />
            <DiscoveryList
              locale={locale}
              messages={messages}
              pathname={pathname}
              searchParams={filters}
            />
          </div>
        </div>
      </div>
    </>
  );
}
