The current damage calculation system has the following limitations:

1. Time-limited buffs default to full uptime. You can fine-tune buff activation per damage segment (toggle on the right side of each damage number). Single-formula mode and combo/rotation mode have independent buff override settings.
2. Stack-limited buffs default to one rotation cycle's worth of stacks, allocated to the most effective damage segments. This may slightly overestimate damage in some cases. You can also adjust buff activation per damage segment.
4. Many combat-related conditions (e.g. HP above/below a threshold) are implemented as selectable options on characters, weapons, or artifacts — only one condition can be selected at a time, with no dynamic adjustment. Arlecchino's normal attacks decay starting from the selected Bond of Life level each rotation.
5. Most skills are treated as on-field damage. Some common off-field skills are treated as off-field damage; certain multi-hit skills may have some hits treated as off-field.
6. Buffs that scale over time, by stacks, or with probability offer both average and max value simulations (e.g. Yelan passive, Ganyu C4 DMG bonus, Durin C4, Echoes of an Offering 4pc, etc.). Mavuika's A4 passive does not account for decay (which would somewhat discount her C4 effect). Xiao's passive is still calculated as an averaged DMG bonus.
7. Damage is calculated for single-target by default. AoE target count and AoE damage falloff are not factored in.
8. Lunar electro-charged/overloaded/superconduct and lunar crystallize/cage damage use pre-computed ranking weights based on team stats without artifacts. The actual ranking may shift slightly once artifacts are equipped, but due to system limitations only pre-ranking is supported.
