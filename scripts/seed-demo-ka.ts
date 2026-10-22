import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { ServerEnv } from "../src/config/env";
import type { VipSpecialty } from "../src/modules/vip/domain/partner";
import type { TenderServiceCode } from "../src/modules/tenders/domain/service-taxonomy";
import type { ManageAgreementCommand } from "../src/modules/agreements/application/manage-agreement";
import { Prisma } from "../src/generated/prisma/client";

// Georgian-language demo data that walks through every feature: open tenders
// with VIP-first offers, a tender waiting for the client's choice, agreements
// in each state, a completed job awaiting a review, a draft, a cancelled
// tender, the VIP Lounge with rated partners, notifications and moderation.
//
// Every scenario is found by its owner and title before it is created. One
// that is already in the expected state is kept; one that drifted (an
// agreement that expired, a deadline that passed) is rebuilt, so the script
// can be run again on the morning of a demo.

// Used only when DEMO_SEED_PASSWORD is unset, and only on the local dev
// database. It is printed at the end of the run.
const LOCAL_PASSWORD = "tender-demo-ka-2026";
const LOCAL_DATABASE_NAME = "tender_dev";
const DEMO_DATABASE_NAME = "tender_demo";
const ACCOUNT_DOMAIN = "tender.test";
const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_TENDER_DAYS = 14;
// Join dates are counted back from a fixed day, so a re-run writes the same
// "Member since" timestamps.
const SEED_ANCHOR_MS = Date.UTC(2026, 9, 22, 8);

type Role = "PROVIDER" | "CLIENT";

type Translations = Readonly<
  Record<"ka" | "ru", Readonly<{ serviceLabel: string; description: string }>>
>;

type AccountSeed = Readonly<{
  key: string;
  email: string;
  name: string;
  role: Role;
  city: string;
  phone: string;
  accountKind: "PERSON" | "COMPANY";
  activityDescription: string;
  joinedDaysAgo: number;
  specialty?: VipSpecialty;
  vip: boolean;
  logoPath?: string;
  serviceLabel?: string;
  description?: string;
  translations?: Translations;
  admin?: boolean;
}>;

type PartnerSeed = Readonly<{
  key: string;
  email: string;
  name: string;
  city: string;
  specialty: VipSpecialty;
  service: TenderServiceCode;
  serviceLabel: string;
  description: string;
  translations: Translations;
  logoFile: string;
  phone: string;
  joinedDaysAgo: number;
  // Completed jobs, each awarded by the history client and reviewed.
  historyJobs: readonly string[];
}>;

// The same fictional partners as seed-vip.ts, under Georgian names. Lounge
// copy keeps the English fallback the eligibility rule reads.
const PARTNERS: readonly PartnerSeed[] = [
  {
    key: "kartli-build",
    email: `provider@${ACCOUNT_DOMAIN}`,
    name: "ქართლი ბილდი",
    city: "თბილისი",
    specialty: "CONSTRUCTION_REPAIR",
    service: "GENERAL_CONSTRUCTION",
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
    phone: "+995599710001",
    joinedDaysAgo: 1420,
    historyJobs: [
      "სამსართულიანი საცხოვრებელი სახლის კარკასი, დიღომი",
      "კაფის ინტერიერის რეკონსტრუქცია, ძველი თბილისი",
      "სკოლის სპორტული დარბაზის რემონტი, გლდანი",
    ],
  },
  {
    key: "mtkvari-steel",
    email: `mtkvari@${ACCOUNT_DOMAIN}`,
    name: "მტკვარი სტილი",
    city: "რუსთავი",
    specialty: "MATERIAL_SUPPLIER",
    service: "METAL_PROFILES",
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
    phone: "+995599710002",
    joinedDaysAgo: 1150,
    historyJobs: [
      "ლითონის კონსტრუქციები სასაწყობე ფარდულისთვის",
      "არმატურის მიწოდება საძირკვლისთვის, 12 ტონა",
      "ფოლადის კოჭები ავტოფარეხის გადახურვისთვის",
      "ლითონის კიბის დამზადება და მონტაჟი",
    ],
  },
  {
    key: "colchis-logistics",
    email: `colchis@${ACCOUNT_DOMAIN}`,
    name: "კოლხეთი ლოჯისტიკი",
    city: "ქუთაისი",
    specialty: "TRANSPORT",
    service: "GENERAL_CARGO_TRANSPORT",
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
    phone: "+995599710003",
    joinedDaysAgo: 980,
    historyJobs: [
      "სამშენებლო მასალის გადაზიდვა ქუთაისიდან ბათუმში",
      "ოფისის ავეჯის გადატანა ახალ შენობაში",
    ],
  },
  {
    key: "geolift",
    email: `geolift@${ACCOUNT_DOMAIN}`,
    name: "ჯეოლიფტი",
    city: "თბილისი",
    specialty: "EQUIPMENT",
    service: "MOBILE_CRANE",
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
    phone: "+995599710004",
    joinedDaysAgo: 1310,
    historyJobs: [
      "ავტოამწე სახურავის კონსტრუქციის ასაწევად",
      "ავტოამწის ქირაობა სამი დღით, ვაკე",
      "კოშკური ამწე ერთი თვით, ისანი",
      "ამწე-მანიპულატორი ბლოკების ჩამოსატვირთად",
    ],
  },
  {
    key: "iveria-roofing",
    email: `iveria@${ACCOUNT_DOMAIN}`,
    name: "ივერია რუფინგი",
    city: "ბათუმი",
    specialty: "CONSTRUCTION_REPAIR",
    service: "ROOFING",
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
    phone: "+995599710005",
    joinedDaysAgo: 760,
    historyJobs: [
      "ბრტყელი სახურავის ჰიდროიზოლაცია, ბათუმი",
      "კრამიტის სახურავის სრული შეცვლა",
      "სავაჭრო ცენტრის ფასადის მოპირკეთება",
    ],
  },
  {
    key: "saguramo-stone",
    email: `saguramo@${ACCOUNT_DOMAIN}`,
    name: "საგურამო სტოუნი",
    city: "მცხეთა",
    specialty: "MATERIAL_SUPPLIER",
    service: "SAND_GRAVEL_INERT",
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
    phone: "+995599710006",
    joinedDaysAgo: 1080,
    historyJobs: [
      "ხრეშის მიწოდება ეზოს მოსაწყობად, 30 კუბი",
      "ბუნებრივი ქვა სახლის ფასადისთვის",
      "ქვიშის მიწოდება სამშენებლო ობიექტზე",
      "დეკორატიული ქვა ბაღის ბილიკებისთვის",
      "ღორღის მიწოდება შიდა გზის საფარისთვის",
    ],
  },
  {
    key: "rioni-concrete",
    email: `rioni@${ACCOUNT_DOMAIN}`,
    name: "რიონი ბეტონი",
    city: "ქუთაისი",
    specialty: "MATERIAL_SUPPLIER",
    service: "READY_MIX_CONCRETE",
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
    phone: "+995599710007",
    joinedDaysAgo: 520,
    historyJobs: [
      "ბეტონის მიწოდება კერძო სახლის საძირკვლისთვის",
      "ბეტონის ტუმბოთი ჩასხმა მესამე სართულზე",
    ],
  },
  {
    key: "aragvi-electric",
    email: `aragvi@${ACCOUNT_DOMAIN}`,
    name: "არაგვი ელექტრიკი",
    city: "თბილისი",
    specialty: "CONSTRUCTION_REPAIR",
    service: "ELECTRICAL_INSTALLATION",
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
    phone: "+995599710008",
    joinedDaysAgo: 1240,
    historyJobs: [
      "ბინის ელექტროგაყვანილობის სრული შეცვლა",
      "ოფისის განათების სისტემის მონტაჟი",
      "ელექტრო ფარის შეცვლა საცხოვრებელ კორპუსში",
      "ეზოს გარე განათების მოწყობა",
    ],
  },
];

const OTHER_ACCOUNTS: readonly AccountSeed[] = [
  {
    key: "client",
    email: `client@${ACCOUNT_DOMAIN}`,
    name: "ნინო ბერიძე",
    role: "CLIENT",
    city: "თბილისი",
    phone: "+995599710021",
    accountKind: "PERSON",
    activityDescription:
      "კერძო დამკვეთი: სახლის მშენებლობა და ბინების რემონტი თბილისში.",
    joinedDaysAgo: 380,
    vip: true,
    logoPath: "/vip/logos/vip-client-1_icon.svg",
  },
  {
    key: "developer",
    email: `developer@${ACCOUNT_DOMAIN}`,
    name: "თბილისი დეველოპმენტი",
    role: "CLIENT",
    city: "თბილისი",
    phone: "+995599710022",
    accountKind: "COMPANY",
    activityDescription:
      "კომერციული დეველოპერი: ოფისები, საწყობები და სავაჭრო ფართები.",
    joinedDaysAgo: 350,
    vip: true,
    logoPath: "/vip/logos/vip-client-2_icon.svg",
  },
  {
    key: "vake",
    email: `vake@${ACCOUNT_DOMAIN}`,
    name: "ვაკის ამხანაგობა",
    role: "CLIENT",
    city: "თბილისი",
    phone: "+995599710023",
    accountKind: "COMPANY",
    activityDescription: "საცხოვრებელი კორპუსის ამხანაგობა ვაკეში.",
    joinedDaysAgo: 330,
    vip: false,
  },
  {
    key: "saburtalo",
    email: `saburtalo@${ACCOUNT_DOMAIN}`,
    name: "საბურთალო ჰოუმსი",
    role: "CLIENT",
    city: "თბილისი",
    phone: "+995599710024",
    accountKind: "COMPANY",
    activityDescription:
      "უძრავი ქონების მართვის კომპანია, რომელიც რეგულარულად აცხადებს ტენდერებს.",
    joinedDaysAgo: 395,
    vip: false,
  },
  {
    key: "standard",
    email: `standard@${ACCOUNT_DOMAIN}`,
    name: "ლევან კაპანაძე",
    role: "PROVIDER",
    city: "თბილისი",
    phone: "+995599710011",
    accountKind: "PERSON",
    activityDescription:
      "კერძო ოსტატი: წყობა, მოპირკეთება და ინტერიერის რემონტი.",
    joinedDaysAgo: 365,
    specialty: "CONSTRUCTION_REPAIR",
    vip: false,
  },
  {
    key: "sololaki",
    email: `sololaki@${ACCOUNT_DOMAIN}`,
    name: "სოლოლაკის სანტექნიკა",
    role: "PROVIDER",
    city: "თბილისი",
    phone: "+995599710012",
    accountKind: "COMPANY",
    activityDescription: "სანტექნიკისა და გათბობის სისტემების მონტაჟი.",
    joinedDaysAgo: 340,
    specialty: "CONSTRUCTION_REPAIR",
    vip: false,
  },
  {
    key: "admin",
    email: `admin@${ACCOUNT_DOMAIN}`,
    name: "პლატფორმის ადმინისტრატორი",
    role: "CLIENT",
    city: "თბილისი",
    phone: "+995599710031",
    accountKind: "PERSON",
    activityDescription: "Tender Market-ის მოდერაციის ანგარიში.",
    joinedDaysAgo: 400,
    vip: false,
    admin: true,
  },
];

const PARTNER_ACCOUNTS: readonly AccountSeed[] = PARTNERS.map((partner) => ({
  key: partner.key,
  email: partner.email,
  name: partner.name,
  role: "PROVIDER",
  city: partner.city,
  phone: partner.phone,
  accountKind: "COMPANY",
  activityDescription: partner.translations.ka.description,
  joinedDaysAgo: partner.joinedDaysAgo,
  specialty: partner.specialty,
  vip: true,
  logoPath: `/vip/logos/${partner.logoFile}`,
  serviceLabel: partner.serviceLabel,
  description: partner.description,
  translations: partner.translations,
}));

const ALL_ACCOUNTS: readonly AccountSeed[] = [
  ...PARTNER_ACCOUNTS,
  ...OTHER_ACCOUNTS,
];

type TenderSeed = Readonly<{
  owner: string;
  title: string;
  specialty: VipSpecialty;
  service: TenderServiceCode;
  shortDescription: string;
  fullDescription: string;
  scopeOfWork: string;
  conditions: string;
  budgetMinorUnits: number;
  areaSquareMeters?: number;
  workItems?: readonly Readonly<{
    name: string;
    quantity: number;
    unit: string;
  }>[];
  city: string;
  district: string;
  addressLine: string;
}>;

type BidSeed = Readonly<{
  provider: string;
  amountMinorUnits: number;
  durationDays: number;
  conditions: string;
}>;

const BID_CONDITIONS = {
  full: "ფასში შედის მასალა, სამუშაო ძალა და ნარჩენების გატანა. ხარაჩოები დამკვეთის ხარჯზეა.",
  labour:
    "ფასში შედის მხოლოდ სამუშაო ძალა და ინსტრუმენტები. მასალას შეიძენს დამკვეთი ჩვენი სიის მიხედვით.",
  vip: "გარანტია ორი წელი, ყოველდღიური ფოტორეპორტი და პროექტის მენეჯერი ობიექტზე. ფასში შედის მასალა.",
  delivery:
    "მიწოდება ობიექტზე ჩვენი ტრანსპორტით, ჩამოტვირთვა ფასში შედის. გადახდა მიწოდებისას.",
} as const;

// --------------------------------------------------------------- Scenarios
// Open for offers: the home hero, with VIP offers listed first and a cheaper
// standard offer tagged "Lowest price".
const HERO_TENDER: TenderSeed = {
  owner: "client",
  title: "ორსართულიანი კერძო სახლის მშენებლობა, წყნეთი",
  specialty: "CONSTRUCTION_REPAIR",
  service: "GENERAL_CONSTRUCTION",
  shortDescription:
    "180 მ² ორსართულიანი სახლის კარკასის აშენება მზა პროექტის მიხედვით",
  fullDescription:
    "ვეძებთ გამოცდილ კონტრაქტორს წყნეთში ორსართულიანი კერძო სახლის ასაშენებლად. არქიტექტურული და კონსტრუქციული პროექტი მზადაა, ნებართვა აღებულია. საჭიროა საძირკვლის, რკინაბეტონის კარკასის, კედლების წყობისა და სახურავის მოწყობა „შავ კარკასამდე“.",
  scopeOfWork:
    "საძირკველი, რკინაბეტონის კარკასი, ბლოკის კედლები, გადახურვა და სახურავი. შიდა მოპირკეთება არ შედის.",
  conditions:
    "სამუშაო უნდა დასრულდეს 5 თვეში. ანგარიშსწორება ეტაპობრივად, შესრულებული სამუშაოს აქტით.",
  budgetMinorUnits: 9_500_000,
  areaSquareMeters: 180,
  workItems: [
    { name: "საძირკვლის მოწყობა", quantity: 95, unit: "მ²" },
    { name: "რკინაბეტონის კარკასი", quantity: 180, unit: "მ²" },
    { name: "ბლოკის კედლის წყობა", quantity: 320, unit: "მ²" },
    { name: "სახურავის მოწყობა", quantity: 110, unit: "მ²" },
  ],
  city: "თბილისი",
  district: "წყნეთი",
  addressLine: "წყნეთის გზატკეცილი 14",
};

const HERO_BIDS: readonly BidSeed[] = [
  {
    provider: "standard",
    amountMinorUnits: 8_650_000,
    durationDays: 160,
    conditions: BID_CONDITIONS.labour,
  },
  {
    provider: "sololaki",
    amountMinorUnits: 8_900_000,
    durationDays: 150,
    conditions: BID_CONDITIONS.full,
  },
  {
    provider: "aragvi-electric",
    amountMinorUnits: 9_150_000,
    durationDays: 150,
    conditions: BID_CONDITIONS.vip,
  },
  {
    provider: "kartli-build",
    amountMinorUnits: 9_280_000,
    durationDays: 140,
    conditions: BID_CONDITIONS.vip,
  },
  {
    provider: "iveria-roofing",
    amountMinorUnits: 9_400_000,
    durationDays: 145,
    conditions: BID_CONDITIONS.full,
  },
];

// Open with no offers: the provider buys access and bids on it live.
const EMPTY_TENDER: TenderSeed = {
  owner: "client",
  title: "სააბაზანოს სრული რემონტი, ვაკე",
  specialty: "CONSTRUCTION_REPAIR",
  service: "RENOVATION_REMODELING",
  shortDescription:
    "6 მ² სააბაზანოს დემონტაჟი, ახალი სანტექნიკა და კაფელის დაგება",
  fullDescription:
    "ვაკეში, ბინაში საჭიროა სააბაზანოს სრული განახლება: ძველი ფილების აღება, მილების შეცვლა, ჰიდროიზოლაცია, კაფელის დაგება და ახალი სანტექნიკის მონტაჟი. მასალა შეგვიძლია შევიძინოთ ჩვენ.",
  scopeOfWork:
    "დემონტაჟი, მილების შეცვლა, ჰიდროიზოლაცია, კაფელი იატაკზე და კედლებზე, სანტექნიკის მონტაჟი.",
  conditions: "სამუშაო დღეებში 10:00-დან 19:00-მდე. ბინაში ცხოვრობს ოჯახი.",
  budgetMinorUnits: 750_000,
  areaSquareMeters: 6,
  city: "თბილისი",
  district: "ვაკე",
  addressLine: "ჭავჭავაძის გამზირი 37",
};

// Past its deadline with three offers: the client chooses the winner live.
const SELECTION_TENDER: TenderSeed = {
  owner: "client",
  title: "ოფისის ინტერიერის მოწყობა, საბურთალო",
  specialty: "CONSTRUCTION_REPAIR",
  service: "RENOVATION_REMODELING",
  shortDescription: "120 მ² ღია სივრცის ოფისის მოწყობა 20 სამუშაო ადგილისთვის",
  fullDescription:
    "საბურთალოზე, ბიზნესცენტრის მეოთხე სართულზე, საჭიროა ოფისის მოწყობა: თაბაშირმუყაოს ტიხრები, შეკიდული ჭერი, ლამინატი, შეღებვა და ელექტროგაყვანილობა 20 სამუშაო ადგილისთვის.",
  scopeOfWork:
    "ტიხრები, შეკიდული ჭერი, იატაკი, შეღებვა, განათება და როზეტები. ავეჯი არ შედის.",
  conditions: "ხმაურიანი სამუშაოები მხოლოდ 18:00-ის შემდეგ.",
  budgetMinorUnits: 4_200_000,
  areaSquareMeters: 120,
  city: "თბილისი",
  district: "საბურთალო",
  addressLine: "ვაჟა-ფშაველას გამზირი 71",
};

const SELECTION_BIDS: readonly BidSeed[] = [
  {
    provider: "kartli-build",
    amountMinorUnits: 3_980_000,
    durationDays: 35,
    conditions: BID_CONDITIONS.vip,
  },
  {
    provider: "standard",
    amountMinorUnits: 3_720_000,
    durationDays: 45,
    conditions: BID_CONDITIONS.labour,
  },
  {
    provider: "aragvi-electric",
    amountMinorUnits: 4_050_000,
    durationDays: 30,
    conditions: BID_CONDITIONS.full,
  },
];

type AgreementTarget = "PENDING_CONFIRMATION" | "IN_PROGRESS" | "COMPLETED";

type AwardedSeed = Readonly<{
  tender: TenderSeed;
  bids: readonly BidSeed[];
  winner: string;
  target: AgreementTarget;
}>;

// Awarded to the provider account and left in each agreement state, so the
// client and the provider can each take the next step live.
const AWARDED: readonly AwardedSeed[] = [
  {
    target: "PENDING_CONFIRMATION",
    winner: "kartli-build",
    tender: {
      owner: "client",
      title: "სამზარეულოს რემონტი, დიდუბე",
      specialty: "CONSTRUCTION_REPAIR",
      service: "RENOVATION_REMODELING",
      shortDescription:
        "14 მ² სამზარეულოს განახლება: კედლები, იატაკი და განათება",
      fullDescription:
        "დიდუბეში, ბინაში საჭიროა სამზარეულოს რემონტი: ძველი მოპირკეთების აღება, კედლების გასწორება და შეღებვა, იატაკის ფილა და ახალი განათება. ავეჯს ცალკე ვუკვეთავთ.",
      scopeOfWork:
        "დემონტაჟი, ბათქაში, შეღებვა, იატაკის ფილა, განათების წერტილები.",
      conditions: "სამუშაო უნდა დაიწყოს ორი კვირის განმავლობაში.",
      budgetMinorUnits: 1_100_000,
      areaSquareMeters: 14,
      city: "თბილისი",
      district: "დიდუბე",
      addressLine: "აკაკი წერეთლის გამზირი 116",
    },
    bids: [
      {
        provider: "kartli-build",
        amountMinorUnits: 1_040_000,
        durationDays: 21,
        conditions: BID_CONDITIONS.vip,
      },
      {
        provider: "standard",
        amountMinorUnits: 990_000,
        durationDays: 28,
        conditions: BID_CONDITIONS.labour,
      },
    ],
  },
  {
    target: "IN_PROGRESS",
    winner: "kartli-build",
    tender: {
      owner: "client",
      title: "კორპუსის ფასადის შეღებვა, ვაკე",
      specialty: "CONSTRUCTION_REPAIR",
      service: "PAINTING_DECORATING",
      shortDescription:
        "ხუთსართულიანი კორპუსის ფასადის გაწმენდა და შეღებვა ორ ფენად",
      fullDescription:
        "ვაკეში, ხუთსართულიანი საცხოვრებელი კორპუსის ფასადს სჭირდება გაწმენდა, ბზარების ამოვსება, გრუნტი და შეღებვა ფასადის საღებავით ორ ფენად.",
      scopeOfWork:
        "ფასადის გაწმენდა, ბზარების შეკეთება, გრუნტი და ორფენიანი შეღებვა.",
      conditions: "ხარაჩოები და ფასადის საღებავი კონტრაქტორის ხარჯზეა.",
      budgetMinorUnits: 2_600_000,
      areaSquareMeters: 640,
      city: "თბილისი",
      district: "ვაკე",
      addressLine: "აბაშიძის ქუჩა 22",
    },
    bids: [
      {
        provider: "kartli-build",
        amountMinorUnits: 2_480_000,
        durationDays: 30,
        conditions: BID_CONDITIONS.vip,
      },
      {
        provider: "iveria-roofing",
        amountMinorUnits: 2_550_000,
        durationDays: 35,
        conditions: BID_CONDITIONS.full,
      },
    ],
  },
  {
    target: "COMPLETED",
    winner: "kartli-build",
    tender: {
      owner: "client",
      title: "აივნის მოპირკეთება და ჰიდროიზოლაცია, მთაწმინდა",
      specialty: "CONSTRUCTION_REPAIR",
      service: "WATERPROOFING",
      shortDescription: "12 მ² ღია აივნის ჰიდროიზოლაცია და ფილის დაგება",
      fullDescription:
        "მთაწმინდაზე, ღია აივანზე წყალი ჩადის ქვედა სართულზე. საჭიროა ძველი ფილის აღება, ჰიდროიზოლაციის მოწყობა და ყინვაგამძლე ფილის დაგება.",
      scopeOfWork: "ფილის აღება, ჰიდროიზოლაცია, ქანობი და ახალი ფილა.",
      conditions: "სამუშაო მშრალ ამინდში, ერთი კვირის განმავლობაში.",
      budgetMinorUnits: 520_000,
      areaSquareMeters: 12,
      city: "თბილისი",
      district: "მთაწმინდა",
      addressLine: "ლერმონტოვის ქუჩა 8",
    },
    bids: [
      {
        provider: "kartli-build",
        amountMinorUnits: 495_000,
        durationDays: 7,
        conditions: BID_CONDITIONS.vip,
      },
      {
        provider: "sololaki",
        amountMinorUnits: 470_000,
        durationDays: 10,
        conditions: BID_CONDITIONS.full,
      },
    ],
  },
];

// Other clients' open tenders, so search, filters and the provider's own
// offers list have something in each category.
const MARKET_TENDERS: readonly Readonly<{
  tender: TenderSeed;
  bids: readonly BidSeed[];
}>[] = [
  {
    tender: {
      owner: "developer",
      title: "სასაწყობე ტერიტორიის ბეტონის იატაკი, რუსთავი",
      specialty: "MATERIAL_SUPPLIER",
      service: "READY_MIX_CONCRETE",
      shortDescription: "60 კუბი B25 ბეტონის მიწოდება ტუმბოთი ორ ეტაპად",
      fullDescription:
        "რუსთავში, ახალი საწყობის იატაკისთვის საჭიროა B25 მარკის ბეტონის მიწოდება ავტობეტონტუმბოთი. ჩასხმა ორ ეტაპად, ერთი კვირის ინტერვალით.",
      scopeOfWork: "60 მ³ B25 ბეტონი, ავტობეტონტუმბო, ორი ეტაპი.",
      conditions: "მიწოდება დილის 8 საათიდან. გადახდა ყოველი ეტაპის შემდეგ.",
      budgetMinorUnits: 1_450_000,
      city: "რუსთავი",
      district: "ინდუსტრიული ზონა",
      addressLine: "გაგარინის ქუჩა 3",
    },
    bids: [
      {
        provider: "rioni-concrete",
        amountMinorUnits: 1_390_000,
        durationDays: 8,
        conditions: BID_CONDITIONS.delivery,
      },
      {
        provider: "kartli-build",
        amountMinorUnits: 1_420_000,
        durationDays: 8,
        conditions: BID_CONDITIONS.delivery,
      },
    ],
  },
  {
    tender: {
      owner: "developer",
      title: "ავტოამწე ლითონის კონსტრუქციის მონტაჟისთვის, ისანი",
      specialty: "EQUIPMENT",
      service: "MOBILE_CRANE",
      shortDescription: "25-ტონიანი ავტოამწე ოპერატორით ორი დღით",
      fullDescription:
        "ისანში, სავაჭრო პავილიონის ლითონის კონსტრუქციის ასაწყობად საჭიროა 25-ტონიანი ავტოამწე სერტიფიცირებული ოპერატორით ორი სამუშაო დღით.",
      scopeOfWork: "ავტოამწე, ოპერატორი, მიწოდება და უკან გაყვანა.",
      conditions: "სამუშაო დღე 9:00-დან 18:00-მდე.",
      budgetMinorUnits: 320_000,
      city: "თბილისი",
      district: "ისანი",
      addressLine: "ქეთევან დედოფლის გამზირი 50",
    },
    bids: [
      {
        provider: "geolift",
        amountMinorUnits: 290_000,
        durationDays: 2,
        conditions: BID_CONDITIONS.delivery,
      },
    ],
  },
  {
    tender: {
      owner: "vake",
      title: "სადარბაზოს რემონტი და ახალი განათება, ვაკე",
      specialty: "CONSTRUCTION_REPAIR",
      service: "PAINTING_DECORATING",
      shortDescription:
        "ცხრასართულიანი კორპუსის სადარბაზოს შეღებვა და LED განათება",
      fullDescription:
        "ამხანაგობა აცხადებს ტენდერს სადარბაზოს რემონტზე: კედლების გასწორება და შეღებვა, კიბის მოაჯირის შეღებვა და ყველა სართულზე სენსორული LED განათება.",
      scopeOfWork: "ბათქაში, შეღებვა, მოაჯირი, LED სანათები სენსორით.",
      conditions:
        "მცხოვრებლებისთვის გასასვლელი ყოველთვის თავისუფალი უნდა იყოს.",
      budgetMinorUnits: 1_800_000,
      city: "თბილისი",
      district: "ვაკე",
      addressLine: "ირაკლი აბაშიძის ქუჩა 40",
    },
    bids: [
      {
        provider: "aragvi-electric",
        amountMinorUnits: 1_750_000,
        durationDays: 25,
        conditions: BID_CONDITIONS.vip,
      },
      {
        provider: "standard",
        amountMinorUnits: 1_590_000,
        durationDays: 30,
        conditions: BID_CONDITIONS.labour,
      },
    ],
  },
  {
    tender: {
      owner: "vake",
      title: "ავეჯის გადაზიდვა თბილისიდან ბათუმში",
      specialty: "TRANSPORT",
      service: "FURNITURE_APPLIANCE_MOVING",
      shortDescription: "სამოთახიანი ბინის ავეჯის შეფუთვა და გადაზიდვა",
      fullDescription:
        "საჭიროა სამოთახიანი ბინის ავეჯისა და ტექნიკის შეფუთვა, დატვირთვა, გადაზიდვა თბილისიდან ბათუმში და ადგილზე ჩამოტვირთვა.",
      scopeOfWork: "შეფუთვა, დატვირთვა, ტრანსპორტირება, ჩამოტვირთვა.",
      conditions: "გადაზიდვა შაბათს ან კვირას.",
      budgetMinorUnits: 150_000,
      city: "ბათუმი",
      district: "ძველი ბათუმი",
      addressLine: "გორგილაძის ქუჩა 25",
    },
    bids: [
      {
        provider: "colchis-logistics",
        amountMinorUnits: 135_000,
        durationDays: 1,
        conditions: BID_CONDITIONS.delivery,
      },
    ],
  },
];

const DRAFT_TENDER: TenderSeed = {
  owner: "client",
  title: "მინაპაკეტის ფანჯრების შეცვლა, ნაძალადევი",
  specialty: "CONSTRUCTION_REPAIR",
  service: "WINDOWS_DOORS",
  shortDescription: "ბინაში 6 ფანჯრისა და აივნის კარის შეცვლა",
  fullDescription:
    "ძველი ხის ფანჯრების ნაცვლად საჭიროა მეტალოპლასტმასის მინაპაკეტები, დემონტაჟით და ფერდოების მოპირკეთებით.",
  scopeOfWork: "დემონტაჟი, ექვსი ფანჯარა, აივნის კარი, ფერდოები.",
  conditions: "",
  budgetMinorUnits: 600_000,
  city: "თბილისი",
  district: "ნაძალადევი",
  addressLine: "ცოტნე დადიანის ქუჩა 120",
};

const CANCELLED_TENDER: TenderSeed = {
  owner: "client",
  title: "ეზოს ღობის მონტაჟი, დიღომი",
  specialty: "CONSTRUCTION_REPAIR",
  service: "METALWORK_WELDING",
  shortDescription: "40 მეტრი ლითონის ღობე ჭიშკრით",
  fullDescription:
    "კერძო სახლის ეზოში საჭიროა 40 მეტრი ლითონის ღობისა და ავტომატური ჭიშკრის მონტაჟი ბეტონის ბაზაზე.",
  scopeOfWork: "ბეტონის ბაზა, ლითონის სექციები, ავტომატური ჭიშკარი.",
  conditions: "სამუშაო ერთი თვის განმავლობაში.",
  budgetMinorUnits: 900_000,
  city: "თბილისი",
  district: "დიღომი",
  addressLine: "დიღმის მასივი, მე-5 კვარტალი",
};

const CANCELLATION_REASON =
  "პროექტი გადაიდო გაზაფხულამდე, ტენდერს ხელახლა გამოვაცხადებთ.";

// Review scores and Georgian comments for the history jobs; the varied scores
// give each partner a different rating in the Lounge.
const SCORE_ROWS = [
  { quality: 5, deadline: 5, communication: 5, agreedPrice: 5 },
  { quality: 5, deadline: 4, communication: 5, agreedPrice: 4 },
  { quality: 4, deadline: 5, communication: 4, agreedPrice: 5 },
  { quality: 4, deadline: 4, communication: 5, agreedPrice: 4 },
  { quality: 5, deadline: 3, communication: 4, agreedPrice: 4 },
] as const;

const REVIEW_COMMENTS = [
  "სამუშაო შესრულდა ხარისხიანად და დათქმულ ვადაში. გუნდი ყოველთვის ხელმისაწვდომი იყო, გირჩევთ.",
  "ძალიან პროფესიონალური მიდგომა. ყველა დეტალი წინასწარ შეგვითანხმეს და ფასი არ შეცვლილა.",
  "კარგი კომუნიკაცია და სუფთა სამუშაო. მცირე დაგვიანება იყო, მაგრამ შედეგით კმაყოფილი ვართ.",
  "მასალა დროულად მოიტანეს და ობიექტი სუფთად დატოვეს. აუცილებლად ვითანამშრომლებთ კიდევ.",
  "გამოცდილი ოსტატები და გამჭვირვალე ხარჯთაღრიცხვა. შედეგმა მოლოდინს გადააჭარბა.",
] as const;

const REDACTED_REVIEW_COMMENT =
  "ეს ოსტატები არიან თაღლითები, ფული აიღეს და ტელეფონს აღარ პასუხობენ საერთოდ.";
const REDACTION_REASON =
  "შეურაცხმყოფელი და დაუსაბუთებელი ბრალდება, ეწინააღმდეგება წესებს.";

type ResolvedPassword = Readonly<{
  password: string;
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

// Same guards as seed-vip.ts: the demo deployment needs the tender_demo
// database and DEMO_SEED_CONFIRM; local runs may only touch tender_dev.
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
      `seed:demo-ka runs only against the local dev database (${LOCAL_DATABASE_NAME}); found ${databaseName}`,
    );
  }
  return databaseName;
}

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

function nextAgreementCommand(
  status: string,
  target: AgreementTarget,
): ManageAgreementCommand | null {
  if (status === target) return null;
  switch (status) {
    case "PENDING_CONFIRMATION":
      return { type: "CONFIRM" };
    case "AGREED":
      return { type: "ACKNOWLEDGE_START" };
    case "IN_PROGRESS":
      return { type: "CONFIRM_COMPLETION" };
    default:
      throw new Error(`Agreement is in ${status}, which the seed cannot drive`);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    { cancelTender },
    { startAccessCheckout },
    { confirmAccessCheckout },
    { submitBid },
    { runDeadlineSelection },
    { chooseWinningBid },
    { hasTenderEntitlement },
    { createManageAgreement },
    { prismaAgreementGateway },
    { publishReview },
    { redactReview },
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
    import("../src/modules/tenders/application/cancel-tender"),
    import("../src/modules/access/application/start-access-checkout"),
    import("../src/modules/access/application/confirm-access-checkout"),
    import("../src/modules/bidding/application/submit-bid"),
    import("../src/modules/bidding/application/run-deadline-selection"),
    import("../src/modules/bidding/application/choose-winning-bid"),
    import("../src/modules/access/application/has-tender-entitlement"),
    import("../src/modules/agreements/application/manage-agreement"),
    import("../src/modules/agreements/infrastructure/prisma-agreement-gateway"),
    import("../src/modules/reviews/application/publish-review"),
    import("../src/modules/reviews/application/redact-review"),
    import("../src/modules/bidding/domain/selection"),
    import("../src/modules/vip/application/list-vip-partners"),
  ]);

  const env = getServerEnv();
  const databaseName = assertTargetDatabase(env);
  const { password, isLocalFallback } = resolvePassword(env);

  const manageAgreement = createManageAgreement({
    repository: prismaAgreementGateway,
    now: () => new Date(),
    ids: { next: randomUUID },
    selectionWindowDays: SELECTION_WINDOW_DAYS,
  });

  try {
    console.log(`Seeding the Georgian demo into ${databaseName}.`);

    // ------------------------------------------------------------ Accounts
    const userIds = new Map<string, string>();

    async function ensureAccount(spec: AccountSeed): Promise<string> {
      const existing = await database.user.findUnique({
        where: { email: spec.email },
        select: { id: true },
      });
      if (existing === null) {
        await auth.api.signUpEmail({
          body: {
            email: spec.email,
            name: spec.name,
            idNumber: "01010101010",
            cityOrTown: spec.city,
            address: "რუსთაველის გამზირი 12, თბილისი",
            password,
          },
        });
      }
      const user = await database.user.update({
        where: { email: spec.email },
        data: {
          emailVerified: true,
          createdAt: new Date(SEED_ANCHOR_MS - spec.joinedDaysAgo * DAY_MS),
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
          preferredLocale: "ka",
          preferredCurrency: "GEL",
        },
        { id: user.id, emailVerified: true },
      );
      if (!onboarded.ok) {
        throw new Error(`Could not onboard ${spec.key}: ${onboarded.error}`);
      }
      // Onboarding only grants CONSTRUCTION_REPAIR, so the category is
      // written directly, as seed-vip.ts does.
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
      if (spec.admin === true) {
        const granted = await database.userCapability.findFirst({
          where: { userId: user.id, code: "ADMIN" },
          select: { id: true },
        });
        if (granted === null) {
          await database.userCapability.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              code: "ADMIN",
              grantedBy: "demo-ka-seed",
            },
          });
        }
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
    console.log("VIP memberships ready.");

    // ------------------------------------------------------ Tender helpers
    async function findTender(seed: TenderSeed) {
      return database.tender.findFirst({
        where: { ownerId: idOf(seed.owner), title: seed.title },
        select: { id: true, status: true, deadline: true },
      });
    }

    // Removes a scenario that drifted from its expected state. Agreements are
    // not foreign-keyed to the tender, so they go first; a scenario that has
    // reviews is never rebuilt.
    async function removeTender(tenderId: string): Promise<void> {
      const agreements = await database.agreement.findMany({
        where: { tenderId },
        select: { id: true },
      });
      const agreementIds = agreements.map(({ id }) => id);
      await database.tenderSelection.deleteMany({ where: { tenderId } });
      await database.agreement.deleteMany({
        where: { id: { in: agreementIds } },
      });
      await database.tender.delete({ where: { id: tenderId } });
    }

    async function createTender(
      seed: TenderSeed,
      deadline: Date,
      publish: boolean,
    ): Promise<string> {
      const actor = { id: idOf(seed.owner) };
      const draft = await createTenderDraft(
        {
          specialty: seed.specialty,
          serviceCode: seed.service,
          title: seed.title,
        },
        actor,
      );
      if (!draft.ok) throw new Error(`Failed to draft "${seed.title}"`);
      const updated = await updateTenderDraft(
        draft.value.id,
        {
          shortDescription: seed.shortDescription,
          fullDescription: seed.fullDescription,
          scopeOfWork: seed.scopeOfWork,
          budgetMinorUnits: seed.budgetMinorUnits,
          currency: "GEL",
          deadline,
          desiredStartDate: new Date(deadline.getTime() + 7 * DAY_MS),
          conditions: seed.conditions === "" ? null : seed.conditions,
          ...(seed.areaSquareMeters === undefined
            ? {}
            : { areaSquareMeters: seed.areaSquareMeters }),
          ...(seed.workItems === undefined
            ? {}
            : { workItems: seed.workItems }),
        },
        actor,
      );
      if (!updated.ok) {
        throw new Error(`Failed to complete "${seed.title}": ${updated.error}`);
      }
      const located = await syncTenderLocation(
        draft.value.id,
        {
          mode: "ADDRESS",
          city: seed.city,
          district: seed.district,
          addressLine: seed.addressLine,
        },
        actor,
      );
      if (!located.ok) {
        throw new Error(`Failed to locate "${seed.title}": ${located.error}`);
      }
      if (publish) {
        const published = await publishTender(draft.value.id, actor);
        if (!published.ok) {
          throw new Error(
            `Failed to publish "${seed.title}": ${published.error}`,
          );
        }
      }
      return draft.value.id;
    }

    // Idempotent per (provider, tender); access is bought through the real
    // checkout only when the provider does not already hold it.
    async function ensureBid(
      tenderId: string,
      bid: BidSeed,
    ): Promise<Readonly<{ bidId: string; qualifyingSubmittedAt: Date }>> {
      const providerId = idOf(bid.provider);
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
      const submitted = await submitBid(
        tenderId,
        {
          amountMinorUnits: bid.amountMinorUnits,
          durationDays: bid.durationDays,
          conditions: bid.conditions,
        },
        { id: providerId },
      );
      if (!submitted.ok) {
        throw new Error(`Failed to submit bid: ${submitted.error}`);
      }
      return {
        bidId: submitted.value.id,
        qualifyingSubmittedAt: submitted.value.qualifyingSubmittedAt,
      };
    }

    // A tender open for offers. A published one keeps its id and bids and
    // only gets a fresh deadline once the old one has passed.
    async function ensureOpenTender(
      seed: TenderSeed,
      bids: readonly BidSeed[],
    ): Promise<string> {
      const deadline = new Date(Date.now() + OPEN_TENDER_DAYS * DAY_MS);
      const existing = await findTender(seed);
      let tenderId: string;
      if (existing?.status === "PUBLISHED") {
        tenderId = existing.id;
        if (
          existing.deadline === null ||
          existing.deadline.getTime() <= Date.now()
        ) {
          await database.tender.update({
            where: { id: tenderId },
            data: { deadline },
          });
        }
      } else {
        if (existing !== null) await removeTender(existing.id);
        tenderId = await createTender(seed, deadline, true);
      }
      for (const bid of bids) await ensureBid(tenderId, bid);
      return tenderId;
    }

    // Fixture-only step, the same pattern as seed-vip.ts: bids go in through
    // the real use case while the tender is open, then the deadline is moved
    // just after the last one, so the real deadline sweep can run.
    async function closeForSelection(
      seed: TenderSeed,
      bids: readonly BidSeed[],
    ): Promise<Readonly<{ tenderId: string; bidIds: Map<string, string> }>> {
      const tenderId = await createTender(
        seed,
        new Date(Date.now() + OPEN_TENDER_DAYS * DAY_MS),
        true,
      );
      const bidIds = new Map<string, string>();
      let lastSubmittedAt = 0;
      for (const bid of bids) {
        const placed = await ensureBid(tenderId, bid);
        bidIds.set(bid.provider, placed.bidId);
        lastSubmittedAt = Math.max(
          lastSubmittedAt,
          placed.qualifyingSubmittedAt.getTime(),
        );
      }
      const dueAt = new Date(lastSubmittedAt + 1_000);
      await database.tender.update({
        where: { id: tenderId },
        data: { deadline: dueAt },
      });
      const wait = dueAt.getTime() - Date.now();
      if (wait > 0) await sleep(wait + 50);
      const swept = await runDeadlineSelection(tenderId);
      if (!swept.ok || swept.value.outcome !== "AWAITING_SELECTION") {
        throw new Error(`"${seed.title}" did not open for selection`);
      }
      return { tenderId, bidIds };
    }

    async function driveAgreement(
      agreementId: string,
      clientId: string,
      providerId: string,
      target: AgreementTarget,
    ): Promise<void> {
      for (let step = 0; step < 6; step += 1) {
        const agreement = await database.agreement.findUniqueOrThrow({
          where: { id: agreementId },
          select: { status: true },
        });
        const next = nextAgreementCommand(agreement.status, target);
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
      throw new Error(`Agreement ${agreementId} did not reach ${target}`);
    }

    // An awarded tender whose latest agreement is in the target state. Any
    // other state (an expired confirmation, a previous run cut short) is
    // rebuilt from the start.
    async function ensureAwarded(seed: AwardedSeed): Promise<string> {
      const existing = await findTender(seed.tender);
      if (existing !== null) {
        const latest = await database.agreement.findFirst({
          where: { tenderId: existing.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true },
        });
        if (latest?.status === seed.target) return latest.id;
        const reviewed =
          latest === null
            ? 0
            : await database.review.count({
                where: { agreementId: latest.id },
              });
        if (reviewed > 0) {
          throw new Error(
            `"${seed.tender.title}" has reviews and cannot be rebuilt`,
          );
        }
        await removeTender(existing.id);
      }
      const { tenderId, bidIds } = await closeForSelection(
        seed.tender,
        seed.bids,
      );
      const winningBid = bidIds.get(seed.winner);
      if (winningBid === undefined) {
        throw new Error(`No winning bid for "${seed.tender.title}"`);
      }
      const clientId = idOf(seed.tender.owner);
      const chosen = await chooseWinningBid(tenderId, winningBid, {
        id: clientId,
      });
      if (!chosen.ok) {
        throw new Error(
          `"${seed.tender.title}" was not awarded: ${chosen.error}`,
        );
      }
      await driveAgreement(
        chosen.value.agreementId,
        clientId,
        idOf(seed.winner),
        seed.target,
      );
      return chosen.value.agreementId;
    }

    // ------------------------------------------------- Partner history
    // Completed jobs owned by the history client, each with a Georgian
    // review, so every Lounge partner has a rating and a track record.
    let engagements = 0;
    let redactedReviewId: string | null = null;
    for (const [partnerIndex, partner] of PARTNERS.entries()) {
      for (const [jobIndex, title] of partner.historyJobs.entries()) {
        const seed: AwardedSeed = {
          target: "COMPLETED",
          winner: partner.key,
          bids: [
            {
              provider: partner.key,
              amountMinorUnits:
                300_000 + jobIndex * 45_000 + partnerIndex * 12_000,
              durationDays: 10 + jobIndex * 5,
              conditions: BID_CONDITIONS.full,
            },
          ],
          tender: {
            owner: "saburtalo",
            title,
            specialty: partner.specialty,
            service: partner.service,
            shortDescription: `${partner.translations.ka.serviceLabel}: დასრულებული პროექტი`,
            fullDescription: `${title}. სამუშაო შესრულდა დამკვეთთან შეთანხმებული ხარჯთაღრიცხვისა და გრაფიკის მიხედვით.`,
            scopeOfWork:
              "მასალა, სამუშაო ძალა და ზედამხედველობა პირობების მიხედვით.",
            conditions: "გადახდა სამუშაოს ჩაბარების შემდეგ.",
            budgetMinorUnits: 400_000 + jobIndex * 50_000,
            city: partner.city === "მცხეთა" ? "თბილისი" : partner.city,
            district: "ცენტრი",
            addressLine: "ობიექტის მისამართი დამკვეთთანაა",
          },
        };
        const agreementId = await ensureAwarded(seed);
        const historyClient = idOf("saburtalo");
        const review = await database.review.findFirst({
          where: { agreementId, reviewerId: historyClient },
          select: { id: true },
        });
        // One review is written as abuse, then redacted by the admin, so the
        // moderation screen shows both states.
        const isAbusive = partnerIndex === 2 && jobIndex === 1;
        if (review === null) {
          const scores =
            SCORE_ROWS[(partnerIndex + jobIndex) % SCORE_ROWS.length];
          const comment =
            REVIEW_COMMENTS[
              (partnerIndex * 2 + jobIndex) % REVIEW_COMMENTS.length
            ];
          if (scores === undefined || comment === undefined) {
            throw new Error("No review row");
          }
          const published = await publishReview(
            agreementId,
            isAbusive
              ? {
                  quality: 1,
                  deadline: 2,
                  communication: 1,
                  agreedPrice: 2,
                  comment: REDACTED_REVIEW_COMMENT,
                }
              : { ...scores, comment },
            { id: historyClient },
          );
          if (!published.ok) {
            throw new Error(`Could not publish review: ${published.error}`);
          }
          if (isAbusive) redactedReviewId = published.value.id;
        }
        engagements += 1;
      }
    }
    if (redactedReviewId !== null) {
      const redacted = await redactReview(
        redactedReviewId,
        { reason: REDACTION_REASON },
        { id: idOf("admin") },
      );
      if (!redacted.ok) {
        throw new Error(`Could not redact review: ${redacted.error}`);
      }
    }
    console.log(`Partner history ready: ${engagements} completed jobs.`);

    // -------------------------------------------- Provider demo account
    // The completed one is left without a review for the client to write.
    for (const seed of AWARDED) await ensureAwarded(seed);
    console.log("Awarded tenders ready (pending, in progress, completed).");

    const selection = await findTender(SELECTION_TENDER);
    if (selection?.status !== "AWAITING_SELECTION") {
      if (selection !== null) await removeTender(selection.id);
      await closeForSelection(SELECTION_TENDER, SELECTION_BIDS);
    }
    console.log("Tender awaiting the client's choice ready.");

    for (const market of MARKET_TENDERS) {
      await ensureOpenTender(market.tender, market.bids);
    }
    await ensureOpenTender(EMPTY_TENDER, []);
    const heroId = await ensureOpenTender(HERO_TENDER, HERO_BIDS);
    // The home hero is the open tender published last.
    await database.tender.update({
      where: { id: heroId },
      data: { publishedAt: new Date() },
    });
    console.log("Open tenders ready.");

    if ((await findTender(DRAFT_TENDER)) === null) {
      await createTender(
        DRAFT_TENDER,
        new Date(Date.now() + OPEN_TENDER_DAYS * DAY_MS),
        false,
      );
    }
    const cancelled = await findTender(CANCELLED_TENDER);
    if (cancelled?.status !== "CANCELLED") {
      if (cancelled !== null) await removeTender(cancelled.id);
      const tenderId = await createTender(
        CANCELLED_TENDER,
        new Date(Date.now() + OPEN_TENDER_DAYS * DAY_MS),
        true,
      );
      const result = await cancelTender(
        tenderId,
        { reason: CANCELLATION_REASON },
        { id: idOf(CANCELLED_TENDER.owner) },
      );
      if (!result.ok) throw new Error(`Could not cancel: ${result.error}`);
    }
    console.log("Draft and cancelled tenders ready.");

    // ------------------------------------------------------------ Summary
    const lounge = await listVipPartners({ locale: "ka", now: new Date() });
    console.log("");
    console.log(`Lounge partners (eligible): ${lounge.length}`);
    for (const partner of lounge) {
      console.log(
        `  ${partner.name.padEnd(20)} rating ${partner.rating ?? "-"}  completed ${partner.completed}`,
      );
    }
    console.log("");
    console.log(
      isLocalFallback
        ? `Accounts (local fallback password for all: ${password})`
        : "Accounts (password: value of DEMO_SEED_PASSWORD, not printed)",
    );
    for (const spec of ALL_ACCOUNTS) {
      const role = spec.admin
        ? "Admin"
        : spec.role === "PROVIDER"
          ? "Provider"
          : "Client";
      console.log(
        `  ${spec.email.padEnd(28)} ${role.padEnd(9)} ${spec.vip ? "VIP" : "standard"}  ${spec.name}`,
      );
    }
  } finally {
    await database.$disconnect();
  }
}

await main();
