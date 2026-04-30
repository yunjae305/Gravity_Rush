"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SUMMON_COST } from "./gameData";
import {
  createWeaponFromRoll,
  getRankColor,
  getRankLabel,
  getWeaponLabel,
  getWeaponName,
  getWeaponStats,
  mergeWeapons,
  rollWeaponDrop,
  type WeaponInstance,
} from "./gameLogic";

const WIDTH = 960;
const HEIGHT = 620;
const ARENA_PADDING = 28;
const PLAYER_RADIUS = 16;

type GameState = "ready" | "playing" | "gameover";

type Enemy = {
  id: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  touchDamage: number;
  hue: string;
};

type CoinDrop = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  value: number;
  life: number;
};

type Projectile = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  hue: string;
  life: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
};

type WeaponRuntime = {
  cooldown: number;
  angle: number;
};

type LogItem = {
  id: number;
  text: string;
  color: string;
  ttl: number;
};

type GameModel = {
  state: GameState;
  time: number;
  bestTime: number;
  kills: number;
  coins: number;
  nextId: number;
  spawnTimer: number;
  summonFlash: number;
  uiTimer: number;
  player: {
    x: number;
    y: number;
    radius: number;
    speed: number;
    hp: number;
    maxHp: number;
    hitFlash: number;
  };
  enemies: Enemy[];
  drops: CoinDrop[];
  projectiles: Projectile[];
  particles: Particle[];
  weapons: WeaponInstance[];
  weaponStates: Record<number, WeaponRuntime>;
  logs: LogItem[];
};

type UiWeapon = {
  id: number;
  label: string;
  color: string;
  isJoker: boolean;
};

type UiLog = {
  id: number;
  text: string;
  color: string;
};

type UiSnapshot = {
  state: GameState;
  time: number;
  bestTime: number;
  kills: number;
  coins: number;
  hp: number;
  maxHp: number;
  weapons: UiWeapon[];
  logs: UiLog[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function formatTime(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

function createInitialGame(bestTime: number): GameModel {
  const starterWeapon: WeaponInstance = {
    id: 1,
    type: "orb",
    rank: 0,
    isJoker: false,
  };

  return {
    state: "ready",
    time: 0,
    bestTime,
    kills: 0,
    coins: SUMMON_COST,
    nextId: 3,
    spawnTimer: 0.8,
    summonFlash: 0,
    uiTimer: 0,
    player: {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      radius: PLAYER_RADIUS,
      speed: 260,
      hp: 100,
      maxHp: 100,
      hitFlash: 0,
    },
    enemies: [],
    drops: [],
    projectiles: [],
    particles: [],
    weapons: [starterWeapon],
    weaponStates: {
      [starterWeapon.id]: {
        cooldown: 0,
        angle: Math.PI / 3,
      },
    },
    logs: [
      {
        id: 2,
        text: "Starter Orb ready",
        color: getRankColor(0),
        ttl: 4,
      },
    ],
  };
}

function createUiSnapshot(game: GameModel): UiSnapshot {
  const weapons = [...game.weapons]
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return right.rank - left.rank;
      }
      if (left.isJoker !== right.isJoker) {
        return Number(right.isJoker) - Number(left.isJoker);
      }
      return left.id - right.id;
    })
    .map((weapon) => ({
      id: weapon.id,
      label: getWeaponLabel(weapon),
      color: getRankColor(weapon.rank),
      isJoker: weapon.isJoker,
    }));

  const logs = game.logs.slice(-6).reverse().map((log) => ({
    id: log.id,
    text: log.text,
    color: log.color,
  }));

  return {
    state: game.state,
    time: game.time,
    bestTime: game.bestTime,
    kills: game.kills,
    coins: game.coins,
    hp: game.player.hp,
    maxHp: game.player.maxHp,
    weapons,
    logs,
  };
}

export default function LuckySurvivorPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const gameRef = useRef<GameModel>(createInitialGame(0));
  const [ui, setUi] = useState<UiSnapshot>(() => createUiSnapshot(gameRef.current));

  const subtitle = useMemo(() => {
    if (ui.state === "ready") {
      return "적을 쓰러뜨려 코인을 모으고, 스페이스로 무기를 뽑아 자동 합성까지 이어가세요.";
    }
    if (ui.state === "gameover") {
      return "다시 시작해서 더 미친 하이롤을 노려보세요.";
    }
    return "움직이며 버티고, 뽑고, 합치고, 터뜨리는 운빨 서바이벌 루프입니다.";
  }, [ui.state]);

  function publishUi(game = gameRef.current) {
    setUi(createUiSnapshot(game));
  }

  function emit(x: number, y: number, count: number, color: string) {
    const game = gameRef.current;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 180;
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.28 + Math.random() * 0.45,
        max: 0.72,
        size: 2 + Math.random() * 4,
        color,
      });
    }
  }

  function addLog(text: string, color: string, ttl = 3.8) {
    const game = gameRef.current;
    game.logs.push({
      id: game.nextId++,
      text,
      color,
      ttl,
    });
    if (game.logs.length > 12) {
      game.logs = game.logs.slice(-12);
    }
  }

  function syncWeaponStates(game: GameModel) {
    const nextStates: Record<number, WeaponRuntime> = {};
    for (const weapon of game.weapons) {
      nextStates[weapon.id] = game.weaponStates[weapon.id] ?? {
        cooldown: 0,
        angle: Math.random() * Math.PI * 2,
      };
    }
    game.weaponStates = nextStates;
  }

  function spawnEnemy(game: GameModel) {
    const side = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;

    if (side === 0) {
      x = randomRange(0, WIDTH);
      y = -40;
    } else if (side === 1) {
      x = WIDTH + 40;
      y = randomRange(0, HEIGHT);
    } else if (side === 2) {
      x = randomRange(0, WIDTH);
      y = HEIGHT + 40;
    } else {
      x = -40;
      y = randomRange(0, HEIGHT);
    }

    const scale = 1 + game.time * 0.025;
    const radius = 14 + Math.random() * 10;

    game.enemies.push({
      id: game.nextId++,
      x,
      y,
      radius,
      hp: 30 * scale + Math.random() * 10,
      maxHp: 30 * scale + Math.random() * 10,
      speed: 52 + Math.min(120, game.time * 4.4) + Math.random() * 24,
      touchDamage: 12 + game.time * 0.35,
      hue: game.time > 40 ? "#ff8fab" : "#8ef9f3",
    });
  }

  function defeatEnemy(index: number, color: string) {
    const game = gameRef.current;
    const enemy = game.enemies[index];

    if (!enemy) {
      return;
    }

    game.enemies.splice(index, 1);
    game.kills += 1;
    emit(enemy.x, enemy.y, 18, color);

    const dropCount = 2 + Math.floor(Math.random() * 2);

    for (let count = 0; count < dropCount; count += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      game.drops.push({
        id: game.nextId++,
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 8,
        value: 3 + Math.floor(Math.random() * 2),
        life: 14,
      });
    }

    if (game.kills % 15 === 0) {
      addLog(`${game.kills} kills online`, "#a7f3d0", 3.2);
    }
  }

  function damageEnemy(enemyId: number, damage: number, color: string) {
    const game = gameRef.current;
    const index = game.enemies.findIndex((enemy) => enemy.id === enemyId);

    if (index === -1) {
      return;
    }

    game.enemies[index].hp -= damage;
    emit(game.enemies[index].x, game.enemies[index].y, 5, color);

    if (game.enemies[index].hp <= 0) {
      defeatEnemy(index, color);
    }
  }

  function resetGame() {
    const bestTime = gameRef.current.bestTime;
    const nextGame = createInitialGame(bestTime);
    nextGame.state = "playing";
    gameRef.current = nextGame;
    lastTimeRef.current = 0;
    addLog("Run started", "#67e8f9", 2.8);
    emit(nextGame.player.x, nextGame.player.y, 22, "#67e8f9");
    publishUi(nextGame);
  }

  function endGame() {
    const game = gameRef.current;

    if (game.state !== "playing") {
      return;
    }

    game.state = "gameover";
    game.bestTime = Math.max(game.bestTime, game.time);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("lucky-survivor-best", String(game.bestTime));
    }

    addLog(`Run over at ${formatTime(game.time)}`, "#fda4af", 5);
    emit(game.player.x, game.player.y, 34, "#fda4af");
    publishUi(game);
  }

  function trySummon() {
    const game = gameRef.current;

    if (game.state !== "playing") {
      resetGame();
      return;
    }

    if (game.coins < SUMMON_COST) {
      addLog(`Need ${SUMMON_COST} coins`, "#fca5a5", 1.8);
      game.summonFlash = 0.14;
      publishUi(game);
      return;
    }

    game.coins -= SUMMON_COST;
    const roll = rollWeaponDrop();
    const weapon = createWeaponFromRoll(game.nextId++, roll);
    game.weapons.push(weapon);
    syncWeaponStates(game);
    emit(game.player.x, game.player.y, roll.isJoker ? 30 : 18, roll.rankColor);

    if (roll.isJoker) {
      addLog(`${getWeaponLabel(weapon)} joined`, "#fde047");
    } else {
      addLog(`${getWeaponLabel(weapon)} summoned`, roll.rankColor);
    }

    if (!roll.isJoker && roll.rank === 4) {
      addLog("Mythic high roll!", "#ff5fd2", 4.6);
    }

    const merged = mergeWeapons(game.weapons, game.nextId);
    game.weapons = merged.weapons;
    game.nextId = merged.nextId;
    syncWeaponStates(game);

    for (const log of merged.logs) {
      const rankColor = getRankColor(log.nextRank);
      const rankLabel = getRankLabel(log.nextRank);
      const weaponName = getWeaponName(log.type);
      const suffix = log.usedJoker ? " + Joker" : "";
      addLog(`${rankLabel} ${weaponName} merged${suffix}`, rankColor, 4.2);
      emit(game.player.x, game.player.y, 26, rankColor);
    }

    game.summonFlash = 0.34;
    publishUi(game);
  }

  useEffect(() => {
    const saved = typeof window !== "undefined" ? Number(window.localStorage.getItem("lucky-survivor-best") || 0) : 0;
    gameRef.current.bestTime = saved;
    publishUi(gameRef.current);
  }, []);

  useEffect(() => {
    const setMovementKey = (code: string, pressed: boolean) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(code)) {
        keysRef.current[code] = pressed;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat && event.code === "Space") {
        event.preventDefault();
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        trySummon();
        return;
      }

      if (event.code === "Enter") {
        event.preventDefault();
        if (gameRef.current.state !== "playing") {
          resetGame();
        }
        return;
      }

      setMovementKey(event.code, true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      setMovementKey(event.code, false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) {
      return;
    }

    const update = (dt: number) => {
      const game = gameRef.current;

      game.logs = game.logs
        .map((log) => ({
          ...log,
          ttl: log.ttl - dt,
        }))
        .filter((log) => log.ttl > 0);

      game.particles = game.particles
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx * dt,
          y: particle.y + particle.vy * dt,
          vx: particle.vx * 0.985,
          vy: particle.vy * 0.985 + 38 * dt,
          life: particle.life - dt,
        }))
        .filter((particle) => particle.life > 0);

      game.player.hitFlash = Math.max(0, game.player.hitFlash - dt * 3);
      game.summonFlash = Math.max(0, game.summonFlash - dt * 3);

      if (game.state !== "playing") {
        return;
      }

      game.time += dt;
      game.uiTimer -= dt;

      const horizontal = Number(Boolean(keysRef.current.KeyD || keysRef.current.ArrowRight)) - Number(Boolean(keysRef.current.KeyA || keysRef.current.ArrowLeft));
      const vertical = Number(Boolean(keysRef.current.KeyS || keysRef.current.ArrowDown)) - Number(Boolean(keysRef.current.KeyW || keysRef.current.ArrowUp));
      const magnitude = Math.hypot(horizontal, vertical) || 1;
      const speed = game.player.speed * dt;

      if (horizontal || vertical) {
        game.player.x = clamp(game.player.x + (horizontal / magnitude) * speed, ARENA_PADDING, WIDTH - ARENA_PADDING);
        game.player.y = clamp(game.player.y + (vertical / magnitude) * speed, ARENA_PADDING, HEIGHT - ARENA_PADDING);
      }

      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        spawnEnemy(game);
        game.spawnTimer = Math.max(0.28, 1.05 - game.time * 0.014) + Math.random() * 0.24;
      }

      for (const enemy of game.enemies) {
        const dx = game.player.x - enemy.x;
        const dy = game.player.y - enemy.y;
        const scale = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / scale) * enemy.speed * dt;
        enemy.y += (dy / scale) * enemy.speed * dt;

        if (distance(enemy.x, enemy.y, game.player.x, game.player.y) < enemy.radius + game.player.radius + 2) {
          game.player.hp = Math.max(0, game.player.hp - enemy.touchDamage * dt);
          game.player.hitFlash = 0.2;
        }
      }

      if (game.player.hp <= 0) {
        endGame();
        return;
      }

      syncWeaponStates(game);

      for (const weapon of game.weapons) {
        const runtime = game.weaponStates[weapon.id];

        if (!runtime) {
          continue;
        }

        const stats = getWeaponStats(weapon);
        runtime.cooldown = Math.max(0, runtime.cooldown - dt);
        runtime.angle += dt * (weapon.type === "saw" ? 4.8 : 3.2) * (1 + weapon.rank * 0.12);

        if (stats.isJoker) {
          continue;
        }

        if (weapon.type === "bolt") {
          if (runtime.cooldown <= 0 && game.enemies.length > 0) {
            let target = game.enemies[0];
            let nearestDistance = distance(game.player.x, game.player.y, target.x, target.y);

            for (const enemy of game.enemies) {
              const nextDistance = distance(game.player.x, game.player.y, enemy.x, enemy.y);
              if (nextDistance < nearestDistance) {
                target = enemy;
                nearestDistance = nextDistance;
              }
            }

            const dx = target.x - game.player.x;
            const dy = target.y - game.player.y;
            const scale = Math.hypot(dx, dy) || 1;

            game.projectiles.push({
              id: game.nextId++,
              x: game.player.x,
              y: game.player.y,
              vx: (dx / scale) * stats.projectileSpeed,
              vy: (dy / scale) * stats.projectileSpeed,
              radius: stats.size,
              damage: stats.damage,
              hue: stats.hue,
              life: 1.2,
            });

            emit(game.player.x, game.player.y, 8, stats.hue);
            runtime.cooldown = stats.cooldown;
          }
          continue;
        }

        const orbitX = game.player.x + Math.cos(runtime.angle) * stats.orbitRadius;
        const orbitY = game.player.y + Math.sin(runtime.angle) * stats.orbitRadius;
        const hitRange = stats.size + 10;

        if (runtime.cooldown <= 0) {
          for (const enemy of [...game.enemies]) {
            if (distance(orbitX, orbitY, enemy.x, enemy.y) <= hitRange + enemy.radius) {
              damageEnemy(enemy.id, stats.damage, stats.hue);
              runtime.cooldown = stats.cooldown;
              break;
            }
          }
        }
      }

      const nextProjectiles: Projectile[] = [];

      for (const projectile of game.projectiles) {
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.life -= dt;

        let hitTarget = false;

        for (const enemy of [...game.enemies]) {
          if (distance(projectile.x, projectile.y, enemy.x, enemy.y) <= projectile.radius + enemy.radius) {
            damageEnemy(enemy.id, projectile.damage, projectile.hue);
            hitTarget = true;
            break;
          }
        }

        if (!hitTarget && projectile.life > 0) {
          nextProjectiles.push(projectile);
        }
      }

      game.projectiles = nextProjectiles;

      const nextDrops: CoinDrop[] = [];

      for (const drop of game.drops) {
        drop.life -= dt;
        drop.x += drop.vx * dt;
        drop.y += drop.vy * dt;
        drop.vx *= 0.98;
        drop.vy *= 0.98;

        const gap = distance(drop.x, drop.y, game.player.x, game.player.y);

        if (gap < 150) {
          const pullX = game.player.x - drop.x;
          const pullY = game.player.y - drop.y;
          const scale = Math.hypot(pullX, pullY) || 1;
          drop.vx += (pullX / scale) * 420 * dt;
          drop.vy += (pullY / scale) * 420 * dt;
        }

        if (gap < drop.radius + game.player.radius + 3) {
          game.coins += drop.value;
          emit(drop.x, drop.y, 10, "#ffdd57");
          continue;
        }

        if (drop.life > 0) {
          nextDrops.push(drop);
        }
      }

      game.drops = nextDrops;

      if (game.uiTimer <= 0) {
        game.uiTimer = 0.08;
        publishUi(game);
      }
    };

    const draw = (time: number) => {
      const game = gameRef.current;
      const dt = Math.min(0.033, (time - lastTimeRef.current) / 1000 || 0.016);
      lastTimeRef.current = time;
      update(dt);

      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      background.addColorStop(0, "#07111d");
      background.addColorStop(0.55, "#161435");
      background.addColorStop(1, "#310e2f");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 80, WIDTH / 2, HEIGHT / 2, HEIGHT);
      vignette.addColorStop(0, "rgba(255,255,255,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.42)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = "#76f2ff";
      ctx.lineWidth = 1;
      const scroll = -(game.time * 40) % 44;

      for (let x = scroll; x < WIDTH; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }

      for (let y = scroll; y < HEIGHT; y += 44) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 2;
      ctx.strokeRect(ARENA_PADDING, ARENA_PADDING, WIDTH - ARENA_PADDING * 2, HEIGHT - ARENA_PADDING * 2);

      for (const drop of game.drops) {
        ctx.save();
        ctx.translate(drop.x, drop.y);
        ctx.rotate(time / 420);
        ctx.shadowBlur = 18;
        ctx.shadowColor = "#ffdd57";
        ctx.fillStyle = "#ffdd57";
        ctx.beginPath();
        ctx.moveTo(0, -drop.radius - 4);
        ctx.lineTo(drop.radius + 4, 0);
        ctx.lineTo(0, drop.radius + 4);
        ctx.lineTo(-drop.radius - 4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      for (const projectile of game.projectiles) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = projectile.hue;
        ctx.fillStyle = projectile.hue;
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      for (const weapon of game.weapons) {
        const runtime = game.weaponStates[weapon.id];

        if (!runtime) {
          continue;
        }

        const stats = getWeaponStats(weapon);

        if (weapon.type === "bolt") {
          ctx.save();
          ctx.translate(game.player.x, game.player.y);
          ctx.rotate(runtime.angle);
          ctx.globalAlpha = 0.35 + game.summonFlash * 0.6;
          ctx.fillStyle = stats.hue;
          ctx.fillRect(18, -3, 22 + weapon.rank * 2, 6);
          ctx.restore();
          continue;
        }

        const orbitX = game.player.x + Math.cos(runtime.angle) * stats.orbitRadius;
        const orbitY = game.player.y + Math.sin(runtime.angle) * stats.orbitRadius;
        ctx.shadowBlur = 24;
        ctx.shadowColor = stats.hue;
        ctx.fillStyle = stats.hue;
        ctx.beginPath();
        ctx.arc(orbitX, orbitY, stats.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (weapon.type === "saw") {
          ctx.save();
          ctx.translate(orbitX, orbitY);
          ctx.rotate(runtime.angle * 2.2);
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 2;
          for (let notch = 0; notch < 6; notch += 1) {
            ctx.beginPath();
            ctx.moveTo(stats.size - 2, 0);
            ctx.lineTo(stats.size + 5, 0);
            ctx.stroke();
            ctx.rotate(Math.PI / 3);
          }
          ctx.restore();
        }
      }

      for (const enemy of game.enemies) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = enemy.hue;
        ctx.fillStyle = enemy.hue;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        const hpWidth = enemy.radius * 2.2;
        const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(enemy.x - hpWidth / 2, enemy.y - enemy.radius - 12, hpWidth, 4);
        ctx.fillStyle = "#9afcff";
        ctx.fillRect(enemy.x - hpWidth / 2, enemy.y - enemy.radius - 12, hpWidth * ratio, 4);
      }

      for (const particle of game.particles) {
        const alpha = clamp(particle.life / particle.max, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const playerGlow = game.player.hitFlash > 0 ? "#ff9aa2" : "#72f6ff";
      ctx.shadowBlur = 28;
      ctx.shadowColor = playerGlow;
      const playerGradient = ctx.createLinearGradient(game.player.x - 22, game.player.y - 22, game.player.x + 22, game.player.y + 22);
      playerGradient.addColorStop(0, "#77fff2");
      playerGradient.addColorStop(1, "#ff72cb");
      ctx.fillStyle = playerGradient;
      ctx.beginPath();
      ctx.arc(game.player.x, game.player.y, game.player.radius + game.summonFlash * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(game.player.x - 4, game.player.y - 4, 3, 0, Math.PI * 2);
      ctx.arc(game.player.x + 4, game.player.y - 4, 3, 0, Math.PI * 2);
      ctx.fill();

      if (game.state !== "playing") {
        ctx.fillStyle = "rgba(3,7,18,0.62)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 56px ui-sans-serif, system-ui";
        ctx.fillText(game.state === "ready" ? "Lucky Survivor" : "Run Over", WIDTH / 2, HEIGHT / 2 - 78);
        ctx.font = "600 21px ui-sans-serif, system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.fillText(game.state === "ready" ? "WASD or arrow keys to move" : `Survived ${formatTime(game.time)}  Kills ${game.kills}`, WIDTH / 2, HEIGHT / 2 - 24);
        ctx.font = "500 19px ui-sans-serif, system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.fillText("Enter or click to start, Space to summon", WIDTH / 2, HEIGHT / 2 + 18);
        ctx.fillText("Same rank + same weapon merges instantly. Joker can cheat the recipe.", WIDTH / 2, HEIGHT / 2 + 52);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#040814] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Luck Merge Survival
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Lucky Survivor</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">{subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">HP</p>
              <p className="mt-2 text-2xl font-black text-white">
                {Math.ceil(ui.hp)}
                <span className="text-sm text-slate-400"> / {ui.maxHp}</span>
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Time</p>
              <p className="mt-2 text-2xl font-black text-white">{formatTime(ui.time)}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Coins</p>
              <p className="mt-2 text-2xl font-black text-white">{ui.coins}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Best</p>
              <p className="mt-2 text-2xl font-black text-white">{formatTime(ui.bestTime)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-fuchsia-950/30 backdrop-blur">
            <button
              type="button"
              onClick={() => {
                if (gameRef.current.state === "playing") {
                  trySummon();
                  return;
                }
                resetGame();
              }}
              className="group relative block w-full overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0a1220] p-2 text-left outline-none transition focus-visible:ring-4 focus-visible:ring-cyan-300/40"
              aria-label="Lucky Survivor arena"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(114,246,255,0.18),transparent_28%),radial-gradient(circle_at_82%_78%,rgba(255,95,210,0.18),transparent_34%)]" />
              <canvas
                ref={canvasRef}
                width={WIDTH}
                height={HEIGHT}
                className="relative z-10 aspect-[960/620] w-full rounded-[1.2rem] bg-slate-950"
              />
            </button>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Summon</p>
                  <h2 className="mt-2 text-2xl font-black">Space to Roll</h2>
                </div>
                <button
                  type="button"
                  onClick={trySummon}
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                  disabled={ui.state !== "playing" || ui.coins < SUMMON_COST}
                >
                  Summon {SUMMON_COST}
                </button>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-300">
                <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">일반 50% / 희귀 30% / 영웅 15%</p>
                <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">전설 4.4% / 신화 0.2% / 조커 0.4%</p>
                <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">같은 무기 2개는 자동으로 다음 등급으로 합쳐집니다.</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Inventory</p>
                  <h2 className="mt-2 text-2xl font-black">Current Build</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                  {ui.weapons.length} slots
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {ui.weapons.map((weapon) => (
                  <div
                    key={weapon.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold" style={{ color: weapon.color }}>
                        {weapon.label}
                      </p>
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-500">{weapon.isJoker ? "Joker" : "Weapon"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Merge Feed</p>
              <h2 className="mt-2 text-2xl font-black">Recent Noise</h2>
              <div className="mt-4 space-y-2 text-sm">
                {ui.logs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2" style={{ color: log.color }}>
                    {log.text}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            <strong className="text-base text-white">조작</strong>
            <p className="mt-3 leading-6">이동은 WASD 또는 방향키, 시작은 Enter 또는 클릭, 소환은 Space입니다.</p>
          </div>
          <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            <strong className="text-base text-white">목표</strong>
            <p className="mt-3 leading-6">적을 피하면서 버티고 코인을 모아 무기를 뽑은 뒤, 자동 합성으로 전투력을 폭발시켜 보세요.</p>
          </div>
          <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            <strong className="text-base text-white">도파민 포인트</strong>
            <p className="mt-3 leading-6">조커와 신화 직출이 한 번만 떠도 판이 뒤집히도록, 확률 루프를 먼저 검증하는 프로토타입입니다.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
