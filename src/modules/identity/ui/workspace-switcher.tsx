import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Capability } from "../domain/capability";

type WorkspaceLabels = Readonly<{
  switchWorkspace: string;
  openClient: string;
  openProvider: string;
}>;

type WorkspaceSwitcherProps = Readonly<{
  locale: Locale;
  capabilities: readonly Capability[];
  active: "CUSTOMER" | "PROVIDER";
  labels: WorkspaceLabels;
}>;

export function WorkspaceSwitcher({
  locale,
  capabilities,
  active,
  labels,
}: WorkspaceSwitcherProps) {
  if (
    !capabilities.includes("CUSTOMER") ||
    !capabilities.includes("PROVIDER")
  ) {
    return null;
  }

  return (
    <nav className="workspace-switcher" aria-label={labels.switchWorkspace}>
      <Link
        href={"/" + locale + "/client"}
        aria-current={active === "CUSTOMER" ? "page" : undefined}
      >
        {labels.openClient}
      </Link>
      <Link
        href={"/" + locale + "/provider"}
        aria-current={active === "PROVIDER" ? "page" : undefined}
      >
        {labels.openProvider}
      </Link>
    </nav>
  );
}
