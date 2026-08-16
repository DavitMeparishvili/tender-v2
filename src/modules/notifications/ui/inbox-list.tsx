"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InboxItem } from "../infrastructure/prisma-inbox-repository";
export function InboxList({
  items,
  locale,
}: {
  items: readonly InboxItem[];
  locale?: string;
}) {
  const router = useRouter();
  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    router.refresh();
  }
  if (!items.length)
    return <p className="tender-empty">No notifications yet.</p>;
  return (
    <ul className="tender-list">
      {items.map((item) => {
        const href =
          item.aggregateType === "Agreement"
            ? `/${locale ?? "en"}/agreements/${item.aggregateId}`
            : null;
        return (
          <li key={item.id}>
            <p>{item.messageKey}</p>
            {href ? <Link href={href}>Open agreement</Link> : null}
            <time dateTime={item.createdAt.toISOString()}>
              {item.createdAt.toLocaleString()}
            </time>
            {item.readAt === null ? (
              <button type="button" onClick={() => void markRead(item.id)}>
                Mark read
              </button>
            ) : (
              <span>Read</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
