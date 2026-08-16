import Link from "next/link";
import type { AgreementView } from "../infrastructure/prisma-agreement-gateway";
export function AgreementList({
  agreements,
  locale,
}: {
  agreements: readonly AgreementView[];
  locale: string;
}) {
  if (!agreements.length)
    return <p className="tender-empty">No agreements yet.</p>;
  return (
    <ul className="tender-list">
      {agreements.map((agreement) => (
        <li key={agreement.id}>
          <div className="tender-list-heading">
            <h2>
              <Link href={`/${locale}/agreements/${agreement.id}`}>
                {agreement.snapshot.tenderTitle}
              </Link>
            </h2>
            <span className="tender-status">{agreement.status}</span>
          </div>
          <p className="discovery-summary">
            {agreement.snapshot.amountMinorUnits} {agreement.snapshot.currency}
          </p>
        </li>
      ))}
    </ul>
  );
}
