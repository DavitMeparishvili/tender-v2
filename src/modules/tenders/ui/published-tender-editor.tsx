"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "../../localization/config";
import type { PublishedTenderEdit } from "../application/edit-published-tender";
import { tenderPageCopy } from "./tender-page-copy";
import { WorkItemsEditor } from "./work-items-editor";

export function PublishedTenderEditor({
  id,
  locale,
  initial,
  labels,
}: {
  id: string;
  locale: Locale;
  initial: PublishedTenderEdit;
  labels: {
    title: string;
    description: string;
    team: string;
    materials: string;
    equipment: string;
    error: string;
  };
}) {
  const c = tenderPageCopy(locale);
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/tenders/${id}/details`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        setError(response.status === 409 ? c.editBlocked : labels.error);
        return;
      }
      router.push(`/${locale}/client/tenders/${id}`);
      router.refresh();
    } catch {
      setError(labels.error);
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={save}>
      {error ? <p role="alert">{error}</p> : null}
      <label>
        {labels.title}
        <input
          required
          minLength={5}
          maxLength={160}
          value={values.title}
          onChange={(event) =>
            setValues({ ...values, title: event.target.value })
          }
        />
      </label>
      <label>
        {labels.description}
        <textarea
          required
          minLength={20}
          maxLength={5000}
          rows={5}
          value={values.fullDescription}
          onChange={(event) =>
            setValues({ ...values, fullDescription: event.target.value })
          }
        />
      </label>
      <label>
        {c.area}
        <input
          type="number"
          min="0.01"
          max="1000000"
          step="any"
          value={values.areaSquareMeters ?? ""}
          onChange={(event) =>
            setValues({
              ...values,
              areaSquareMeters: event.target.value
                ? Number(event.target.value)
                : null,
            })
          }
        />
      </label>
      <WorkItemsEditor
        locale={locale}
        items={values.workItems}
        onChange={(items) => setValues({ ...values, workItems: [...items] })}
      />
      {(
        [
          ["workerNotes", labels.team],
          ["materialNotes", labels.materials],
          ["equipmentNotes", labels.equipment],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          {label}
          <textarea
            maxLength={1000}
            value={values[key] ?? ""}
            onChange={(event) =>
              setValues({ ...values, [key]: event.target.value || null })
            }
          />
        </label>
      ))}
      <button className="tender-button primary" disabled={pending}>
        {pending ? c.saving : c.save}
      </button>
    </form>
  );
}
