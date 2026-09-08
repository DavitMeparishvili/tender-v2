"use client";
export function TenderSortSelect({
  value,
  label,
  newest,
  oldest,
  deadline,
}: {
  value: string;
  label: string;
  newest: string;
  oldest: string;
  deadline: string;
}) {
  return (
    <select
      name="sort"
      aria-label={label}
      defaultValue={value}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      <option value="newest">{newest}</option>
      <option value="oldest">{oldest}</option>
      <option value="deadline">{deadline}</option>
    </select>
  );
}
