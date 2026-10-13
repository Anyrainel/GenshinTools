import { createLucideIcon } from "lucide-react";

export const ImportIcon = createLucideIcon("ImportData", [
  [
    "path",
    {
      d: "M10 8V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-3",
      key: "box",
    },
  ],
  ["path", { d: "M3 12h12", key: "arrow" }],
  ["path", { d: "m11 8 4 4-4 4", key: "head" }],
]);

export const ExportIcon = createLucideIcon("ExportData", [
  [
    "path",
    {
      d: "M14 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3",
      key: "box",
    },
  ],
  ["path", { d: "M9 12h12", key: "arrow" }],
  ["path", { d: "m17 8 4 4-4 4", key: "head" }],
]);
