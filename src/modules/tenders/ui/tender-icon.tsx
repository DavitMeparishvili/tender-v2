export type TenderIconName =
  | "save"
  | "upload"
  | "eye"
  | "close"
  | "wallet"
  | "calendar"
  | "pin"
  | "team"
  | "box"
  | "lock"
  | "download"
  | "external"
  | "edit"
  | "arrow"
  | "back"
  | "inbox"
  | "info"
  | "search"
  | "plus"
  | "more"
  | "photo"
  | "clip"
  | "chevron"
  | "chevronLeft"
  | "chevronRight"
  | "trash";
const paths: Record<TenderIconName, string> = {
  save: "M5 2h10l4 4v16H5V2Zm3 0v7h8V3M8 22v-8h8v8m-3-7v4",
  upload: "M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Zm15 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  close: "m6 6 12 12M6 18 18 6",
  wallet:
    "M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v12H5a3 3 0 0 1-3-3V6m19 7h-5v4h5M6 6h11",
  calendar:
    "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2m2 10h2m4 0h2m-8 3h2",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  team: "M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 21v-3a7 7 0 0 1 14 0v3H5ZM3 6a3 3 0 0 1 3 5M1 18v-3a4 4 0 0 1 4-3m16-6a3 3 0 0 0-3 5m5 7v-3a4 4 0 0 0-4-3",
  box: "m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10 9-5M12 12 3 7m9 5v10",
  lock: "M7 10V6a5 5 0 0 1 10 0v4M5 10h14v12H5V10Zm7 5v3",
  download: "M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6",
  external: "M14 3h7v7m0-7L11 13M10 3H3v18h18v-7",
  edit: "m15 3 6 6M3 21l6-1L22 7l-6-6L3 14v7Z",
  arrow: "M3 12h18m-7-7 7 7-7 7",
  back: "M21 12H3m7-7-7 7 7 7",
  inbox: "m3 4-2 12v5h22v-5L20 4H3Zm-2 12h7l2 3h4l2-3h7",
  info: "M12 10v7m0-11v1m10 5a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  search: "m16 16 6 6M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  plus: "M12 3v18M3 12h18",
  more: "M4 12h.01M12 12h.01M20 12h.01",
  photo: "M3 3h18v18H3V3Zm0 14 6-6 5 5 3-3 4 4M16 7h.01",
  clip: "m8 13 7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7L13 2m-5 11a1 1 0 0 0 2 2l7-7",
  chevron: "m6 9 6 6 6-6",
  chevronLeft: "m15 6-6 6 6 6",
  chevronRight: "m9 6 6 6-6 6",
  trash: "M3 6h18M9 6V2h6v4M5 6l1 16h12l1-16M10 10v8m4-8v8",
};
export function TenderIcon({
  name,
  size = 20,
}: {
  name: TenderIconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 4 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
