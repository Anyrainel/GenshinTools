import { ArtifactSetConfigs, MainStatPlus, SubStat, Build, BuildGroup, Language, SetConfig, SlotConfig } from '../data/types';
import { charactersById, artifactHalfSetsById } from '../data/constants';

interface PrintOptions {
  t: {
    artifact: (id: string) => string;
    artifactFirstEffect: (id: string) => string;
    character: (id: string) => string;
    statShort: (key: string) => string;
    ui: (path: string) => string;
  };
  language: Language;
}

/**
 * Generates markdown content for a single artifact configuration
 */
function generateConfigMarkdown(
  config: SetConfig,
  configNumber: number,
  options: PrintOptions
): string {
  const { t } = options;
  let markdown = '';

  // Configuration header
  markdown += `### ${t.ui('computeFilters.configurationNumber')} ${configNumber}\n\n`;

  // Characters section

  // Group characters by 4pc/2pc and perfect/imperfect
  const fourPcPerfect = config.servedCharacters.filter(c => c.has4pcBuild && c.hasPerfectMerge);
  const fourPcImperfect = config.servedCharacters.filter(c => c.has4pcBuild && !c.hasPerfectMerge);
  const twoPcPerfect = config.servedCharacters.filter(c => !c.has4pcBuild && c.hasPerfectMerge);
  const twoPcImperfect = config.servedCharacters.filter(c => !c.has4pcBuild && !c.hasPerfectMerge);

  // 4pc characters
  if (fourPcPerfect.length > 0 || fourPcImperfect.length > 0) {
    markdown += `- **${t.ui('computeFilters.fourPc')}:** `;
    const fourPcNames = [
      ...fourPcPerfect.map(c => {
        const char = charactersById[c.characterId];
        return char ? t.character(char.id) : c.characterId;
      }),
      ...fourPcImperfect.map(c => {
        const char = charactersById[c.characterId];
        const name = char ? t.character(char.id) : c.characterId;
        return `${name}^`;
      })
    ];
    markdown += fourPcNames.join(', ') + '\n';
  }

  // 2pc characters
  if (twoPcPerfect.length > 0 || twoPcImperfect.length > 0) {
    markdown += `- **${t.ui('computeFilters.twoPc')}:** `;
    const twoPcNames = [
      ...twoPcPerfect.map(c => {
        const char = charactersById[c.characterId];
        return char ? t.character(char.id) : c.characterId;
      }),
      ...twoPcImperfect.map(c => {
        const char = charactersById[c.characterId];
        const name = char ? t.character(char.id) : c.characterId;
        return `${name}^`;
      })
    ];
    markdown += twoPcNames.join(', ') + '\n';
  }

  markdown += '\n';

  // Helper to check if flat HP/ATK in substats
  const hasHpFlat = config.flowerPlume.substats.includes('hp');
  const hasAtkFlat = config.flowerPlume.substats.includes('atk');
  const needsSeparateFlowerPlume = hasHpFlat || hasAtkFlat;

  // Helper to get adjusted slot display
  const getSlotDisplay = (slotConfig: SlotConfig, fixedMainStats?: MainStatPlus[]) => {
    const mainStats = fixedMainStats || slotConfig.mainStats;
    const defaultResult = {
      minCount: slotConfig.minStatCount,
      substats: slotConfig.substats
    };

    if (mainStats.length === 1) {
      const singleMainStat = mainStats[0];
      if (slotConfig.substats.includes(singleMainStat as SubStat)) {
        const overlapStat = singleMainStat as SubStat;
        return {
          minCount: slotConfig.minStatCount - 1,
          substats: slotConfig.substats.filter(stat => stat !== overlapStat)
        };
      }
    }

    return defaultResult;
  };

  const flowerSlot = getSlotDisplay(config.flowerPlume, ['hp']);
  const plumeSlot = getSlotDisplay(config.flowerPlume, ['atk']);
  const sandsSlot = getSlotDisplay(config.sands);
  const gobletSlot = getSlotDisplay(config.goblet);
  const circletSlot = getSlotDisplay(config.circlet);

  // Stats table
  markdown += '| Slot | Main Stat | Sub Stats |\n';
  markdown += '|---  -|-----------|-----------|\n';

  // Flower/Plume
  if (needsSeparateFlowerPlume) {
    markdown += `| F | --- | ${flowerSlot.substats.map(s => t.statShort(s)).join(', ')} [>= ${flowerSlot.minCount}] |\n`;
    markdown += `| P | --- | ${plumeSlot.substats.map(s => t.statShort(s)).join(', ')} [>= ${plumeSlot.minCount}] |\n`;
  } else {
    markdown += `| F/P | --- | ${config.flowerPlume.substats.map(s => t.statShort(s)).join(', ')} [>= ${config.flowerPlume.minStatCount}] |\n`;
  }

  // Sands
  const sandsMain = config.sands.mainStats.length > 0
    ? config.sands.mainStats.map(s => t.statShort(s)).join(', ')
    : t.ui('computeFilters.any');
  markdown += `| S | ${sandsMain} | ${sandsSlot.substats.map(s => t.statShort(s)).join(', ')} [>= ${sandsSlot.minCount}] |\n`;

  // Goblet
  const gobletMain = config.goblet.mainStats.length > 0
    ? config.goblet.mainStats.map(s => t.statShort(s)).join(', ')
    : t.ui('computeFilters.any');
  markdown += `| G | ${gobletMain} | ${gobletSlot.substats.map(s => t.statShort(s)).join(', ')} [>= ${gobletSlot.minCount}] |\n`;

  // Circlet
  const circletMain = config.circlet.mainStats.length > 0
    ? config.circlet.mainStats.map(s => t.statShort(s)).join(', ')
    : t.ui('computeFilters.any');
  markdown += `| C | ${circletMain} | ${circletSlot.substats.map(s => t.statShort(s)).join(', ')} [>= ${circletSlot.minCount}] |\n`;

  markdown += '\n';

  return markdown;
}

/**
 * Generates markdown content for a single artifact set with all its configurations
 */
export function generateArtifactSetMarkdown(
  filter: ArtifactSetConfigs,
  options: PrintOptions
): string {
  const { t } = options;
  let markdown = '';

  // Artifact set name
  markdown += `## ${t.artifact(filter.setId)}\n\n`;

  // Generate markdown for each configuration
  filter.configurations.forEach((config, index) => {
    markdown += generateConfigMarkdown(config, index + 1, options);
  });

  return markdown;
}

/**
 * Generates markdown for a single build in compact format
 */
function generateBuildMarkdown(build: Build, options: PrintOptions): string {
  const { t, language } = options;

  // Artifact set info
  let setInfo = '';
  if (build.composition === '4pc' && build.artifactSet) {
    const setName = t.artifact(build.artifactSet);
    setInfo = `**Set:** ${setName}`;
  } else if (build.composition === '2pc+2pc' && build.halfSet1 !== undefined && build.halfSet2 !== undefined) {
    const halfSet1 = artifactHalfSetsById[build.halfSet1];
    const halfSet2 = artifactHalfSetsById[build.halfSet2];
    if (halfSet1 && halfSet2) {
      // Get effect text based on language
      const effect1 = language === 'en' ? halfSet1.normalizedEffectTextEn : halfSet1.normalizedEffectTextZh;
      const effect2 = language === 'en' ? halfSet2.normalizedEffectTextEn : halfSet2.normalizedEffectTextZh;
      setInfo = `**Half:** ${effect1} + ${effect2}`;
    }
  }

  // Stats in compact format
  const sandsStr = build.sands.length > 0 ? build.sands.map(s => t.statShort(s)).join('/') : 'Any';
  const gobletStr = build.goblet.length > 0 ? build.goblet.map(s => t.statShort(s)).join('/') : 'Any';
  const circletStr = build.circlet.length > 0 ? build.circlet.map(s => t.statShort(s)).join('/') : 'Any';
  const substatsStr = build.substats.map(s => t.statShort(s)).join(',');

  const statsInfo = `S: ${sandsStr} | G: ${gobletStr} | C: ${circletStr} | Sub: ${substatsStr}`;

  // K override if present
  const kInfo = build.kOverride !== undefined ? ` _(k=${build.kOverride})_` : '';

  return `  - ${build.name}: ${setInfo} | ${statsInfo} ${kInfo}\n`;
}

/**
 * Generates markdown for builds appendix
 */
function generateBuildsAppendix(characterBuilds: BuildGroup[], options: PrintOptions): string {
  const { t } = options;
  let markdown = '';

  markdown += `---\n\n`;
  markdown += `# Appendix: Character Builds\n\n`;

  characterBuilds
    .filter(group => !group.hidden)
    .forEach(group => {
      const character = charactersById[group.characterId];
      const characterName = character ? t.character(character.id) : group.characterId;

      markdown += `## ${characterName}\n\n`;

      const visibleBuilds = group.builds.filter(b => b.visible);
      visibleBuilds.forEach(build => {
        markdown += generateBuildMarkdown(build, options);
      });

      markdown += '\n';
    });

  return markdown;
}

/**
 * Generates markdown content for all artifact sets
 */
export function generateAllArtifactsMarkdown(
  filters: ArtifactSetConfigs[],
  characterBuilds: BuildGroup[],
  options: PrintOptions
): string {
  let markdown = '';

  // Document title
  markdown += `# Artifact Filter Configurations\n\n`;
  markdown += `_Generated on ${new Date().toLocaleDateString()}_\n\n`;
  markdown += `---\n\n`;

  // Generate markdown for each artifact set
  filters.forEach((filter, index) => {
    markdown += generateArtifactSetMarkdown(filter, options);
    if (index < filters.length - 1) {
      markdown += `---\n\n`;
    }
  });

  // Add builds appendix
  if (characterBuilds.length > 0) {
    markdown += generateBuildsAppendix(characterBuilds, options);
  }

  return markdown;
}

/**
 * Downloads markdown content as a file
 */
export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
