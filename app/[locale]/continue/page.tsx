import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/src/modules/identity/application/current-user";
import { isLocale } from "@/src/modules/localization/config";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ContinuePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const [{ locale }, query, requestHeaders] = await Promise.all([
    params,
    searchParams,
    headers(),
  ]);
  if (!isLocale(locale)) notFound();

  const user = await getCurrentUser(requestHeaders);
  if (user === null) redirect("/" + locale + "/login");
  if (!user.emailVerified) {
    redirect(
      "/" + locale + "/verify-email?email=" + encodeURIComponent(user.email),
    );
  }
  if (!user.onboardingComplete) {
    const intent = first(query.intent);
    if (intent === "CLIENT") redirect("/" + locale + "/register/client");
    if (intent === "CONSTRUCTION_PROVIDER") {
      redirect("/" + locale + "/register/provider");
    }
    redirect("/" + locale + "/register");
  }
  if (user.capabilities.includes("CUSTOMER"))
    redirect("/" + locale + "/client");
  if (user.capabilities.includes("PROVIDER")) {
    redirect("/" + locale + "/provider");
  }
  redirect("/" + locale + "/register");
}
