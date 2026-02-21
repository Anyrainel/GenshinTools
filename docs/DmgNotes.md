ResMult = 
    1 - Res / 2 (if res <= 0%)
    1 - Res (if res bewteen 0% and 75%)
    1 / (4*Res + 1) (if res >= 75%)

DefMult =
    (CharLv + 100) / [(CharLv + 100) + (EnemyLv + 100) × (1 - defReduction%) × (1 - defIgnore%)]

CritMult =
    1 + cd% (if critical hit)
    1 (if no critical hit)

CritMultExpected =
    1 + cr% x cd%

BaseDamage = 
    Σ(ScalingStat × TalentMult%)

Normal Damage =
    (BaseDamage + CatalyzeDamage + FlatDamageBonus)
    x (1 + dmg% + dmgTaken% - dmgReduction%)
    x ResMult x DefMult x CritMult
    x AmplifyingMult

lunarEmBonus% =
    6 x em / (em + 2000)

Lunar Crystallize Direct Damage =
    [1.6 x BaseDamage x (1 + baseDmg%) x (1 + lunarEmBonus% + lunarDmg%) + flagDamageBonus]
    x ResMult x CritMult
    x (1 + Elevated%)

Lunar Crystallize Reaction Damage (individual) =
    1446.85 x 0.96 x (1 + baseDmg%)
    x (1 + lunarEmBonus% + lunarDmg%)
    x ResMult x CritMult
    x (1 + Elevated%)

Lunar Charged / Crystallize Reaction Damage (final) =
    #1 individual damage + #2 damage x 1/2 + #3 damage x 1/12 + #4 damage x 1/12

Lunar Charged Direct Damage =
    [3 x BaseDamage x (1 + baseDmg%) x (1 + lunarEmBonus% + lunarDmg%) + flagDamageBonus]
    x ResMult x CritMult
    x (1 + Elevated%)

// It seems no mechanism can provide flagDamageBonus for Lunar Charged Direct Damage yet.

Lunar Charged Reaction Damage (individual) =
    1446.85 x 1.8 x (1 + baseDmg%)
    x (1 + lunarEmBonus% + lunarDmg%)
    x ResMult x CritMult
    x (1 + Elevated%)

Lunar Bloom Direct Damage =
    [1 x BaseDamage x (1 + baseDmg%) x (1 + lunarEmBonus% + lunarDmg%) + flagDamageBonus]
    x ResMult x CritMult
    x (1 + Elevated%)

bloomEmBonus% =
    16 x em / (em + 2000)

Dendro Core Damage (Same for Bloom or Lunar Bloom) =
    1446.85 x reactionCoeff
    x (1 + bloomEmBonus% + reactionDmg%)
    x ResMult x ReactionCritMult

quickenEmBonus% =
    5 x em / (em + 1200)

Quicken: 1 Electro + 1 Dendro = 1 Quicken element, last for (6 + 5 x QuickenAmount) seconds
    aggravate = 1446.85 x 1.15 x (1 + quickenEmBonus% + reactionDmg%)