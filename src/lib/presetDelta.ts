export type PresetDelta<TItem> =
  | {
      kind: "preset";
      id: string;
      displayIndex?: number;
      deleted?: true;
    }
  | {
      kind: "custom";
      id: string;
      value: TItem;
      displayIndex?: number;
    };

export function isCustomDelta<TItem>(
  delta: PresetDelta<TItem>
): delta is Extract<PresetDelta<TItem>, { kind: "custom" }> {
  return delta.kind === "custom";
}

export function isPresetDelta<TItem>(
  delta: PresetDelta<TItem>
): delta is Extract<PresetDelta<TItem>, { kind: "preset" }> {
  return delta.kind === "preset";
}
