# Lucky Survivor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current gravity runner with a canvas-based lucky survivor prototype that combines free movement, auto-attacks, coin summons, and instant weapon merges.

**Architecture:** Keep the React page as the single canvas scene and HUD surface, but move gacha, weapon creation, and merge rules into small pure TypeScript helpers. Add a lightweight Node test script so the random roll and merge rules can be verified outside the browser before wiring them into the page loop.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Tailwind CSS, Node 24 built-in test runner

---

### Task 1: Add testable summon and merge logic

**Files:**
- Create: `app/gameData.ts`
- Create: `app/gameLogic.ts`
- Create: `app/gameLogic.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mergeWeapons, rollWeaponDrop } from "./gameLogic";
import { MAX_WEAPON_RANK, RANKS } from "./gameData";

test("mergeWeapons upgrades a matching pair into the next rank", () => {
  const result = mergeWeapons([
    { id: 1, type: "orb", rank: 0, isJoker: false },
    { id: 2, type: "orb", rank: 0, isJoker: false },
  ]);

  assert.equal(result.weapons.length, 1);
  assert.equal(result.weapons[0].type, "orb");
  assert.equal(result.weapons[0].rank, 1);
  assert.equal(result.logs.length, 1);
});

test("mergeWeapons lets a joker merge with the same rank weapon", () => {
  const result = mergeWeapons([
    { id: 1, type: "bolt", rank: 2, isJoker: false },
    { id: 2, type: "joker", rank: 2, isJoker: true },
  ]);

  assert.equal(result.weapons.length, 1);
  assert.equal(result.weapons[0].type, "bolt");
  assert.equal(result.weapons[0].rank, 3);
});

test("mergeWeapons does not upgrade beyond mythic", () => {
  const result = mergeWeapons([
    { id: 1, type: "saw", rank: MAX_WEAPON_RANK, isJoker: false },
    { id: 2, type: "saw", rank: MAX_WEAPON_RANK, isJoker: false },
  ]);

  assert.equal(result.weapons.length, 2);
  assert.equal(result.logs.length, 0);
});

test("rollWeaponDrop always returns a defined rank", () => {
  for (let index = 0; index < 200; index += 1) {
    const result = rollWeaponDrop(() => 0.5);
    assert.ok(RANKS.includes(result.rankLabel));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test app/gameLogic.test.ts`
Expected: FAIL because `app/gameLogic.ts` and `app/gameData.ts` do not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
// package.json
{
  "scripts": {
    "test": "node --experimental-strip-types --test app/gameLogic.test.ts"
  }
}

// app/gameData.ts
export const RANKS = ["Common", "Rare", "Epic", "Legendary", "Mythic"] as const;
export const MAX_WEAPON_RANK = RANKS.length - 1;

export type WeaponType = "orb" | "bolt" | "saw" | "joker";

export type WeaponInstance = {
  id: number;
  type: WeaponType;
  rank: number;
  isJoker: boolean;
};

export type MergeLog = {
  from: WeaponType;
  to: WeaponType;
  nextRank: number;
};

const ROLL_TABLE = [
  { limit: 0.004, rank: 0, isJoker: true },
  { limit: 0.006, rank: 4, isJoker: false },
  { limit: 0.05, rank: 3, isJoker: false },
  { limit: 0.2, rank: 2, isJoker: false },
  { limit: 0.5, rank: 1, isJoker: false },
  { limit: 1, rank: 0, isJoker: false },
] as const;

export function rollWeaponDrop(randomValue = Math.random) {
  const roll = randomValue();
  const hit = ROLL_TABLE.find((entry) => roll < entry.limit) ?? ROLL_TABLE[ROLL_TABLE.length - 1];
  return {
    rank: hit.rank,
    rankLabel: RANKS[hit.rank],
    isJoker: hit.isJoker,
  };
}

export function mergeWeapons(weapons: WeaponInstance[]) {
  const nextWeapons = [...weapons];
  const logs: MergeLog[] = [];
  let changed = true;

  while (changed) {
    changed = false;

    for (let rank = 0; rank < MAX_WEAPON_RANK; rank += 1) {
      const normalGroups = new Map<string, number[]>();
      const jokerIndexes: number[] = [];

      nextWeapons.forEach((weapon, index) => {
        if (weapon.rank !== rank) return;
        if (weapon.isJoker) {
          jokerIndexes.push(index);
          return;
        }
        const bucket = normalGroups.get(weapon.type) ?? [];
        bucket.push(index);
        normalGroups.set(weapon.type, bucket);
      });

      for (const [type, indexes] of normalGroups.entries()) {
        if (indexes.length >= 2) {
          const second = indexes.pop()!;
          const first = indexes.pop()!;
          nextWeapons.splice(second, 1);
          nextWeapons.splice(first, 1);
          nextWeapons.push({ id: Date.now() + rank, type: type as WeaponType, rank: rank + 1, isJoker: false });
          logs.push({ from: type as WeaponType, to: type as WeaponType, nextRank: rank + 1 });
          changed = true;
          break;
        }

        if (indexes.length === 1 && jokerIndexes.length >= 1) {
          const jokerIndex = jokerIndexes.pop()!;
          const weaponIndex = indexes[0];
          const [high, low] = [jokerIndex, weaponIndex].sort((left, right) => right - left);
          nextWeapons.splice(high, 1);
          nextWeapons.splice(low, 1);
          nextWeapons.push({ id: Date.now() + rank, type: type as WeaponType, rank: rank + 1, isJoker: false });
          logs.push({ from: type as WeaponType, to: type as WeaponType, nextRank: rank + 1 });
          changed = true;
          break;
        }
      }

      if (changed) {
        break;
      }
    }
  }

  return { weapons: nextWeapons, logs };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test`
Expected: PASS with all summon and merge tests green

- [ ] **Step 5: Commit**

```bash
git add app/gameData.ts app/gameLogic.ts app/gameLogic.test.ts package.json
git commit -m "feat: add summon and merge logic"
```

### Task 2: Replace the page loop with the lucky survivor prototype

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Write the failing test target**

```txt
Target behavior to verify in the browser build:
- Enter or click starts a run
- WASD and arrow keys move the player
- Space spends coins to summon a weapon
- enemies chase the player and drop coins
- owned weapons auto-attack and merge logs appear
```

- [ ] **Step 2: Run build to capture the red state after partial rewiring**

Run: `npm.cmd run build`
Expected: FAIL while `app/page.tsx` still references the removed gravity-runner structures

- [ ] **Step 3: Write minimal implementation**

```ts
// Replace the gravity runner state with:
// - player position, velocity-free movement, hp, coins, kills, time
// - enemy, coin, projectile, particle arrays
// - summon and merge integration through gameLogic.ts
// - keyboard handling for movement and summon
// - orbit, bolt, and saw attack behaviors derived from weapon inventory
// - HUD cards, summon hint, inventory panel, and merge log panel
// - canvas rendering for arena, player, enemies, coins, projectiles, and effects
```

- [ ] **Step 4: Run build to verify it passes**

Run: `npm.cmd run build`
Expected: PASS with the new lucky survivor page compiling successfully

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: build lucky survivor prototype"
```

### Task 3: Refresh project docs for the new prototype

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the failing documentation target**

```txt
README should describe Lucky Survivor rather than Gravity Gem Rush and list the new controls and loop.
```

- [ ] **Step 2: Review current README to confirm it is stale**

Run: `Get-Content README.md`
Expected: Output still describes the gravity runner concept

- [ ] **Step 3: Write minimal implementation**

```md
# Lucky Survivor

브라우저에서 즐기는 운빨 서바이버 프로토타입입니다.

## 핵심 루프
- 적 처치로 코인 수집
- 스페이스바 소환
- 같은 무기 자동 합성
- 신화와 조커 변수

## 조작
- 이동: WASD / 방향키
- 시작: Enter 또는 클릭
- 소환: Space
```

- [ ] **Step 4: Run build to ensure the docs update did not accompany hidden app regressions**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: refresh lucky survivor readme"
```
