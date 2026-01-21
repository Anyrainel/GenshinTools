import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { elementResourcesByName, sortedCharacters } from "@/data/constants";
import type { Character, Element } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn, getAssetUrl } from "@/lib/utils";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { CircleHelp, RotateCcw, Save, Search } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";

// Helper to map element string to stat key
const elementToStatKey = (element: Element): string => {
  return `${element.toLowerCase()}%`;
};

const ScoreExplanationDialog = () => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="w-6 h-6 text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/10 ml-1 transition-all duration-300 hover:scale-110 active:scale-95"
      >
        <CircleHelp className="w-4 h-4" />
      </Button>
      <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
        <ResponsiveDialogContent className="max-w-2xl bg-slate-950 border-slate-800 text-slate-200">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t.ui("scoreExplanation.title")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t.ui("scoreExplanation.description")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-6 pt-2 text-sm overflow-y-auto flex-1 pr-2">
            <div className="p-3 rounded-md bg-slate-900 border border-slate-800 font-mono text-amber-200/90 text-center text-xs sm:text-sm">
              {t.ui("scoreExplanation.formula")}
            </div>

            {/* Section 1: Normalization */}
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-100 flex items-center gap-2">
                <span className="bg-amber-500/20 text-amber-500 w-5 h-5 rounded-full flex items-center justify-center text-xs border border-amber-500/50">
                  1
                </span>
                {t.ui("scoreExplanation.normalization.title")}
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed">
                {t.ui("scoreExplanation.normalization.description")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-slate-400 text-xs font-mono bg-slate-900/50 p-3 rounded border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                  {t.ui("scoreExplanation.factors.cr")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                  {t.ui("scoreExplanation.factors.cd")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500/50" />
                  {t.ui("scoreExplanation.factors.atk")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                  {t.ui("scoreExplanation.factors.em")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                  {t.ui("scoreExplanation.factors.er")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                  {t.ui("scoreExplanation.factors.def")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50" />
                  {t.ui("scoreExplanation.factors.ele")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500/50" />
                  {t.ui("scoreExplanation.factors.phys")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500/50" />
                  {t.ui("scoreExplanation.factors.heal")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500/30" />
                  {t.ui("scoreExplanation.factors.flatAtk")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500/30" />
                  {t.ui("scoreExplanation.factors.flatHp")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/30" />
                  {t.ui("scoreExplanation.factors.flatDef")}
                </div>
              </div>
            </div>

            {/* Section 2: Weight */}
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-100 flex items-center gap-2">
                <span className="bg-amber-500/20 text-amber-500 w-5 h-5 rounded-full flex items-center justify-center text-xs border border-amber-500/50">
                  2
                </span>
                {t.ui("scoreExplanation.weight.title")}
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed">
                {t.ui("scoreExplanation.weight.description")}
              </p>
            </div>

            {/* Section 3: Punishment */}
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-100 flex items-center gap-2">
                <span className="bg-amber-500/20 text-amber-500 w-5 h-5 rounded-full flex items-center justify-center text-xs border border-amber-500/50">
                  3
                </span>
                {t.ui("scoreExplanation.punishment.title")}
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed">
                {t.ui("scoreExplanation.punishment.description")}
              </p>
            </div>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
};

// Memoized Row Component
const CharacterWeightRow = React.memo(
  ({
    char,
    weights,
    onValueChange,
  }: {
    char: Character;
    weights: Record<string, number>;
    onValueChange: (
      charId: string,
      key: string,
      val: number,
      isMerged?: boolean
    ) => void;
  }) => {
    const { t } = useLanguage();
    const elemKey = elementToStatKey(char.element);

    return (
      <TableRow className="border-white/5 hover:bg-white/5">
        <TableCell className="p-2">
          <div className="flex items-center gap-3">
            <ItemIcon
              imagePath={char.imagePath}
              rarity={char.rarity}
              size="xs"
            />
            <span className="font-medium text-lg text-gray-200 truncate">
              {t.character(char.id)}
            </span>
            <img
              src={getAssetUrl(elementResourcesByName[char.element]?.imagePath)}
              alt={char.element}
              className="w-6 h-6 flex-shrink-0 opacity-80"
            />
          </div>
        </TableCell>
        <TableCell className="p-1">
          <WeightCell
            value={weights["atk%"] ?? 0}
            onChange={(v) => onValueChange(char.id, "atk", v, true)}
            label={t.stat("atk")}
          />
        </TableCell>
        <TableCell className="p-1">
          <WeightCell
            value={weights["hp%"] ?? 0}
            onChange={(v) => onValueChange(char.id, "hp", v, true)}
            label={t.stat("hp")}
          />
        </TableCell>
        <TableCell className="p-1">
          <WeightCell
            value={weights["def%"] ?? 0}
            onChange={(v) => onValueChange(char.id, "def", v, true)}
            label={t.stat("def")}
          />
        </TableCell>
        <TableCell className="p-1">
          <WeightCell
            value={weights.cr ?? 0}
            onChange={(v) => onValueChange(char.id, "cr", v)}
            label={t.stat("cr")}
          />
        </TableCell>
        <TableCell className="p-1">
          <WeightCell
            value={weights.cd ?? 0}
            onChange={(v) => onValueChange(char.id, "cd", v)}
            label={t.stat("cd")}
          />
        </TableCell>
        <TableCell className="p-1">
          <WeightCell
            value={weights.em ?? 0}
            onChange={(v) => onValueChange(char.id, "em", v)}
            label={t.stat("em")}
          />
        </TableCell>
        <TableCell className="p-1">
          <WeightCell
            value={weights.er ?? 0}
            onChange={(v) => onValueChange(char.id, "er", v)}
            label={t.stat("er")}
          />
        </TableCell>
        <TableCell className="p-1">
          <WeightCell
            value={weights[elemKey] ?? 0}
            onChange={(v) => onValueChange(char.id, elemKey, v)}
            label={t.stat(elemKey)}
          />
        </TableCell>
        <TableCell className="p-1">
          <WeightCell
            value={weights["phys%"] ?? 0}
            onChange={(v) => onValueChange(char.id, "phys%", v)}
            label={t.stat("phys%")}
          />
        </TableCell>
        <TableCell className="p-1">
          <WeightCell
            value={weights["heal%"] ?? 0}
            onChange={(v) => onValueChange(char.id, "heal%", v)}
            label={t.stat("heal%")}
          />
        </TableCell>
      </TableRow>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for performance
    return (
      prevProps.char === nextProps.char &&
      prevProps.weights === nextProps.weights &&
      prevProps.onValueChange === nextProps.onValueChange
    );
  }
);

export function StatWeightView() {
  const { t } = useLanguage();
  const {
    config,
    setGlobalWeight,
    setCharacterWeight,
    resetGlobalConfig,
    resetCharacterWeights,
  } = useArtifactScoreStore();

  const [search, setSearch] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(
    null
  );
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const filteredCharacters = useMemo(() => {
    return sortedCharacters.filter((c) => {
      const name = t.character(c.id).toLowerCase();
      return name.includes(search.toLowerCase());
    });
  }, [search, t]);

  // Helper to update merged stats
  const updateMergedWeight = useCallback(
    (charId: string, baseKey: "hp" | "atk" | "def", value: number) => {
      setCharacterWeight(charId, baseKey, value); // flat
      setCharacterWeight(charId, `${baseKey}%`, value); // percent
    },
    [setCharacterWeight]
  );

  const updateWeight = useCallback(
    (charId: string, key: string, value: number) => {
      // Clamp between 0 and 100
      const clamped = Math.max(0, Math.min(100, value));
      setCharacterWeight(charId, key, clamped);
    },
    [setCharacterWeight]
  );

  const handleValueChange = useCallback(
    (charId: string, key: string, val: number, isMerged = false) => {
      if (isMerged) {
        updateMergedWeight(charId, key as "hp" | "atk" | "def", val);
      } else {
        updateWeight(charId, key, val);
      }
    },
    [updateMergedWeight, updateWeight]
  );

  const handleSaveConfig = async () => {
    const lines = [
      "// prettier-ignore",
      "export const STAT_WEIGHTS: Record<string, Record<string, number>> = {",
    ];

    // Define exact key order for the output
    const keysOrder = [
      "hp",
      "atk",
      "def",
      "hp%",
      "atk%",
      "def%",
      "cr",
      "cd",
      "em",
      "er",
      "pyro%",
      "hydro%",
      "anemo%",
      "electro%",
      "dendro%",
      "cryo%",
      "geo%",
      "phys%",
      "heal%",
    ];

    // Use the same order as in the table (sortedCharacters)
    for (const char of sortedCharacters) {
      const id = char.id;
      const w = config.characters[id];
      if (!w) continue;

      const props = keysOrder
        .filter((k) => (w[k] ?? 0) !== 0) // Only include non-zero values
        .map((k) => {
          const val = w[k];
          return `"${k}": ${val}`;
        })
        .join(", ");

      lines.push(`  "${id}": { ${props} },`);
    }

    lines.push("};");

    const code = lines.join("\n");

    try {
      // @ts-expect-error - showSaveFilePicker is not yet in standard lib
      const handle = await window.showSaveFilePicker({
        suggestedName: "statWeights.ts",
        types: [
          {
            description: "TypeScript File",
            accept: { "text/plain": [".ts"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(code);
      await writable.close();
      toast.success("Config saved successfully!");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error(err);
        // Fallback to clipboard if file system API fails or not supported
        navigator.clipboard.writeText(code);
        toast.info("Could not save file. Code copied to clipboard instead.");
      }
    }
  };

  return (
    <div
      className={cn(
        "container flex flex-col gap-3 py-4",
        isDesktop ? "h-full overflow-hidden" : "overflow-y-auto"
      )}
    >
      {/* Punishment Factor Section */}
      <Card className="bg-gradient-card shrink-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-bold text-white">
              {t.ui("accountData.punishmentFactor")}
            </CardTitle>
            <ScoreExplanationDialog />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-white"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {t.ui("accountData.resetGlobal")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t.ui("accountData.resetDefaults")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t.ui("accountData.resetGlobalConfirm")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.ui("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={resetGlobalConfig}>
                  {t.ui("resetConfirmDialog.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 px-4 lg:px-8 pb-4 pt-2">
          {(["flatAtk", "flatHp", "flatDef"] as const).map((key) => (
            <div key={key} className="flex items-center gap-3 max-w-xs">
              <span className="text-sm lg:text-base text-gray-300 w-16 lg:w-20 shrink-0">
                {key === "flatAtk"
                  ? t.ui("accountData.flatAtk")
                  : key === "flatHp"
                    ? t.ui("accountData.flatHp")
                    : t.ui("accountData.flatDef")}
              </span>
              <Slider
                value={[config.global[key]]}
                min={0}
                max={100}
                step={5}
                onValueChange={([val]) => setGlobalWeight(key, val)}
                className="flex-1"
              />
              <span className="font-mono text-foreground font-bold w-10 text-right shrink-0">
                {config.global[key]}%
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Character Weights Section */}
      <Card
        className={cn(
          "flex flex-col bg-gradient-card",
          isDesktop && "flex-1 min-h-0"
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-3">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              {t.ui("accountData.characterWeights")}
              <ScoreExplanationDialog />
            </CardTitle>
            <div className="relative w-48 lg:w-64 hidden lg:block">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.ui("accountData.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 bg-black/20 border-white/10"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-white"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t.ui("accountData.resetCharacters")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t.ui("accountData.resetDefaults")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t.ui("accountData.resetCharactersConfirm")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.ui("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={resetCharacterWeights}>
                    {t.ui("resetConfirmDialog.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {import.meta.env.DEV && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveConfig}
                className="text-muted-foreground hover:text-white hidden lg:flex"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent
          className={cn(
            "p-0 px-4 pb-4",
            isDesktop && "flex-1 min-h-0 overflow-hidden"
          )}
        >
          {/* Desktop: Table View */}
          {isDesktop ? (
            <div className="h-full rounded-md border border-white/10 overflow-hidden bg-gradient-card">
              <ScrollArea className="h-full">
                <Table className="table-fixed">
                  <TableHeader className="bg-black/40 sticky top-0 z-10 backdrop-blur-sm">
                    <TableRow className="hover:bg-transparent border-white/10 text-base">
                      <TableHead className="w-[240px] pl-4">
                        {t.ui("accountData.characters")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t.statShort("atk")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t.statShort("hp")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t.statShort("def")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t.statShort("cr")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t.statShort("cd")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t.statShort("em")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t.statShort("er")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t.statShort("elemental%")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t.statShort("phys%")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t.statShort("heal%")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCharacters.map((char) => (
                      <CharacterWeightRow
                        key={char.id}
                        char={char}
                        weights={config.characters[char.id] || {}}
                        onValueChange={handleValueChange}
                      />
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          ) : (
            /* Mobile: Character Grid View - no internal scroll, page scrolls */
            <div
              className="grid gap-2 p-2"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
              }}
            >
              {filteredCharacters.map((char) => (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => setSelectedCharacter(char)}
                  className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ItemIcon
                    imagePath={char.imagePath}
                    rarity={char.rarity}
                    size="sm"
                  />
                  <span className="text-xs text-muted-foreground text-center line-clamp-1 w-full">
                    {t.character(char.id)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile: Character Weight Dialog */}
      <ResponsiveDialog
        open={selectedCharacter !== null}
        onOpenChange={(open) => !open && setSelectedCharacter(null)}
      >
        <ResponsiveDialogContent className="max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="flex items-center gap-3">
              {selectedCharacter && (
                <>
                  <ItemIcon
                    imagePath={selectedCharacter.imagePath}
                    rarity={selectedCharacter.rarity}
                    size="sm"
                  />
                  {t.character(selectedCharacter.id)}
                </>
              )}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t.ui("accountData.characterWeights")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {selectedCharacter && (
            <div className="space-y-4 py-4">
              {/* Weight sliders for each stat */}
              {[
                { key: "atk", label: t.stat("atk"), isMerged: true },
                { key: "hp", label: t.stat("hp"), isMerged: true },
                { key: "def", label: t.stat("def"), isMerged: true },
                { key: "cr", label: t.stat("cr"), isMerged: false },
                { key: "cd", label: t.stat("cd"), isMerged: false },
                { key: "em", label: t.stat("em"), isMerged: false },
                { key: "er", label: t.stat("er"), isMerged: false },
                {
                  key: elementToStatKey(selectedCharacter.element),
                  label: t.stat(elementToStatKey(selectedCharacter.element)),
                  isMerged: false,
                },
                { key: "phys%", label: t.stat("phys%"), isMerged: false },
                { key: "heal%", label: t.stat("heal%"), isMerged: false },
              ].map(({ key, label, isMerged }) => {
                const weightKey = isMerged ? `${key}%` : key;
                const value =
                  config.characters[selectedCharacter.id]?.[weightKey] ?? 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-24 shrink-0">
                      {label}
                    </span>
                    <Slider
                      value={[value]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={([val]) =>
                        handleValueChange(
                          selectedCharacter.id,
                          key,
                          val,
                          isMerged
                        )
                      }
                      className="flex-1"
                    />
                    <span className="font-mono text-foreground w-10 text-right shrink-0">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

// High-quality interactive cell component
const WeightCell = ({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (val: number) => void;
  label: string;
}) => {
  const [open, setOpen] = useState(false);

  const handlePresetClick = (val: number) => {
    onChange(val);
    setOpen(false);
  };

  const getCellStyles = (val: number) => {
    if (val === 0) return "text-muted-foreground hover:bg-white/5 text-base";
    if (val === 100)
      return "bg-black/20 text-foreground hover:bg-black/30 text-base font-bold";
    return "bg-black/20 text-foreground hover:bg-black/30 text-base";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "h-7 w-[80%] mx-auto flex items-center justify-center rounded cursor-pointer transition-all font-mono text-base",
            getCellStyles(value)
          )}
        >
          {value}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-4 bg-slate-950 border-slate-800 shadow-xl"
        side="top"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              {label}
            </span>
            <span className="text-base font-bold text-amber-100 font-mono">
              {value}%
            </span>
          </div>

          <Slider
            value={[value]}
            min={0}
            max={100}
            step={5}
            onValueChange={([val]) => onChange(val)}
            className="[&_.bg-primary]:bg-amber-500"
          />

          <div className="flex justify-between gap-1">
            {[0, 30, 50, 75, 100].map((preset) => (
              <Button
                key={preset}
                size="sm"
                variant="outline"
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "h-6 flex-1 text-sm px-0 border-slate-700 hover:bg-slate-800 hover:text-white",
                  value === preset &&
                    "bg-amber-500/20 text-amber-100 border-amber-500/50"
                )}
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
