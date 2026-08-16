import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { DEFAULT_LOCALE, isLocale } from "@/src/modules/localization/config";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}`, request.url));
  }

  const [, locale, workspace, section] = request.nextUrl.pathname.split("/");
  // Tender discovery (list and detail) is public — anyone can browse it.
  // Only the provider dashboard and its other sections (e.g. agreements)
  // require a session; bidding itself is enforced separately, per actor,
  // by the bid API routes.
  const isPublicTenderDiscovery = workspace === "provider" && section === "tenders";
  if (
    locale !== undefined &&
    isLocale(locale) &&
    workspace !== undefined &&
    ["client", "provider", "profile"].includes(workspace) &&
    !isPublicTenderDiscovery &&
    getSessionCookie(request) === null
  ) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/:locale/client/:path*",
    "/:locale/provider/:path*",
    "/:locale/profile/:path*",
  ],
};
