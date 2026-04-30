export const RANKS = ["Common", "Rare", "Epic", "Legendary", "Mythic"] as const;
export const RANK_COLORS = ["#d6e4ff", "#66d9ff", "#b180ff", "#ff9d48", "#ff5fd2"] as const;
export const WEAPON_SHAPES = ["orb", "bolt", "saw"] as const;
export const SUMMON_COST = 12;
export const MAX_WEAPON_RANK = RANKS.length - 1;

export type RankLabel = (typeof RANKS)[number];
export type WeaponShape = (typeof WEAPON_SHAPES)[number];
export type WeaponType = WeaponShape | "joker";

export type RollTableEntry = {
  limit: number;
  rank: number;
  isJoker: boolean;
};

export type WeaponDefinition = {
  key: WeaponShape;
  name: string;
  description: string;
  baseDamage: number;
  baseCooldown: number;
  size: number;
  orbitRadius: number;
  projectileSpeed: number;
  hue: string;
};

export const ROLL_TABLE: RollTableEntry[] = [
  { limit: 0.004, rank: 0, isJoker: true },
  { limit: 0.006, rank: 4, isJoker: false },
  { limit: 0.05, rank: 3, isJoker: false },
  { limit: 0.2, rank: 2, isJoker: false },
  { limit: 0.5, rank: 1, isJoker: false },
  { limit: 1, rank: 0, isJoker: false },
];

export const WEAPON_DEFINITIONS: Record<WeaponShape, WeaponDefinition> = {
  orb: {
    key: "orb",
    name: "Orb",
    description: "Spins around the player and shreds nearby enemies.",
    baseDamage: 18,
    baseCooldown: 0.14,
    size: 10,
    orbitRadius: 68,
    projectileSpeed: 0,
    hue: "#72f6ff",
  },
  bolt: {
    key: "bolt",
    name: "Bolt",
    description: "Fires piercing shots at the closest enemy.",
    baseDamage: 22,
    baseCooldown: 0.8,
    size: 7,
    orbitRadius: 0,
    projectileSpeed: 470,
    hue: "#ffd166",
  },
  saw: {
    key: "saw",
    name: "Saw",
    description: "Cuts a tight circle around the player with burst hits.",
    baseDamage: 14,
    baseCooldown: 0.09,
    size: 12,
    orbitRadius: 42,
    projectileSpeed: 0,
    hue: "#ff7b94",
  },
};
