import { ItemIcon } from "@/components/shared/ItemIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById } from "@/data/constants";
import type { ArtifactSetConfigs } from "@/data/types";
import { ArtifactConfigCard } from "./ArtifactConfigCard";

interface ArtifactCardProps {
  setId: string;
  setImagePath: string;
  filter: ArtifactSetConfigs;
  onJumpToCharacter: (characterId: string) => void;
}

export function ArtifactCard({
  setId,
  setImagePath,
  filter,
  onJumpToCharacter,
}: ArtifactCardProps) {
  const { t } = useLanguage();
  const effects = t.artifactEffects(setId);

  return (
    <Card className="bg-gradient-card">
      <CardHeader className="pb-3 pt-5">
        <div className="flex items-center gap-4">
          <ItemIcon
            imagePath={setImagePath}
            rarity={artifactsById[setId]?.rarity || 5}
            size="xl"
            alt={setId}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-xl text-foreground">
                {t.artifact(setId)}
              </CardTitle>
            </div>
            <p className="text-sm italic text-muted-foreground truncate pr-4">
              <span className="font-bold">[2]</span> {effects[0]}{" "}
              <span className="font-bold">[4]</span> {effects[1]}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pb-3">
        {filter.configurations.map((config, index) => (
          <ArtifactConfigCard
            key={index}
            config={config}
            configNumber={index + 1}
            onJumpToCharacter={onJumpToCharacter}
          />
        ))}
      </CardContent>
    </Card>
  );
}
