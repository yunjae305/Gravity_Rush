import assert from "node:assert/strict";
import test from "node:test";
import { MAX_WEAPON_RANK, RANKS } from "./gameData";
import { mergeWeapons, rollWeaponDrop } from "./gameLogic";

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
