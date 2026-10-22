import { notFound } from "next/navigation";
import { getServerEnv } from "@/src/config/env";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { countVipPartnersBySpecialty } from "@/src/modules/vip/application/count-vip-partners-by-specialty";
import { listVipPartners } from "@/src/modules/vip/application/list-vip-partners";
import { vipContactEmail } from "@/src/modules/vip/domain/contact";
import {
  categoryOptions,
  parseSpecialtyParam,
  type PartnersSearchParam,
} from "@/src/modules/vip/domain/partners-page";
import { VipPartnersPage } from "@/src/modules/vip/ui/vip-partners-page";

// This page reads the live marketplace database. It must be rendered when a
// request arrives, not while the Docker image is being built.
export const dynamic = "force-dynamic";

export default async function PartnersPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Readonly<Record<string, PartnersSearchParam>>>;
}>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!isLocale(locale)) {
    notFound();
  }

  const messages = getMessages(locale);
  const specialty = parseSpecialtyParam(query.specialty);

  const [partners, counts] = await Promise.all([
    listVipPartners({
      locale,
      now: new Date(),
      ...(specialty === null ? {} : { specialty }),
    }),
    countVipPartnersBySpecialty(),
  ]);

  const contactEmail = vipContactEmail(getServerEnv().VIP_CONTACT_EMAIL);

  return (
    <VipPartnersPage
      contactHref={`mailto:${contactEmail}`}
      locale={locale}
      messages={messages}
      options={categoryOptions(counts, specialty)}
      partners={partners}
      selected={specialty}
    />
  );
}
