import { DEFAULT_RULES, DEFAULT_SEED } from "./constants";
import { applyCausalConsequences, createCausalEvent, ensureWorldState } from "./campaign";
import type {
  Agent,
  CampaignSetupDraft,
  FrontClock,
  RelationshipEdge,
  SetupFaction,
  WorldState,
} from "./types";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function splitScenarioSides(title: string) {
  const parts = title
    .split(/\b(?:vs\.?|versus|against)\b/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length >= 2 ? parts.slice(0, 3) : [];
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function seededChoice<T>(seed: number, values: readonly T[], indexOffset = 0) {
  return values[(seed + indexOffset) % values.length];
}

function inferTheme(title: string, description: string) {
  const source = `${title} ${description}`.toLowerCase();
  if (/(zeus|thunder|storm|god|olymp|sun wu|wukong|myth)/.test(source)) return "mythic";
  if (/(trade|guild|port|merchant|coin)/.test(source)) return "mercantile";
  if (/(siege|war|battle|raid|legion|front)/.test(source)) return "martial";
  if (/(curse|prophet|cult|temple|dream|ritual)/.test(source)) return "occult";
  return "frontier";
}

function temperamentProfile(temperament: SetupFaction["temperament"]) {
  switch (temperament) {
    case "volatile":
      return {
        traits: { aggression: 0.84, diplomacy: 0.28, resourcefulness: 0.62, loyalty: 0.68, adaptability: 0.54 },
        state: { health: 0.92, morale: 0.76, influence: 72, wealth: 70 },
        resources: { food: 90, gold: 80, military: 130 },
      };
    case "diplomatic":
      return {
        traits: { aggression: 0.22, diplomacy: 0.88, resourcefulness: 0.68, loyalty: 0.71, adaptability: 0.73 },
        state: { health: 0.96, morale: 0.81, influence: 78, wealth: 110 },
        resources: { food: 120, gold: 120, military: 55 },
      };
    case "zealous":
      return {
        traits: { aggression: 0.56, diplomacy: 0.35, resourcefulness: 0.55, loyalty: 0.92, adaptability: 0.44 },
        state: { health: 0.9, morale: 0.9, influence: 70, wealth: 60 },
        resources: { food: 85, gold: 65, military: 100 },
      };
    case "cunning":
      return {
        traits: { aggression: 0.4, diplomacy: 0.58, resourcefulness: 0.92, loyalty: 0.63, adaptability: 0.86 },
        state: { health: 0.91, morale: 0.77, influence: 76, wealth: 105 },
        resources: { food: 100, gold: 140, military: 65 },
      };
    default:
      return {
        traits: { aggression: 0.48, diplomacy: 0.52, resourcefulness: 0.72, loyalty: 0.66, adaptability: 0.62 },
        state: { health: 0.94, morale: 0.79, influence: 74, wealth: 95 },
        resources: { food: 110, gold: 100, military: 85 },
      };
  }
}

export function buildFallbackCampaignSetupDraft(title: string, description = ""): CampaignSetupDraft {
  const seed = hashString(`${title}:${description}`);
  const theme = inferTheme(title, description);
  const explicitSides = splitScenarioSides(title);
  const baseNames =
    explicitSides.length >= 2
      ? explicitSides.map((entry) => toTitleCase(entry))
      : [
          toTitleCase(seed % 2 === 0 ? "Ashen Crown" : "Iron Choir"),
          toTitleCase(seed % 3 === 0 ? "Storm Pact" : "Veiled Court"),
          toTitleCase(seed % 5 === 0 ? "Lantern Syndicate" : "Amber March"),
        ].slice(0, 3);

  const temperaments: SetupFaction["temperament"][] = ["volatile", "diplomatic", "cunning", "zealous", "pragmatic"];
  const factions = baseNames.slice(0, Math.min(4, Math.max(2, baseNames.length))).map((name, index) => {
    const id = `faction-${slugify(name) || `f${index + 1}`}`;
    const temperament = seededChoice(seed, temperaments, index);
    return {
      id,
      name,
      identity:
        theme === "mythic"
          ? seededChoice(seed, [
              "claiming divine mandate over the horizon",
              "proving their legend in public catastrophe",
              "dragging old gods into a mortal reckoning",
            ], index)
          : seededChoice(seed, [
              "trying to control the next turning point",
              "holding together a fragile coalition",
              "turning every rumor into leverage",
            ], index),
      goal:
        explicitSides.length >= 2 && index < explicitSides.length
          ? `Break the will of ${baseNames[(index + 1) % baseNames.length]} before the whole frontier is forced to choose sides.`
          : seededChoice(seed, [
              "Seize the initiative before rivals can shape the next session.",
              "Protect their hold over the campaign's most contested route.",
              "Force the map to answer to their terms.",
            ], index + 2),
      temperament,
    };
  });

  const actors = factions.flatMap((faction, index) => {
    const leaderName =
      explicitSides.length >= 2 && index < explicitSides.length
        ? faction.name
        : seededChoice(seed, ["Marshal", "Oracle", "Warden", "Mistress", "Prince"], index) +
          " " +
          faction.name.split(" ")[0];

    return [
      {
        id: `actor-${slugify(faction.name)}-lead`,
        name: leaderName,
        type: theme === "mythic" ? "champion" : "leader",
        factionId: faction.id,
        role: "Commanding figure",
        goal: faction.goal,
      },
      {
        id: `actor-${slugify(faction.name)}-voice`,
        name: `${faction.name.split(" ")[0]} ${seededChoice(seed, ["Envoy", "Herald", "Spymaster", "Keeper"], index)}`,
        type: faction.temperament === "diplomatic" ? "diplomat" : faction.temperament === "cunning" ? "intelligence" : "operator",
        factionId: faction.id,
        role: "Pressure point and political instrument",
        goal: `Keep ${faction.name} ahead of the fallout spreading across the campaign map.`,
      },
    ];
  }).slice(0, 6);

  const regionKinds = ["homeland", "frontier", "city-state", "wilds"] as const;
  const regions = factions.map((faction, index) => ({
    id: `region-${slugify(faction.name)}`,
    name:
      explicitSides.length >= 2 && index < explicitSides.length
        ? `${faction.name} Front`
        : `${faction.name.split(" ")[0]} Reach`,
    kind: seededChoice(seed, regionKinds, index),
    controllingFactionId: faction.id,
    summary: seededChoice(seed, [
      "A pressure point where every rumor becomes strategy.",
      "A seat of power that cannot afford a visible loss.",
      "The route-rich edge where the next session could ignite.",
    ], index + 4),
  }));

  const routes = regions.slice(0, Math.max(1, regions.length - 1)).map((region, index) => ({
    id: `route-${region.id}-${regions[(index + 1) % regions.length].id}`,
    name: `${region.name} Passage`,
    fromRegionId: region.id,
    toRegionId: regions[(index + 1) % regions.length].id,
    controllingFactionId: region.controllingFactionId,
    risk: 0.2 + ((seed + index) % 4) * 0.12,
    summary: seededChoice(seed, [
      "The fastest path for reinforcements, rumors, and reprisals.",
      "A supply artery everyone claims and no one fully secures.",
      "The route that decides who arrives first when the world tilts.",
    ], index + 6),
  }));

  const fronts = [
    {
      id: `front-${factions[0].id}-${factions[1].id}`,
      name: `${factions[0].name} vs ${factions[1].name}`,
      regionId: regions[0].id,
      factionId: factions[0].id,
      opposingFactionId: factions[1].id,
      stakes: explicitSides.length >= 2
        ? `If neither side yields, the table inherits a mythic feud with collateral damage across the frontier.`
        : `Whoever controls this pressure point decides the tone of the next campaign turn.`,
      pressure: 0.48,
      progress: 0.32,
    },
    ...(factions[2]
      ? [
          {
            id: `front-${factions[2].id}-${factions[0].id}`,
            name: `${factions[2].name} tests ${factions[0].name}`,
            regionId: regions[2]?.id ?? regions[0].id,
            factionId: factions[2].id,
            opposingFactionId: factions[0].id,
            stakes: "A third power is deciding whether to exploit the conflict or survive it.",
            pressure: 0.38,
            progress: 0.24,
          },
        ]
      : []),
  ];

  const incitingEvent = {
    type: theme === "mythic" || theme === "martial" ? "conflict" as const : "injected" as const,
    description:
      explicitSides.length >= 2
        ? `${baseNames[0]} and ${baseNames[1]} collide in public, forcing every frontier power to answer the question of who holds authority now.`
        : seededChoice(seed, [
            "A high-profile strike tears open the illusion of stability and makes neutrality feel temporary.",
            "A public betrayal on the main route forces every faction to reveal what they actually want.",
            "A sacred warning becomes a political crisis the moment armed escorts arrive too late.",
          ]),
    regionId: regions[0]?.id ?? null,
    frontId: fronts[0]?.id ?? null,
    routeIds: routes.slice(0, 2).map((route) => route.id),
    stakes: "The first consequence should immediately change what the GM expects to prep next session.",
  };

  return {
    title,
    premise:
      description.trim() ||
      (explicitSides.length >= 2
        ? `A campaign opener where ${baseNames[0]} and ${baseNames[1]} force the map into a visible, irreversible crisis.`
        : "A GM-first pressure cooker where factions, routes, and hot fronts begin shifting from a single catalytic change."),
    factions,
    actors,
    regions,
    routes,
    fronts,
    incitingEvent,
    generatedBy: "fallback",
  };
}

function buildRegionPositions(count: number) {
  const center = { x: 450, y: 310 };
  const radius = count <= 2 ? 180 : count === 3 ? 195 : 215;

  return Array.from({ length: count }, (_, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / count;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * (radius * 0.78),
    };
  });
}

function buildRelationships(actors: Agent[], fronts: FrontClock[]): RelationshipEdge[] {
  const frontPairs = new Set(
    fronts
      .filter((front) => front.factionId && front.opposingFactionId)
      .flatMap((front) => [
        `${front.factionId}::${front.opposingFactionId}`,
        `${front.opposingFactionId}::${front.factionId}`,
      ])
  );

  const relationships: RelationshipEdge[] = [];
  for (let sourceIndex = 0; sourceIndex < actors.length; sourceIndex++) {
    for (let targetIndex = sourceIndex + 1; targetIndex < actors.length; targetIndex++) {
      const source = actors[sourceIndex];
      const target = actors[targetIndex];
      const allied = source.factionId === target.factionId;
      const contested = frontPairs.has(`${source.factionId}::${target.factionId}`);

      relationships.push({
        id: `rel-${source.id}-${target.id}`,
        sourceAgentId: source.id,
        targetAgentId: target.id,
        trust: allied ? 0.72 : contested ? -0.44 : 0.08,
        influence: allied ? 0.55 : contested ? 0.33 : 0.22,
        tension: allied ? 0.12 : contested ? 0.71 : 0.34,
        lastUpdatedTick: 0,
      });
    }
  }

  return relationships;
}

export function materializeCampaignSetupDraft(
  draft: CampaignSetupDraft,
  existingState?: Partial<WorldState>
): WorldState {
  const seedState = ensureWorldState({
    tick: 0,
    agents: [],
    relationships: [],
    campaignNodes: [],
    map: {
      id: "map-main",
      name: "Campaign Map",
      regions: [],
      sites: [],
      routes: [],
      tokens: [],
    },
    fronts: [],
    projections: [],
    gmNotes: [],
    events: [],
    activeModifiers: [],
    rules: existingState?.rules ?? { ...DEFAULT_RULES },
    seed: existingState?.seed ?? DEFAULT_SEED,
  });

  const regionPositions = buildRegionPositions(draft.regions.length);
  const regionRadius = draft.regions.length <= 2 ? 118 : draft.regions.length === 3 ? 108 : 96;

  const map = {
    id: "map-main",
    name: "Campaign Map",
    regions: draft.regions.map((region, index) => ({
      id: region.id,
      name: region.name,
      kind: region.kind,
      center: regionPositions[index] ?? { x: 450, y: 310 },
      radius: regionRadius,
      controllingFactionId: region.controllingFactionId,
      supply: 0.62 - index * 0.04,
      stability: 0.66 - index * 0.05,
      threat: 0.22 + index * 0.06,
      visibility: "visible" as const,
      tags: ["setup-generated"],
    })),
    sites: draft.regions.map((region, index) => ({
      id: `site-${region.id}-capital`,
      name: `${region.name} Seat`,
      kind: "capital" as const,
      regionId: region.id,
      position: { x: (regionPositions[index]?.x ?? 450) + 8, y: (regionPositions[index]?.y ?? 310) + 12 },
      controllingFactionId: region.controllingFactionId,
      status: "stable" as const,
      tags: ["setup-generated", "capital"],
    })),
    routes: [] as WorldState["map"]["routes"],
    tokens: [] as WorldState["map"]["tokens"],
  };

  map.routes = draft.routes.map((route) => {
    const fromSite = map.sites.find((site) => site.regionId === route.fromRegionId);
    const toSite = map.sites.find((site) => site.regionId === route.toRegionId);
    return {
      id: route.id,
      name: route.name,
      fromSiteId: fromSite?.id ?? map.sites[0]?.id ?? "",
      toSiteId: toSite?.id ?? map.sites[1]?.id ?? map.sites[0]?.id ?? "",
      controllingFactionId: route.controllingFactionId,
      status: "open" as const,
      risk: route.risk,
      integrity: 0.84,
      traffic: 0.62,
      tags: ["setup-generated"],
    };
  });

  map.tokens = [
    ...map.regions.map((region) => ({
      id: `token-${region.id}`,
      name: `${region.name} Watch`,
      kind: "faction" as const,
      factionId: region.controllingFactionId,
      regionId: region.id,
      siteId: map.sites.find((site) => site.regionId === region.id)?.id ?? null,
      position: { x: region.center.x + 20, y: region.center.y - 18 },
      visible: true,
      status: "ready" as const,
    })),
    {
      id: "token-party-main",
      name: "Party Vanguard",
      kind: "party" as const,
      factionId: null,
      regionId: map.regions[0]?.id ?? null,
      siteId: map.sites[0]?.id ?? null,
      position: { x: (map.sites[0]?.position.x ?? 420) - 24, y: (map.sites[0]?.position.y ?? 300) + 18 },
      visible: true,
      status: "ready" as const,
    },
  ];

  const factionLookup = new Map(draft.factions.map((faction) => [faction.id, faction]));
  const actors: Agent[] = draft.actors.map((actor, index) => {
    const faction = factionLookup.get(actor.factionId);
    const profile = temperamentProfile(faction?.temperament ?? "pragmatic");
    const region = map.regions.find((candidate) => candidate.controllingFactionId === actor.factionId) ?? map.regions[index % Math.max(map.regions.length, 1)];
    const angle = (Math.PI * 2 * index) / Math.max(draft.actors.length, 1);
    return {
      id: actor.id,
      name: actor.name,
      type: actor.type,
      factionId: actor.factionId,
      goals: [
        { id: `goal-${actor.id}`, label: actor.goal, priority: 0.86, progress: 0.12, status: "active" as const },
      ],
      traits: profile.traits,
      state: profile.state,
      resources: profile.resources,
      memory: [],
      activeIntent: null,
      intentHistory: [],
      position: {
        x: (region?.center.x ?? 450) + Math.cos(angle) * 30,
        y: (region?.center.y ?? 310) + Math.sin(angle) * 24,
      },
      status: "alive" as const,
    };
  });

  const fronts: FrontClock[] = draft.fronts.map((front) => ({
    id: front.id,
    name: front.name,
    regionId: front.regionId,
    factionId: front.factionId,
    opposingFactionId: front.opposingFactionId,
    pressure: front.pressure,
    progress: front.progress,
    status: "quiet",
    stakes: front.stakes,
    lastAdvancedTick: 0,
  }));

  const baseState = ensureWorldState({
    ...seedState,
    tick: 0,
    agents: actors,
    relationships: buildRelationships(actors, fronts),
    map,
    fronts,
    gmNotes: [
      {
        id: "note-setup-premise",
        tick: 0,
        title: "Campaign Premise",
        content: draft.premise,
        linkedEventId: null,
        linkedRegionId: draft.regions[0]?.id ?? null,
        linkedSiteId: null,
        linkedFrontId: draft.fronts[0]?.id ?? null,
        tags: ["setup", draft.generatedBy],
        status: "open",
      },
    ],
    events: [],
  });

  const event = createCausalEvent(baseState, {
    tick: 1,
    type: draft.incitingEvent.type,
    description: draft.incitingEvent.description,
    actorIds: actors.slice(0, 2).map((actor) => actor.id),
    targetIds: actors.slice(2, 4).map((actor) => actor.id),
    affects: [
      ...(draft.incitingEvent.regionId ? [draft.incitingEvent.regionId] : []),
      ...(draft.incitingEvent.frontId ? [draft.incitingEvent.frontId] : []),
      ...draft.incitingEvent.routeIds,
      ...draft.factions.map((faction) => faction.id),
    ],
    impact: [],
    confidence: 0.94,
    tags: ["setup", "inciting", draft.generatedBy],
    metadata: {
      generatedBy: draft.generatedBy,
      note: draft.incitingEvent.stakes,
      noteTitle: "Inciting Consequence",
    },
    sequence: 0,
  });

  const appliedState = ensureWorldState({
    ...baseState,
    tick: event.tick,
    events: [...baseState.events, event],
  });

  return ensureWorldState(applyCausalConsequences(appliedState, event));
}
