export type NarrativeStyle = "cinematic" | "military";

export interface NarrativeTemplate {
  key: string;
  cinematic: string;
  military: string;
}

export const NARRATIVE_TEMPLATES: NarrativeTemplate[] = [
  {
    key: "battle_with_defense_and_death",
    cinematic: "{attacker} launched a savage assault on {target}, but {defender} stepped in to protect them. The clash turned brutal—{defender} fell protecting {target}, their sacrifice in vain.",
    military: "Unit {attacker} initiated offensive operation against {target}. Defensive unit {defender} intercepted. {defender} was neutralized in the exchange.",
  },
  {
    key: "battle_with_defense_survived",
    cinematic: "{attacker} pressed the assault on {target}, but {defender} stepped in to defend. The battle raged—{defender} held the line, but at what cost?",
    military: "Unit {attacker} engaged {target}. Defensive unit {defender} intercepted. Defensive position maintained after exchange.",
  },
  {
    key: "battle_without_defense",
    cinematic: "{attacker} struck {target} with brutal force, a devastating blow that shook the battlefield.",
    military: "Unit {attacker} executed strike on {target}. Target took direct hit.",
  },
  {
    key: "defender_intercepts",
    cinematic: "{defender} suddenly intercepted {attacker}'s attack on {target}, turning the tide of battle!",
    military: "Defensive unit {defender} intercepted attack on {target}. Engagement initiated.",
  },
  {
    key: "agent_fell",
    cinematic: "{victim} fell in battle, their story ending in blood and glory.",
    military: "Unit {victim} was neutralized.",
  },
  {
    key: "alliance_broken",
    cinematic: "Trust shattered between {actor} and {target}. The bond that once held now lies in ruins.",
    military: "Alliance terminated between unit {actor} and {target}. Cooperation status: terminated.",
  },
  {
    key: "conflict_emerged",
    cinematic: "Tension escalated into open hostility between {actor} and {target}. The powder keg ignited.",
    military: "Hostility detected between {actor} and {target}. Operational status changed to adversarial.",
  },
  {
    key: "standoff",
    cinematic: "The battlefield held its breath—neither side could gain ground.",
    military: "Engagement reached stalemate. No ground gained by either party.",
  },
  {
    key: "victory",
    cinematic: "{winner} emerged victorious, standing alone upon the blood-soaked earth.",
    military: "Unit {winner} achieved operational victory. Enemy forces eliminated.",
  },
  {
    key: "mutual_destruction",
    cinematic: "The battle consumed them all—only silence remains where once there was war.",
    military: "Mutual destruction confirmed. All units neutralized.",
  },
  {
    key: "spawn",
    cinematic: "{actor} entered the fray, ready for war.",
    military: "Unit {actor} deployed to operational zone.",
  },
  {
    key: "hold_position",
    cinematic: "{actor} held their ground, watching and waiting.",
    military: "Unit {actor} holding position. Observation active.",
  },
  {
    key: "no_target",
    cinematic: "{actor} searched for an enemy, but found none.",
    military: "Unit {actor}: no valid targets identified.",
  },
];

export const MEMORY_TEMPLATES = {
  lastLostAlly: {
    cinematic: "{agent}, still reeling from {ally}'s fall, {action}",
    military: "Unit {agent}, reporting loss of {ally}, {action}",
  },
  lastVictory: {
    cinematic: "{agent}, emboldened by {victim}'s defeat, {action}",
    military: "Unit {agent}, tactical advantage established, {action}",
  },
  lastAttacked: {
    cinematic: "{agent}, still nursing wounds from {attacker}'s strike, {action}",
    military: "Unit {agent}, recovering from {attacker} engagement, {action}",
  },
};

export function getTemplate(key: string, style: NarrativeStyle): string {
  const template = NARRATIVE_TEMPLATES.find((t) => t.key === key);
  if (!template) {
    return style === "cinematic"
      ? "A battle unfolded on the field."
      : "Engagement in progress.";
  }
  return style === "cinematic" ? template.cinematic : template.military;
}

export function fillTemplate(
  template: string,
  params: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}
