import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import {
  DiscoveryFilters,
  type DiscoveryFilterCopy,
} from "@/src/modules/tenders/ui/discovery-filters";
import { DiscoveryList } from "@/src/modules/tenders/ui/discovery-list";
import type { DiscoverySearchParams } from "@/src/modules/tenders/ui/discovery-query";

export default async function ProviderTenderListPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<DiscoverySearchParams>;
}>) {
  const [{ locale }, filters, requestHeaders] = await Promise.all([
    params,
    searchParams,
    headers(),
  ]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireCapability(requestHeaders, "PROVIDER");
  if (!access.ok) {
    if (access.error === "UNAUTHENTICATED") {
      redirect(`/${locale}/login`);
    }
    return (
      <WorkspaceDenied
        error={access.error}
        locale={locale}
        messages={messages}
      />
    );
  }

  const filterCopy: DiscoveryFilterCopy = {
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
    city: messages.tenders.filterCity,
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
  };

  return (
    <IdentityShell title={messages.tenders.providerListTitle}>
      <DiscoveryFilters key={JSON.stringify(filters)} copy={filterCopy} />
      <DiscoveryList
        locale={locale}
        messages={messages}
        searchParams={filters}
      />
    </IdentityShell>
  );
}
