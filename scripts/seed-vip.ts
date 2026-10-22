import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { ServerEnv } from "../src/config/env";
import type { VipSpecialty } from "../src/modules/vip/domain/partner";
import type { TenderServiceCode } from "../src/modules/tenders/domain/service-taxonomy";
import type { ManageAgreementCommand } from "../src/modules/agreements/application/manage-agreement";
import { Prisma } from "../src/generated/prisma/client";

// Idempotent demo data for the VIP Lounge. Every account, membership, tender,
// bid and agreement is found by a stable key before it is created, so the
// script can be run again without failing or duplicating anything.

// Used only when DEMO_SEED_PASSWORD is unset, and only on the local dev
// database. It is printed at the end of the run.
const LOCAL_PASSWORD = "vip-lounge-local-2026";
const LOCAL_DATABASE_NAME = "tender_dev";
const DEMO_DATABASE_NAME = "tender_demo";
const ACCOUNT_DOMAIN = "vip.tender.test";
const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_TENDER_DAYS = 14;
// Member-since dates are counted back from a fixed day, not from the run time,
// so a re-run writes the same timestamps.
// Noon in Tbilisi (08:00 UTC), so the profile shows a plausible date.
const SEED_ANCHOR_MS = Date.UTC(2026, 9, 22, 8);
// VIP partners joined one to four years before the anchor; the clients and the
// standard accounts about a year before it.
const JOINED_DAYS_AGO: Readonly<Record<string, number>> = {
  "kartli-build": 1420,
  "mtkvari-steel": 1150,
  "colchis-logistics": 980,
  geolift: 1310,
  "iveria-roofing": 760,
  "saguramo-stone": 1080,
  "rioni-concrete": 520,
  "aragvi-electric": 1240,
  "vip-client-1": 380,
  "vip-client-2": 350,
  "standard-provider-1": 365,
  "standard-provider-2": 340,
  "standard-client": 330,
  "history-client": 395,
};
const HISTORY_TENDER_DAYS = 2;
const TENDER_CITY = "Tbilisi";
const TENDER_ADDRESS = "12 Rustaveli Avenue, Tbilisi";

type Role = "PROVIDER" | "CLIENT";

type AccountSeed = Readonly<{
  key: string;
  name: string;
  role: Role;
  city: string;
  phone: string;
  accountKind: "PERSON" | "COMPANY";
  activityDescription: string;
  // Provider categories. Onboarding only grants CONSTRUCTION_REPAIR, so the
  // seed writes the category directly to ProviderProfile.specialties.
  specialty?: VipSpecialty;
  vip: boolean;
  logoPath?: string;
  serviceLabel?: string;
  description?: string;
  translations?: Translations;
}>;

// Georgian and Russian Lounge copy for one partner. Drafted for the demo and
// flagged for native-speaker review (spec section 8).
type Translations = Readonly<
  Record<"ka" | "ru", Readonly<{ serviceLabel: string; description: string }>>
>;

type PartnerSeed = Readonly<{
  key: string;
  name: string;
  city: string;
  specialty: VipSpecialty;
  serviceLabel: string;
  description: string;
  translations: Translations;
  logoFile: string;
  // The tender service a history job for this partner is posted under.
  service: TenderServiceCode;
  phone: string;
  // Completed history engagements to seed, between 2 and 5.
  historyJobs: number;
}>;

// Names, cities, categories, service labels and descriptions come from the
// VIP Lounge handoff (reference/partners-data.js). The partners are fictional.
const PARTNERS: readonly PartnerSeed[] = [
  {
    key: "kartli-build",
    name: "Kartli Build",
    city: "Tbilisi",
    specialty: "CONSTRUCTION_REPAIR",
    serviceLabel: "General contractor",
    description:
      "Residential and commercial builds from foundation to handover, with in-house site supervision.",
    translations: {
      ka: {
        serviceLabel: "გენერალური კონტრაქტორი",
        description:
          "საცხოვრებელი და კომერციული შენობები საძირკვლიდან გადაცემამდე, საკუთარი სამშენებლო ზედამხედველობით.",
      },
      ru: {
        serviceLabel: "Генеральный подрядчик",
        description:
          "Жилые и коммерческие объекты от фундамента до сдачи, с собственным техническим надзором на площадке.",
      },
    },
    logoFile: "kartli-build_icon.svg",
    service: "GENERAL_CONSTRUCTION",
    phone: "+995555620001",
    historyJobs: 3,
  },
  {
    key: "mtkvari-steel",
    name: "Mtkvari Steel",
    city: "Rustavi",
    specialty: "MATERIAL_SUPPLIER",
    serviceLabel: "Metal structures",
    description:
      "Structural steel, beams and custom metal fabrication delivered to site.",
    translations: {
      ka: {
        serviceLabel: "ლითონის კონსტრუქციები",
        description:
          "კონსტრუქციული ფოლადი, ძელები და ლითონის სპეციალური დამზადება მიწოდებით ობიექტზე.",
      },
      ru: {
        serviceLabel: "Металлоконструкции",
        description:
          "Строительная сталь, балки и индивидуальное изготовление металлоконструкций с доставкой на объект.",
      },
    },
    logoFile: "mtkvari-steel_icon.svg",
    service: "METAL_PROFILES",
    phone: "+995555620002",
    historyJobs: 5,
  },
  {
    key: "colchis-logistics",
    name: "Colchis Logistics",
    city: "Kutaisi",
    specialty: "TRANSPORT",
    serviceLabel: "Transport & delivery",
    description:
      "Flatbed and heavy-load transport for materials across western Georgia.",
    translations: {
      ka: {
        serviceLabel: "ტრანსპორტი და მიწოდება",
        description:
          "პლატფორმიანი და მძიმე ტვირთის გადაზიდვა მასალებისთვის დასავლეთ საქართველოში.",
      },
      ru: {
        serviceLabel: "Транспорт и доставка",
        description:
          "Перевозка материалов бортовыми и тяжеловесными машинами по западной Грузии.",
      },
    },
    logoFile: "colchis-logistics_icon.svg",
    service: "GENERAL_CARGO_TRANSPORT",
    phone: "+995555620003",
    historyJobs: 2,
  },
  {
    key: "geolift",
    name: "GeoLift",
    city: "Tbilisi",
    specialty: "EQUIPMENT",
    serviceLabel: "Cranes & machinery",
    description:
      "Tower and mobile cranes with certified operators, rented by the day or month.",
    translations: {
      ka: {
        serviceLabel: "ამწეები და მანქანები",
        description:
          "კოშკური და მობილური ამწეები სერტიფიცირებული ოპერატორებით, ქირავდება დღით ან თვით.",
      },
      ru: {
        serviceLabel: "Краны и техника",
        description:
          "Башенные и мобильные краны с сертифицированными операторами, аренда посуточно или помесячно.",
      },
    },
    logoFile: "geolift_icon.svg",
    service: "MOBILE_CRANE",
    phone: "+995555620004",
    historyJobs: 4,
  },
  {
    key: "iveria-roofing",
    name: "Iveria Roofing",
    city: "Batumi",
    specialty: "CONSTRUCTION_REPAIR",
    serviceLabel: "Roofing & facades",
    description:
      "Roof installation, waterproofing and facade cladding for new and old buildings.",
    translations: {
      ka: {
        serviceLabel: "სახურავები და ფასადები",
        description:
          "სახურავების მონტაჟი, ჰიდროიზოლაცია და ფასადის მოპირკეთება ახალ და ძველ შენობებზე.",
      },
      ru: {
        serviceLabel: "Кровля и фасады",
        description:
          "Монтаж кровли, гидроизоляция и облицовка фасадов новых и старых зданий.",
      },
    },
    logoFile: "iveria-roofing_icon.svg",
    service: "ROOFING",
    phone: "+995555620005",
    historyJobs: 3,
  },
  {
    key: "saguramo-stone",
    name: "Saguramo Stone",
    city: "Mtskheta",
    specialty: "MATERIAL_SUPPLIER",
    serviceLabel: "Materials & supply",
    description:
      "Natural stone, gravel and aggregates supplied from our own quarry.",
    translations: {
      ka: {
        serviceLabel: "მასალები და მიწოდება",
        description:
          "ბუნებრივი ქვა, ხრეში და შემავსებლები საკუთარი კარიერიდან.",
      },
      ru: {
        serviceLabel: "Материалы и поставки",
        description:
          "Природный камень, гравий и заполнители из собственного карьера.",
      },
    },
    logoFile: "saguramo-stone_icon.svg",
    service: "SAND_GRAVEL_INERT",
    phone: "+995555620006",
    historyJobs: 5,
  },
  {
    key: "rioni-concrete",
    name: "Rioni Concrete",
    city: "Kutaisi",
    specialty: "MATERIAL_SUPPLIER",
    serviceLabel: "Ready-mix concrete",
    description:
      "Ready-mix concrete with pump trucks, delivered on schedule to your pour.",
    translations: {
      ka: {
        serviceLabel: "ბეტონის მიწოდება",
        description:
          "ტუმბო მანქანებით მიწოდებული ბეტონი, გრაფიკის მიხედვით თქვენს დასხმამდე.",
      },
      ru: {
        serviceLabel: "Товарный бетон",
        description:
          "Товарный бетон с автобетононасосами, доставленный точно к сроку заливки.",
      },
    },
    logoFile: "rioni-concrete_icon.svg",
    service: "READY_MIX_CONCRETE",
    phone: "+995555620007",
    historyJobs: 2,
  },
  {
    key: "aragvi-electric",
    name: "Aragvi Electric",
    city: "Tbilisi",
    specialty: "CONSTRUCTION_REPAIR",
    serviceLabel: "Electrical works",
    description:
      "Electrical installation, panels and lighting for residential and commercial sites.",
    translations: {
      ka: {
        serviceLabel: "ელექტრომონტაჟი",
        description:
          "ელექტრომონტაჟი, ელექტრო ფარები და განათება საცხოვრებელ და კომერციულ ობიექტებზე.",
      },
      ru: {
        serviceLabel: "Электромонтажные работы",
        description:
          "Электромонтаж, электрощиты и освещение на жилых и коммерческих объектах.",
      },
    },
    logoFile: "aragvi-electric_icon.svg",
    service: "ELECTRICAL_INSTALLATION",
    phone: "+995555620008",
    historyJobs: 4,
  },
];

const VIP_CLIENTS: readonly AccountSeed[] = [
  {
    key: "vip-client-1",
    name: "Caucasus Development Group",
    role: "CLIENT",
    city: "Tbilisi",
    phone: "+995555620021",
    accountKind: "COMPANY",
    activityDescription: "Commercial developer with VIP status on Tendermarket",
    vip: true,
    logoPath: "/vip/logos/vip-client-1_icon.svg",
  },
  {
    key: "vip-client-2",
    name: "Mtatsminda Properties",
    role: "CLIENT",
    city: "Tbilisi",
    phone: "+995555620022",
    accountKind: "COMPANY",
    activityDescription:
      "Office property owner with VIP status on Tendermarket",
    vip: true,
    logoPath: "/vip/logos/vip-client-2_icon.svg",
  },
];

const STANDARD_ACCOUNTS: readonly AccountSeed[] = [
  {
    key: "standard-provider-1",
    name: "Vera Masonry Crew",
    role: "PROVIDER",
    city: "Tbilisi",
    phone: "+995555620011",
    accountKind: "COMPANY",
    activityDescription: "Standard masonry and finishing crew",
    specialty: "CONSTRUCTION_REPAIR",
    vip: false,
  },
  {
    key: "standard-provider-2",
    name: "Sololaki Plumbing and Heating",
    role: "PROVIDER",
    city: "Tbilisi",
    phone: "+995555620012",
    accountKind: "COMPANY",
    activityDescription: "Standard plumbing and heating contractor",
    specialty: "CONSTRUCTION_REPAIR",
    vip: false,
  },
  {
    key: "standard-client",
    name: "Vake Residential Owners",
    role: "CLIENT",
    city: "Tbilisi",
    phone: "+995555620023",
    accountKind: "PERSON",
    activityDescription: "Residential owner, standard account",
    vip: false,
  },
  {
    key: "history-client",
    name: "Saburtalo Homes",
    role: "CLIENT",
    city: "Tbilisi",
    phone: "+995555620024",
    accountKind: "COMPANY",
    activityDescription: "Client account that owns the completed history jobs",
    vip: false,
  },
];

const PARTNER_ACCOUNTS: readonly AccountSeed[] = PARTNERS.map((partner) => ({
  key: partner.key,
  name: partner.name,
  role: "PROVIDER",
  city: partner.city,
  phone: partner.phone,
  accountKind: "COMPANY",
  activityDescription: partner.description,
  specialty: partner.specialty,
  vip: true,
  logoPath: `/vip/logos/${partner.logoFile}`,
  serviceLabel: partner.serviceLabel,
  description: partner.description,
  translations: partner.translations,
}));

const ALL_ACCOUNTS: readonly AccountSeed[] = [
  ...PARTNER_ACCOUNTS,
  ...VIP_CLIENTS,
  ...STANDARD_ACCOUNTS,
];

// English comes from the handoff. Georgian and Russian come from the partner's
// translations; a missing translation falls back to English.
function localizedCopy(
  english: string,
  translations: Translations | undefined,
  field: "serviceLabel" | "description",
): Readonly<Record<string, string>> {
  return {
    en: english,
    ka: translations?.ka[field] ?? english,
    ru: translations?.ru[field] ?? english,
  };
}

function accountEmail(key: string): string {
  return `${key}@${ACCOUNT_DOMAIN}`;
}

// The live VIP client 1 tender. A standard provider is cheapest on purpose,
// so the demo shows VIP offers first and the "Lowest price" tag below them.
const LIVE_BIDS: readonly Readonly<{
  providerKey: string;
  amountMinorUnits: number;
}>[] = [
  { providerKey: "standard-provider-1", amountMinorUnits: 402_000 },
  { providerKey: "standard-provider-2", amountMinorUnits: 419_000 },
  { providerKey: "aragvi-electric", amountMinorUnits: 425_000 },
  { providerKey: "kartli-build", amountMinorUnits: 431_000 },
  { providerKey: "iveria-roofing", amountMinorUnits: 438_000 },
];

const CONDITIONS =
  "Materials and labour are included; scaffolding is excluded from this price.";

// Varied review scores, so the ratings differ between partners and jobs.
const SCORE_ROWS = [
  { quality: 5, deadline: 5, communication: 5, agreedPrice: 4 },
  { quality: 4, deadline: 5, communication: 4, agreedPrice: 4 },
  { quality: 5, deadline: 4, communication: 4, agreedPrice: 5 },
  { quality: 4, deadline: 3, communication: 4, agreedPrice: 4 },
  { quality: 3, deadline: 4, communication: 4, agreedPrice: 3 },
] as const;

type ResolvedPassword = Readonly<{
  password: string;
  // True only when the fixed local value is used; it is printed in that case.
  isLocalFallback: boolean;
}>;

function resolvePassword(env: ServerEnv): ResolvedPassword {
  const configured = process.env.DEMO_SEED_PASSWORD;
  if (env.NODE_ENV === "production") {
    if (configured === undefined || configured.length < 12) {
      throw new Error(
        "DEMO_SEED_PASSWORD must contain at least 12 random characters on the demo deployment",
      );
    }
    return { password: configured, isLocalFallback: false };
  }
  return configured !== undefined && configured.length >= 12
    ? { password: configured, isLocalFallback: false }
    : { password: LOCAL_PASSWORD, isLocalFallback: true };
}

// Local runs may only touch the dev database. The demo deployment keeps the
// same guards as seed-demo.ts: the tender_demo database and DEMO_SEED_CONFIRM.
function assertTargetDatabase(env: ServerEnv): string {
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.slice(1),
  );
  if (env.NODE_ENV === "production") {
    if (
      databaseName !== DEMO_DATABASE_NAME ||
      process.env.DEMO_SEED_CONFIRM !== databaseName
    ) {
      throw new Error(
        "Demo seeding requires the tender_demo database and DEMO_SEED_CONFIRM=tender_demo",
      );
    }
    return databaseName;
  }
  if (databaseName !== LOCAL_DATABASE_NAME) {
    throw new Error(
      `seed:vip runs only against the local dev database (${LOCAL_DATABASE_NAME}); found ${databaseName}`,
    );
  }
  return databaseName;
}

function assertLoungeTextLimits(partners: readonly PartnerSeed[]): void {
  for (const partner of partners) {
    if (partner.serviceLabel.length > 28) {
      throw new Error(`Service label too long: ${partner.serviceLabel}`);
    }
    if (partner.description.length > 120) {
      throw new Error(`Description too long: ${partner.key}`);
    }
    for (const locale of ["ka", "ru"] as const) {
      const copy = partner.translations[locale];
      if ([...copy.serviceLabel].length > 28) {
        throw new Error(`${locale} service label too long: ${partner.key}`);
      }
      if ([...copy.description].length > 120) {
        throw new Error(`${locale} description too long: ${partner.key}`);
      }
    }
  }
}

function reviewComment(serviceLabel: string, job: number): string {
  return `The ${serviceLabel.toLowerCase()} work on job ${job} was clear, well run and finished on the agreed terms.`;
}

async function main(): Promise<void> {
  const [
    { getServerEnv },
    { auth },
    { database },
    { completeOnboarding },
    { createTenderDraft },
    { updateTenderDraft },
    { syncTenderLocation },
    { publishTender },
    { startAccessCheckout },
    { confirmAccessCheckout },
    { submitBid },
    { runDeadlineSelection },
    { chooseWinningBid },
    { hasTenderEntitlement },
    { createManageAgreement },
    { prismaAgreementGateway },
    { publishReview },
    { SELECTION_WINDOW_DAYS },
    { listVipPartners },
  ] = await Promise.all([
    import("../src/config/env"),
    import("../src/modules/identity/infrastructure/auth"),
    import("../src/infrastructure/db/client"),
    import("../src/modules/profiles/application/complete-onboarding"),
    import("../src/modules/tenders/application/create-tender-draft"),
    import("../src/modules/tenders/application/update-tender-draft"),
    import("../src/modules/tenders/application/sync-tender-location"),
    import("../src/modules/tenders/application/publish-tender"),
    import("../src/modules/access/application/start-access-checkout"),
    import("../src/modules/access/application/confirm-access-checkout"),
    import("../src/modules/bidding/application/submit-bid"),
    import("../src/modules/bidding/application/run-deadline-selection"),
    import("../src/modules/bidding/application/choose-winning-bid"),
    import("../src/modules/access/application/has-tender-entitlement"),
    import("../src/modules/agreements/application/manage-agreement"),
    import("../src/modules/agreements/infrastructure/prisma-agreement-gateway"),
    import("../src/modules/reviews/application/publish-review"),
    import("../src/modules/bidding/domain/selection"),
    import("../src/modules/vip/application/list-vip-partners"),
  ]);

  const env = getServerEnv();
  const databaseName = assertTargetDatabase(env);
  const { password, isLocalFallback } = resolvePassword(env);
  assertLoungeTextLimits(PARTNERS);

  const manageAgreement = createManageAgreement({
    repository: prismaAgreementGateway,
    now: () => new Date(),
    ids: { next: randomUUID },
    selectionWindowDays: SELECTION_WINDOW_DAYS,
  });

  try {
    console.log(`Seeding VIP Lounge data into ${databaseName}.`);

    // ------------------------------------------------------------ Accounts
    const userIds = new Map<string, string>();

    async function ensureAccount(spec: AccountSeed): Promise<string> {
      const email = accountEmail(spec.key);
      const existing = await database.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing === null) {
        await auth.api.signUpEmail({
          body: {
            email,
            name: spec.name,
            idNumber: "01010101010",
            cityOrTown: spec.city,
            address: "12 Rustaveli Avenue, Tbilisi",
            password,
          },
        });
      }
      // The profile's "Member since" reads User.createdAt, so it is set here
      // on every run, to the account's fixed past join date.
      const joinedDaysAgo = JOINED_DAYS_AGO[spec.key];
      if (joinedDaysAgo === undefined) {
        throw new Error(`No join date for ${spec.key}`);
      }
      const user = await database.user.update({
        where: { email },
        data: {
          emailVerified: true,
          createdAt: new Date(SEED_ANCHOR_MS - joinedDaysAgo * DAY_MS),
        },
        select: { id: true },
      });
      const onboarded = await completeOnboarding(
        {
          intent: spec.role === "PROVIDER" ? "CONSTRUCTION_PROVIDER" : "CLIENT",
          accountKind: spec.accountKind,
          displayName: spec.name,
          phoneE164: spec.phone,
          countryCode: "GE",
          city: spec.city,
          activityDescription: spec.activityDescription,
          preferredLocale: "en",
          preferredCurrency: "GEL",
        },
        { id: user.id, emailVerified: true },
      );
      if (!onboarded.ok) {
        throw new Error(`Could not onboard ${spec.key}: ${onboarded.error}`);
      }
      if (spec.role === "PROVIDER" && spec.specialty !== undefined) {
        await database.providerProfile.upsert({
          where: { userId: user.id },
          create: {
            id: randomUUID(),
            userId: user.id,
            specialties: [spec.specialty],
          },
          update: { specialties: [spec.specialty] },
        });
      }
      return user.id;
    }

    for (const spec of ALL_ACCOUNTS) {
      userIds.set(spec.key, await ensureAccount(spec));
    }
    const idOf = (key: string): string => {
      const id = userIds.get(key);
      if (id === undefined) throw new Error(`Missing seeded account ${key}`);
      return id;
    };
    console.log(`Accounts ready: ${ALL_ACCOUNTS.length}.`);

    // --------------------------------------------------------- Memberships
    // Standard accounts never get a membership row. VIP clients have no
    // Lounge copy, so their service label and description stay null.
    for (const spec of ALL_ACCOUNTS.filter((account) => account.vip)) {
      const userId = idOf(spec.key);
      const fields = {
        active: true,
        logoPath: spec.logoPath ?? null,
        serviceLabel:
          spec.serviceLabel === undefined
            ? Prisma.DbNull
            : localizedCopy(
                spec.serviceLabel,
                spec.translations,
                "serviceLabel",
              ),
        description:
          spec.description === undefined
            ? Prisma.DbNull
            : localizedCopy(spec.description, spec.translations, "description"),
      };
      await database.vipMembership.upsert({
        where: { userId },
        create: { id: randomUUID(), userId, ...fields },
        update: fields,
      });
    }
    console.log(
      `Memberships ready: ${ALL_ACCOUNTS.filter((account) => account.vip).length}.`,
    );

    // ---------------------------------------------------- Tender helpers
    async function publishTenderNamed(
      input: Readonly<{
        owner: string;
        title: string;
        specialty: VipSpecialty;
        service: TenderServiceCode;
        shortDescription: string;
        budgetMinorUnits: number;
        deadline: Date;
      }>,
    ): Promise<string> {
      const actor = { id: input.owner };
      const draft = await createTenderDraft(
        {
          specialty: input.specialty,
          serviceCode: input.service,
          title: input.title,
        },
        actor,
      );
      if (!draft.ok) throw new Error(`Failed to draft "${input.title}"`);
      const updated = await updateTenderDraft(
        draft.value.id,
        {
          shortDescription: input.shortDescription,
          fullDescription: `${input.shortDescription}. Work is carried out to the scope below, on site in ${TENDER_CITY}.`,
          scopeOfWork:
            "Materials, labour and site supervision as described in the conditions.",
          budgetMinorUnits: input.budgetMinorUnits,
          currency: "GEL",
          deadline: input.deadline,
          conditions: CONDITIONS,
        },
        actor,
      );
      if (!updated.ok) throw new Error(`Failed to complete "${input.title}"`);
      const located = await syncTenderLocation(
        draft.value.id,
        {
          mode: "ADDRESS",
          city: TENDER_CITY,
          district: null,
          addressLine: TENDER_ADDRESS,
        },
        actor,
      );
      if (!located.ok) throw new Error(`Failed to locate "${input.title}"`);
      const published = await publishTender(draft.value.id, actor);
      if (!published.ok) throw new Error(`Failed to publish "${input.title}"`);
      return draft.value.id;
    }

    // Makes sure the demo tender is open for offers, whatever state a previous
    // run left it in. A PUBLISHED tender keeps its id and bids, and only gets a
    // fresh deadline when the old one has passed. Any other state is removed
    // (its bids go with it) and published again; the bids are then re-added by
    // ensureBid, and the provider entitlements survive the delete.
    async function ensureOpenTender(
      input: Parameters<typeof publishTenderNamed>[0],
    ): Promise<string> {
      const existing = await database.tender.findFirst({
        where: { ownerId: input.owner, title: input.title },
        select: { id: true, status: true, deadline: true },
      });
      if (existing !== null) {
        const isOpen =
          existing.status === "PUBLISHED" &&
          existing.deadline !== null &&
          existing.deadline.getTime() > Date.now();
        if (isOpen) return existing.id;
        if (existing.status === "PUBLISHED") {
          await database.tender.update({
            where: { id: existing.id },
            data: { deadline: input.deadline },
          });
          return existing.id;
        }
        await database.tender.delete({ where: { id: existing.id } });
      }
      return publishTenderNamed(input);
    }

    // Idempotent per (provider, tender): an existing bid is kept, and access
    // is bought only when the provider does not already hold it.
    async function ensureBid(
      tenderId: string,
      providerId: string,
      amountMinorUnits: number,
      conditions: string,
    ): Promise<Readonly<{ bidId: string; qualifyingSubmittedAt: Date }>> {
      const existing = await database.bid.findUnique({
        where: { tenderId_providerId: { tenderId, providerId } },
        select: { id: true, qualifyingSubmittedAt: true },
      });
      if (existing !== null) {
        return {
          bidId: existing.id,
          qualifyingSubmittedAt: existing.qualifyingSubmittedAt,
        };
      }
      if (!(await hasTenderEntitlement(providerId, tenderId, new Date()))) {
        const checkout = await startAccessCheckout(
          { product: "SINGLE_TENDER", tenderId },
          { id: providerId },
        );
        if (!checkout.ok) {
          throw new Error(`Failed to start checkout: ${checkout.error}`);
        }
        const confirmed = await confirmAccessCheckout(
          checkout.value.checkoutId,
          { id: providerId },
        );
        if (!confirmed.ok) {
          throw new Error(`Failed to confirm checkout: ${confirmed.error}`);
        }
      }
      const bid = await submitBid(
        tenderId,
        { amountMinorUnits, conditions },
        { id: providerId },
      );
      if (!bid.ok) throw new Error(`Failed to submit bid: ${bid.error}`);
      return {
        bidId: bid.value.id,
        qualifyingSubmittedAt: bid.value.qualifyingSubmittedAt,
      };
    }

    // ------------------------------------------------------- Live tenders
    const vipClientOne = idOf("vip-client-1");
    const vipClientTwo = idOf("vip-client-2");
    const standardClient = idOf("standard-client");
    const historyClient = idOf("history-client");

    const liveDeadline = new Date(Date.now() + LIVE_TENDER_DAYS * DAY_MS);
    const liveTenderId = await ensureOpenTender({
      owner: vipClientOne,
      title: "Two-storey warehouse extension, Tbilisi",
      specialty: "CONSTRUCTION_REPAIR",
      service: "GENERAL_CONSTRUCTION",
      shortDescription: "Extend a warehouse with a new two-storey block",
      budgetMinorUnits: 480_000,
      deadline: liveDeadline,
    });
    const officeTenderId = await ensureOpenTender({
      owner: vipClientTwo,
      title: "Office fit-out on the third floor, Mtatsminda",
      specialty: "CONSTRUCTION_REPAIR",
      service: "RENOVATION_REMODELING",
      shortDescription: "Fit out a third-floor office for 20 desks",
      budgetMinorUnits: 320_000,
      deadline: liveDeadline,
    });
    const kitchenTenderId = await ensureOpenTender({
      owner: standardClient,
      title: "Kitchen and bathroom refit, Vake flat",
      specialty: "CONSTRUCTION_REPAIR",
      service: "RENOVATION_REMODELING",
      shortDescription: "Refit a kitchen and bathroom in a two-bedroom flat",
      budgetMinorUnits: 140_000,
      deadline: liveDeadline,
    });

    // The home hero is the open tender with the newest publication time. The
    // warehouse tender must be that one, so its publication time is set after
    // every ensureOpenTender call, on every run. The other two are older.
    const publishedNow = Date.now();
    for (const [tenderId, minutesAgo] of [
      [liveTenderId, 0],
      [officeTenderId, 60],
      [kitchenTenderId, 120],
    ] as const) {
      await database.tender.update({
        where: { id: tenderId },
        data: { publishedAt: new Date(publishedNow - minutesAgo * 60_000) },
      });
    }

    for (const bid of LIVE_BIDS) {
      await ensureBid(
        liveTenderId,
        idOf(bid.providerKey),
        bid.amountMinorUnits,
        CONDITIONS,
      );
    }
    console.log(
      `Open tenders ready, with ${LIVE_BIDS.length} offers on the VIP client 1 tender.`,
    );

    // ------------------------------------------------------------ History
    // Each completed job is a real tender that the history client awards to
    // the partner, carried through the same agreement path a client uses.
    async function driveAgreementToCompleted(
      agreementId: string,
      clientId: string,
      providerId: string,
    ): Promise<void> {
      for (let step = 0; step < 6; step += 1) {
        const agreement = await database.agreement.findUniqueOrThrow({
          where: { id: agreementId },
          select: { status: true },
        });
        const next = nextAgreementCommand(agreement.status);
        if (next === null) return;
        for (const actorId of [clientId, providerId]) {
          const result = await manageAgreement(agreementId, next, {
            id: actorId,
          });
          if (!result.ok) {
            throw new Error(
              `Agreement step ${next.type} failed: ${result.error}`,
            );
          }
        }
      }
      throw new Error(`Agreement ${agreementId} did not reach COMPLETED`);
    }

    async function ensureHistoryJob(
      input: Readonly<{
        partner: PartnerSeed;
        providerId: string;
        job: number;
        partnerIndex: number;
      }>,
    ): Promise<void> {
      const { partner, providerId, job } = input;
      const title = `Completed job ${job}: ${partner.name}`;

      let agreement = await database.agreement.findFirst({
        where: { tenderTitle: title, providerId, clientId: historyClient },
        select: { id: true },
      });
      if (agreement === null) {
        // A tender left behind by an interrupted run has no agreement, so it is
        // removed and the job is created again from the start.
        await database.tender.deleteMany({
          where: { ownerId: historyClient, title },
        });
        const tenderId = await publishTenderNamed({
          owner: historyClient,
          title,
          specialty: partner.specialty,
          service: partner.service,
          shortDescription: `Completed job: ${partner.serviceLabel.toLowerCase()}`,
          budgetMinorUnits: 350_000,
          deadline: new Date(Date.now() + HISTORY_TENDER_DAYS * DAY_MS),
        });
        const amount = 250_000 + job * 1_300 + input.partnerIndex * 700;
        const bid = await ensureBid(tenderId, providerId, amount, CONDITIONS);
        // Fixture-only step, the same pattern as seed-phase-03: the bid was
        // submitted through the real use case while the deadline was open.
        // Moving the deadline just after that bid makes the tender due, so the
        // real deadline sweep and the client's real choice can run.
        const dueAt = new Date(bid.qualifyingSubmittedAt.getTime() + 1_000);
        await database.tender.update({
          where: { id: tenderId },
          data: { deadline: dueAt },
        });
        const wait = dueAt.getTime() - Date.now();
        if (wait > 0)
          await new Promise((resolve) => setTimeout(resolve, wait + 50));

        const swept = await runDeadlineSelection(tenderId);
        if (!swept.ok || swept.value.outcome !== "AWAITING_SELECTION") {
          throw new Error(`History job "${title}" did not open for selection`);
        }
        const chosen = await chooseWinningBid(tenderId, bid.bidId, {
          id: historyClient,
        });
        if (!chosen.ok) {
          throw new Error(
            `History job "${title}" was not awarded: ${chosen.error}`,
          );
        }
        agreement = { id: chosen.value.agreementId };
      }

      await driveAgreementToCompleted(agreement.id, historyClient, providerId);

      const existingReview = await database.review.findFirst({
        where: { agreementId: agreement.id, reviewerId: historyClient },
        select: { id: true },
      });
      if (existingReview === null) {
        const scores =
          SCORE_ROWS[(input.partnerIndex + job) % SCORE_ROWS.length];
        if (scores === undefined) throw new Error("No score row");
        const published = await publishReview(
          agreement.id,
          {
            ...scores,
            comment: reviewComment(partner.serviceLabel, job),
          },
          { id: historyClient },
        );
        if (!published.ok) {
          throw new Error(`Could not publish review: ${published.error}`);
        }
      }
    }

    let engagements = 0;
    for (const [partnerIndex, partner] of PARTNERS.entries()) {
      for (let job = 1; job <= partner.historyJobs; job += 1) {
        await ensureHistoryJob({
          partner,
          providerId: idOf(partner.key),
          job,
          partnerIndex,
        });
        engagements += 1;
      }
    }
    console.log(
      `History ready: ${engagements} completed engagements with reviews.`,
    );

    // ------------------------------------------------------------ Summary
    const lounge = await listVipPartners({
      locale: "en",
      now: new Date(),
    });
    const liveBids = await database.bid.findMany({
      where: { tenderId: liveTenderId },
      orderBy: { amountMinorUnits: "asc" },
      select: {
        amountMinorUnits: true,
        provider: {
          select: { email: true, profile: { select: { displayName: true } } },
        },
      },
    });
    console.log("");
    console.log(`Lounge partners (eligible): ${lounge.length}`);
    for (const partner of lounge) {
      console.log(
        `  ${partner.name.padEnd(20)} rating ${partner.rating ?? "-"}  completed ${partner.completed}`,
      );
    }
    console.log("");
    console.log(
      `VIP client 1 tender offers: ${liveBids.length} (lowest first)`,
    );
    for (const bid of liveBids) {
      const standard = bid.provider.email.startsWith("standard-provider");
      console.log(
        `  ${(bid.provider.profile?.displayName ?? bid.provider.email).padEnd(32)} ${String(bid.amountMinorUnits).padStart(8)}  ${standard ? "standard" : "VIP"}`,
      );
    }

    console.log("");
    if (isLocalFallback) {
      console.log(`Accounts (local fallback password for all: ${password})`);
    } else {
      console.log(
        "Accounts (password: value of DEMO_SEED_PASSWORD, not printed)",
      );
    }
    for (const spec of ALL_ACCOUNTS) {
      const role = spec.role === "PROVIDER" ? "Provider" : "Client";
      console.log(
        `  ${accountEmail(spec.key).padEnd(40)} ${role.padEnd(9)} ${spec.vip ? "VIP" : "standard"}`,
      );
    }
  } finally {
    await database.$disconnect();
  }
}

function nextAgreementCommand(status: string): ManageAgreementCommand | null {
  switch (status) {
    case "PENDING_CONFIRMATION":
      return { type: "CONFIRM" };
    case "AGREED":
      return { type: "ACKNOWLEDGE_START" };
    case "IN_PROGRESS":
      return { type: "CONFIRM_COMPLETION" };
    case "COMPLETED":
      return null;
    default:
      throw new Error(
        `Agreement is in ${status}, which the seed cannot complete`,
      );
  }
}

await main();
