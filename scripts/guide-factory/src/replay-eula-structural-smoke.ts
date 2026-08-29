import { replayTeamDamage } from "./computationReplay";
import { EULA_STRUCTURAL_SMOKE } from "./eulaStructuralSmoke";
import { stableJson } from "./io";

const result = await replayTeamDamage(EULA_STRUCTURAL_SMOKE);
process.stdout.write(stableJson(result));
