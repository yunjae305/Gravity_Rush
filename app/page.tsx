"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const WIDTH = 900;
const HEIGHT = 560;
const PLAYER_X = 170;
const PLAYER_SIZE = 30;
const FLOOR_Y = HEIGHT - 82;
const CEILING_Y = 82;
const LANES = [CEILING_Y + 20, HEIGHT / 2, FLOOR_Y - 20];

type Obstacle = {
  id: number;
  x: number;
  lane: number;
  w: number;
  h: number;
  kind: "spike" | "gate";
  passed: boolean;
};

type Gem = {
  id: number;
  x: number;
  lane: number;
  r: number;
  taken: boolean;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
};

type GameState = "ready" | "playing" | "gameover";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectOverlap(cx: number, cy: number, r: number, rect: { x: number; y: number; w: number; h: number }) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

export default function GravityGemRush() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const gameRef = useRef({
    state: "ready" as GameState,
    score: 0,
    best: 0,
    gems: 0,
    speed: 245,
    distance: 0,
    playerY: FLOOR_Y - PLAYER_SIZE,
    playerVY: 0,
    gravity: 1280,
    gravityDir: 1,
    invincible: 0,
    obstacles: [] as Obstacle[],
    gemList: [] as Gem[],
    particles: [] as Particle[],
    spawnTimer: 0,
    gemTimer: 0,
    nextId: 1,
    shake: 0,
  });

  const [ui, setUi] = useState({ state: "ready" as GameState, score: 0, best: 0, gems: 0 });

  const subtitle = useMemo(() => {
    if (ui.state === "ready") return "스페이스/클릭/탭으로 중력을 뒤집어 보석을 먹고 함정을 피해보세요.";
    if (ui.state === "gameover") return "다시 시작하려면 스페이스/클릭/탭을 누르세요.";
    return "중력 반전으로 리듬을 만들고, 네온 보석을 모으세요.";
  }, [ui.state]);

  function emit(x: number, y: number, count: number) {
    const game = gameRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 210;
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.35,
        max: 0.8,
      });
    }
  }

  function resetGame() {
    const best = gameRef.current.best;
    gameRef.current = {
      state: "playing",
      score: 0,
      best,
      gems: 0,
      speed: 245,
      distance: 0,
      playerY: FLOOR_Y - PLAYER_SIZE,
      playerVY: 0,
      gravity: 1280,
      gravityDir: 1,
      invincible: 0.9,
      obstacles: [],
      gemList: [],
      particles: [],
      spawnTimer: 0.55,
      gemTimer: 0.75,
      nextId: 1,
      shake: 0,
    };
    setUi({ state: "playing", score: 0, best, gems: 0 });
    emit(PLAYER_X + PLAYER_SIZE / 2, FLOOR_Y - PLAYER_SIZE / 2, 28);
  }

  function flipGravity() {
    const game = gameRef.current;
    if (game.state !== "playing") {
      resetGame();
      return;
    }
    game.gravityDir *= -1;
    game.playerVY = -game.gravityDir * 430;
    emit(PLAYER_X + PLAYER_SIZE / 2, game.playerY + PLAYER_SIZE / 2, 12);
  }

  useEffect(() => {
    const saved = typeof window !== "undefined" ? Number(localStorage.getItem("gravity-gem-rush-best") || 0) : 0;
    gameRef.current.best = saved;
    setUi((prev) => ({ ...prev, best: saved }));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "Enter"].includes(event.code)) {
        event.preventDefault();
        flipGravity();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const spawnObstacle = () => {
      const game = gameRef.current;
      const lane = Math.floor(Math.random() * LANES.length);
      const kind = Math.random() < 0.72 ? "spike" : "gate";
      const obstacle: Obstacle = {
        id: game.nextId++,
        x: WIDTH + 80,
        lane,
        w: kind === "gate" ? 54 : 46,
        h: kind === "gate" ? 116 : 54,
        kind,
        passed: false,
      };
      game.obstacles.push(obstacle);
    };

    const spawnGem = () => {
      const game = gameRef.current;
      const lane = Math.floor(Math.random() * LANES.length);
      game.gemList.push({ id: game.nextId++, x: WIDTH + 80, lane, r: 12, taken: false });
    };

    const endGame = () => {
      const game = gameRef.current;
      if (game.invincible > 0 || game.state !== "playing") return;
      game.state = "gameover";
      game.shake = 0.45;
      game.best = Math.max(game.best, Math.floor(game.score));
      if (typeof window !== "undefined") localStorage.setItem("gravity-gem-rush-best", String(game.best));
      setUi({ state: "gameover", score: Math.floor(game.score), best: game.best, gems: game.gems });
      emit(PLAYER_X + PLAYER_SIZE / 2, game.playerY + PLAYER_SIZE / 2, 42);
    };

    const update = (dt: number) => {
      const game = gameRef.current;
      game.particles = game.particles
        .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + 360 * dt, life: p.life - dt }))
        .filter((p) => p.life > 0);
      game.shake = Math.max(0, game.shake - dt);

      if (game.state !== "playing") return;

      game.distance += game.speed * dt;
      game.speed += 7.5 * dt;
      game.score += dt * 10 + game.speed * dt * 0.018;
      game.invincible = Math.max(0, game.invincible - dt);

      game.playerVY += game.gravity * game.gravityDir * dt;
      game.playerY += game.playerVY * dt;
      const topLimit = CEILING_Y;
      const bottomLimit = FLOOR_Y - PLAYER_SIZE;
      if (game.playerY <= topLimit) {
        game.playerY = topLimit;
        game.playerVY = Math.max(0, game.playerVY);
      }
      if (game.playerY >= bottomLimit) {
        game.playerY = bottomLimit;
        game.playerVY = Math.min(0, game.playerVY);
      }

      game.spawnTimer -= dt;
      game.gemTimer -= dt;
      if (game.spawnTimer <= 0) {
        spawnObstacle();
        game.spawnTimer = Math.max(0.62, 1.22 - game.speed / 720) + Math.random() * 0.45;
      }
      if (game.gemTimer <= 0) {
        spawnGem();
        game.gemTimer = 0.9 + Math.random() * 1.1;
      }

      game.obstacles.forEach((o) => {
        o.x -= game.speed * dt;
        if (!o.passed && o.x + o.w < PLAYER_X) {
          o.passed = true;
          game.score += 14;
        }
      });
      game.gemList.forEach((g) => {
        g.x -= game.speed * dt;
      });

      const playerRect = { x: PLAYER_X, y: game.playerY, w: PLAYER_SIZE, h: PLAYER_SIZE };
      for (const obstacle of game.obstacles) {
        const centerY = LANES[obstacle.lane];
        const rect = { x: obstacle.x, y: centerY - obstacle.h / 2, w: obstacle.w, h: obstacle.h };
        if (rectsOverlap(playerRect, rect)) endGame();
      }

      for (const gem of game.gemList) {
        if (!gem.taken && circleRectOverlap(gem.x, LANES[gem.lane], gem.r + 3, playerRect)) {
          gem.taken = true;
          game.gems += 1;
          game.score += 30;
          emit(gem.x, LANES[gem.lane], 18);
        }
      }

      game.obstacles = game.obstacles.filter((o) => o.x > -120);
      game.gemList = game.gemList.filter((g) => g.x > -80 && !g.taken);

      setUi((prev) => {
        const nextScore = Math.floor(game.score);
        if (prev.score === nextScore && prev.gems === game.gems && prev.state === game.state) return prev;
        return { state: game.state, score: nextScore, best: Math.max(game.best, nextScore), gems: game.gems };
      });
    };

    const draw = (time: number) => {
      const game = gameRef.current;
      const dt = Math.min(0.033, (time - lastTimeRef.current) / 1000 || 0.016);
      lastTimeRef.current = time;
      update(dt);

      const shakeX = game.shake ? (Math.random() - 0.5) * game.shake * 18 : 0;
      const shakeY = game.shake ? (Math.random() - 0.5) * game.shake * 18 : 0;

      ctx.save();
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.translate(shakeX, shakeY);

      const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      gradient.addColorStop(0, "#09111f");
      gradient.addColorStop(0.5, "#16113a");
      gradient.addColorStop(1, "#2b0f2f");
      ctx.fillStyle = gradient;
      ctx.fillRect(-30, -30, WIDTH + 60, HEIGHT + 60);

      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = "#64f4ff";
      ctx.lineWidth = 1;
      const gridOffset = -(game.distance % 48);
      for (let x = gridOffset; x < WIDTH; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }
      for (let y = 48; y < HEIGHT; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const platformGradient = ctx.createLinearGradient(0, CEILING_Y, 0, FLOOR_Y);
      platformGradient.addColorStop(0, "rgba(118, 252, 255, 0.32)");
      platformGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.04)");
      platformGradient.addColorStop(1, "rgba(255, 79, 216, 0.32)");
      ctx.fillStyle = platformGradient;
      ctx.fillRect(0, 0, WIDTH, CEILING_Y);
      ctx.fillRect(0, FLOOR_Y, WIDTH, HEIGHT - FLOOR_Y);

      ctx.shadowBlur = 18;
      ctx.shadowColor = "#67f7ff";
      ctx.strokeStyle = "#67f7ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, CEILING_Y);
      ctx.lineTo(WIDTH, CEILING_Y);
      ctx.stroke();
      ctx.shadowColor = "#ff59d8";
      ctx.strokeStyle = "#ff59d8";
      ctx.beginPath();
      ctx.moveTo(0, FLOOR_Y);
      ctx.lineTo(WIDTH, FLOOR_Y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.globalAlpha = 0.18;
      LANES.forEach((lane) => {
        ctx.strokeStyle = "#ffffff";
        ctx.setLineDash([8, 18]);
        ctx.beginPath();
        ctx.moveTo(0, lane);
        ctx.lineTo(WIDTH, lane);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      game.gemList.forEach((gem) => {
        const y = LANES[gem.lane];
        const pulse = Math.sin(time / 120 + gem.id) * 2;
        ctx.save();
        ctx.translate(gem.x, y);
        ctx.rotate(time / 600);
        ctx.shadowBlur = 22;
        ctx.shadowColor = "#ffeb70";
        ctx.fillStyle = "#ffeb70";
        ctx.beginPath();
        ctx.moveTo(0, -gem.r - 4 - pulse);
        ctx.lineTo(gem.r + 4 + pulse, 0);
        ctx.lineTo(0, gem.r + 4 + pulse);
        ctx.lineTo(-gem.r - 4 - pulse, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.arc(-4, -4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      game.obstacles.forEach((obstacle) => {
        const y = LANES[obstacle.lane] - obstacle.h / 2;
        ctx.save();
        ctx.shadowBlur = 18;
        if (obstacle.kind === "gate") {
          ctx.shadowColor = "#9a7cff";
          ctx.fillStyle = "rgba(154, 124, 255, 0.86)";
          drawRoundedRect(obstacle.x, y, obstacle.w, obstacle.h, 12);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.24)";
          ctx.fillRect(obstacle.x + obstacle.w / 2 - 3, y + 12, 6, obstacle.h - 24);
        } else {
          ctx.shadowColor = "#ff3d7f";
          const spikeCount = 3;
          const spikeW = obstacle.w / spikeCount;
          for (let i = 0; i < spikeCount; i++) {
            const x = obstacle.x + i * spikeW;
            ctx.fillStyle = "#ff3d7f";
            ctx.beginPath();
            ctx.moveTo(x, y + obstacle.h);
            ctx.lineTo(x + spikeW / 2, y);
            ctx.lineTo(x + spikeW, y + obstacle.h);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.62)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
        ctx.restore();
      });

      game.particles.forEach((p) => {
        const alpha = clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2 + alpha * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      const px = PLAYER_X;
      const py = game.playerY;
      ctx.save();
      ctx.translate(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2);
      ctx.rotate(game.gravityDir === 1 ? 0 : Math.PI);
      ctx.shadowBlur = game.invincible > 0 ? 26 : 18;
      ctx.shadowColor = game.invincible > 0 ? "#ffffff" : "#53fff0";
      const playerGradient = ctx.createLinearGradient(-18, -18, 18, 18);
      playerGradient.addColorStop(0, "#6ffff2");
      playerGradient.addColorStop(1, "#ff67d7");
      ctx.fillStyle = playerGradient;
      drawRoundedRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE, 9);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(8, 5);
      ctx.lineTo(-8, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (game.state !== "playing") {
        ctx.fillStyle = "rgba(3, 7, 18, 0.54)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 54px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont";
        ctx.shadowBlur = 18;
        ctx.shadowColor = "#67f7ff";
        ctx.fillText(game.state === "ready" ? "Gravity Gem Rush" : "Game Over", WIDTH / 2, HEIGHT / 2 - 52);
        ctx.shadowBlur = 0;
        ctx.font = "600 20px ui-sans-serif, system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.fillText(game.state === "ready" ? "중력을 뒤집는 원버튼 네온 러너" : `점수 ${Math.floor(game.score)} · 보석 ${game.gems}`, WIDTH / 2, HEIGHT / 2 - 8);
        ctx.font = "500 18px ui-sans-serif, system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillText("스페이스 / 클릭 / 탭으로 시작", WIDTH / 2, HEIGHT / 2 + 34);
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-8">
        <div className="mb-5 w-full max-w-[900px]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
                One Button Arcade
              </p>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Gravity Gem Rush</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">{subtitle}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-72">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 shadow-lg backdrop-blur">
                <p className="text-xs text-slate-300">Score</p>
                <p className="text-2xl font-black tabular-nums">{ui.score}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 shadow-lg backdrop-blur">
                <p className="text-xs text-slate-300">Best</p>
                <p className="text-2xl font-black tabular-nums">{ui.best}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 shadow-lg backdrop-blur">
                <p className="text-xs text-slate-300">Gems</p>
                <p className="text-2xl font-black tabular-nums">{ui.gems}</p>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={flipGravity}
          className="group relative block w-full max-w-[900px] overflow-hidden rounded-[2rem] border border-white/15 bg-white/5 p-2 shadow-2xl shadow-fuchsia-950/40 outline-none backdrop-blur transition hover:scale-[1.005] focus-visible:ring-4 focus-visible:ring-cyan-300/50"
          aria-label="게임 조작: 중력 뒤집기"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(103,247,255,0.24),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(255,89,216,0.22),transparent_35%)]" />
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            className="relative z-10 aspect-[900/560] w-full rounded-[1.5rem] bg-slate-900"
          />
        </button>

        <div className="mt-5 grid w-full max-w-[900px] gap-3 text-sm text-slate-300 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <strong className="text-white">조작</strong>
            <p className="mt-1">스페이스, 엔터, 클릭, 탭으로 중력을 반전합니다.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <strong className="text-white">목표</strong>
            <p className="mt-1">함정을 피하고 노란 보석을 먹어 점수를 빠르게 올리세요.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <strong className="text-white">배포</strong>
            <p className="mt-1">Vercel에 바로 올릴 수 있는 Next.js 앱입니다.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
