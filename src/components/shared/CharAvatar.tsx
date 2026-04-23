import { charactersById } from "@/data/gameResources";
import { getAssetUrl } from "@/lib/utils";

/** Small circular character avatar for compact inline use (timeline blocks, palettes, result rows). */
export function CharAvatar({
  charId,
  size = 20,
}: { charId: string; size?: number }) {
  const char = charactersById[charId];
  const src = char?.imagePath ? getAssetUrl(char.imagePath) : "";

  if (!src) {
    return (
      <div
        className="rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {charId[0]?.toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={charId}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
