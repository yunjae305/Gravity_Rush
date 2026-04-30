import {
  MAX_WEAPON_RANK,
  RANK_COLORS,
  RANKS,
  ROLL_TABLE,
  WEAPON_DEFINITIONS,
  WEAPON_SHAPES,
  type RankLabel,
  type WeaponShape,
  type WeaponType,
} from "./gameData";

export type WeaponInstance = {
  id: number;
  type: WeaponType;
  rank: number;
  isJoker: boolean;
};

export type WeaponRoll = {
  rank: number;
  rankLabel: RankLabel;
  rankColor: string;
  type: WeaponType;
  isJoker: boolean;
};

export type MergeLog = {
  type: WeaponShape;
  nextRank: number;
  usedJoker: boolean;
};

export type WeaponStats = {
  name: string;
  rankLabel: RankLabel;
  rankColor: string;
  damage: number;
  cooldown: number;
  size: number;
  orbitRadius: number;
  projectileSpeed: number;
  hue: string;
  isJoker: boolean;
};

function findRoll(randomValue: number) {
  return ROLL_TABLE.find((entry) => randomValue < entry.limit) ?? ROLL_TABLE[ROLL_TABLE.length - 1];
}

function pickWeaponShape(randomValue: number) {
  const index = Math.floor(randomValue * WEAPON_SHAPES.length) % WEAPON_SHAPES.length;
  return WEAPON_SHAPES[index];
}

function getNextId(weapons: WeaponInstance[], nextId?: number) {
  if (typeof nextId === "number") {
    return nextId;
  }
  return weapons.reduce((highest, weapon) => Math.max(highest, weapon.id), 0) + 1;
}

export function getRankLabel(rank: number) {
  return RANKS[Math.max(0, Math.min(MAX_WEAPON_RANK, rank))];
}

export function getRankColor(rank: number) {
  return RANK_COLORS[Math.max(0, Math.min(MAX_WEAPON_RANK, rank))];
}

export function getWeaponName(type: WeaponType) {
  if (type === "joker") {
    return "Joker";
  }
  return WEAPON_DEFINITIONS[type].name;
}

export function getWeaponLabel(weapon: WeaponInstance) {
  return `${getRankLabel(weapon.rank)} ${getWeaponName(weapon.type)}`;
}

export function getWeaponStats(weapon: WeaponInstance): WeaponStats {
  if (weapon.isJoker || weapon.type === "joker") {
    return {
      name: "Joker",
      rankLabel: getRankLabel(weapon.rank),
      rankColor: getRankColor(weapon.rank),
      damage: 0,
      cooldown: 0,
      size: 12 + weapon.rank * 2,
      orbitRadius: 28 + weapon.rank * 4,
      projectileSpeed: 0,
      hue: "#f9f871",
      isJoker: true,
    };
  }

  const definition = WEAPON_DEFINITIONS[weapon.type];
  const multiplier = 1 + weapon.rank * 0.65;

  return {
    name: definition.name,
    rankLabel: getRankLabel(weapon.rank),
    rankColor: getRankColor(weapon.rank),
    damage: Math.round(definition.baseDamage * multiplier),
    cooldown: Math.max(0.05, definition.baseCooldown - weapon.rank * 0.03),
    size: definition.size + weapon.rank * 1.5,
    orbitRadius: definition.orbitRadius + weapon.rank * 8,
    projectileSpeed: definition.projectileSpeed + weapon.rank * 35,
    hue: definition.hue,
    isJoker: false,
  };
}

export function rollWeaponDrop(randomValue = Math.random): WeaponRoll {
  const result = findRoll(randomValue());
  const type = result.isJoker ? "joker" : pickWeaponShape(randomValue());

  return {
    rank: result.rank,
    rankLabel: RANKS[result.rank],
    rankColor: RANK_COLORS[result.rank],
    type,
    isJoker: result.isJoker,
  };
}

export function createWeaponFromRoll(id: number, roll: WeaponRoll): WeaponInstance {
  return {
    id,
    type: roll.type,
    rank: roll.rank,
    isJoker: roll.isJoker,
  };
}

type MergeCandidate = {
  firstIndex: number;
  secondIndex: number;
  type: WeaponShape;
  rank: number;
  usedJoker: boolean;
};

function findMergeCandidate(weapons: WeaponInstance[]): MergeCandidate | null {
  for (let rank = 0; rank < MAX_WEAPON_RANK; rank += 1) {
    const jokerIndexes: number[] = [];

    for (let index = 0; index < weapons.length; index += 1) {
      const weapon = weapons[index];
      if (weapon.rank === rank && weapon.isJoker) {
        jokerIndexes.push(index);
      }
    }

    for (const type of WEAPON_SHAPES) {
      const matchingIndexes: number[] = [];

      for (let index = 0; index < weapons.length; index += 1) {
        const weapon = weapons[index];
        if (!weapon.isJoker && weapon.type === type && weapon.rank === rank) {
          matchingIndexes.push(index);
        }
      }

      if (matchingIndexes.length >= 2) {
        return {
          firstIndex: matchingIndexes[0],
          secondIndex: matchingIndexes[1],
          type,
          rank,
          usedJoker: false,
        };
      }

      if (matchingIndexes.length >= 1 && jokerIndexes.length >= 1) {
        return {
          firstIndex: matchingIndexes[0],
          secondIndex: jokerIndexes[0],
          type,
          rank,
          usedJoker: true,
        };
      }
    }
  }

  return null;
}

export function mergeWeapons(weapons: WeaponInstance[], nextId?: number) {
  const nextWeapons = [...weapons];
  const logs: MergeLog[] = [];
  let currentId = getNextId(nextWeapons, nextId);
  let candidate = findMergeCandidate(nextWeapons);

  while (candidate) {
    const [highIndex, lowIndex] = [candidate.firstIndex, candidate.secondIndex].sort((left, right) => right - left);
    nextWeapons.splice(highIndex, 1);
    nextWeapons.splice(lowIndex, 1);
    nextWeapons.push({
      id: currentId,
      type: candidate.type,
      rank: candidate.rank + 1,
      isJoker: false,
    });
    logs.push({
      type: candidate.type,
      nextRank: candidate.rank + 1,
      usedJoker: candidate.usedJoker,
    });
    currentId += 1;
    candidate = findMergeCandidate(nextWeapons);
  }

  return { weapons: nextWeapons, logs, nextId: currentId };
}
