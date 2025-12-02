import { useEffect, useRef, useState } from "react";

type Target = {
  id: number;
  x: number; // percentage
  y: number; // percentage
  color: "green" | "red" | "yellow";
  spawnAt: number; // timestamp ms
};

type ScorePopup = {
  id: number;
  x: number;
  y: number;
  value: number;
};

declare global {
  interface Window {
    YaGames: any;
    ysdk: any;
  }
}

const COLORS: Target["color"][] = ["green", "yellow", "red"];
const BASE_SPAWN_INTERVAL = 1200;
const BASE_LIFESPAN = 1200;
const SPEEDUP_EVERY = 10000;
const MIN_LIFESPAN = 400;
const MIN_SPAWN_INTERVAL = 450;

export default function Game() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [_user, setUser] = useState<any>(null);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(1);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);

  const nextId = useRef(1);
  const spawnIntervalRef = useRef(BASE_SPAWN_INTERVAL);
  const lifespanRef = useRef(BASE_LIFESPAN);
  const spawnTimerRef = useRef<number | null>(null);
  const speedupTimerRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const scoreRef = useRef(score);
  const [ysdk, setYsdk] = useState<any>(null);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initYandex = async () => {
      if (window.YaGames) {
        const sdk = await window.YaGames.init();
        setYsdk(sdk);

        // Foydalanuvchi ma'lumotlari
        const player = await sdk.getPlayer();
        const profile = await player.getUniqueID();
        const name = await player.getName();
        setUser({ id: profile, username: name || "Player" });

        // REKLAMA + LOADING TUGADI DEB AYTISH – OQ EKRANNI YO‘Q QILADI!
        sdk.features.LoadingAPI?.ready();
        console.log("Yandex SDK tayyor!");
      }
    };

    initYandex();
  }, []);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      try {
        setUser(tg.initDataUnsafe.user);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!running) return;

    const spawn = () => {
      const id = nextId.current++;
      const x = Math.random() * 85 + 5;
      const y = Math.random() * 60 + 20;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const t = Date.now();

      setTargets((s) => [...s, { id, x, y, color, spawnAt: t }]);

      // schedule removal for this target
      const lifespan = lifespanRef.current;
      window.setTimeout(() => {
        setTargets((list) => {
          const exists = list.find((tt) => tt.id === id);
          if (!exists) return list;

          if (exists.color === "green") {
            setGameOver("Время вышло — не успели нажать зелёный!");
            setRunning(false);
            return list.filter((tt) => tt.id !== id);
          } else {
            return list.filter((tt) => tt.id !== id);
          }
        });
      }, lifespan);
    };

    spawn();
    spawnTimerRef.current = window.setInterval(spawn, spawnIntervalRef.current);

    speedupTimerRef.current = window.setInterval(() => {
      spawnIntervalRef.current = Math.max(
        MIN_SPAWN_INTERVAL,
        Math.round(spawnIntervalRef.current * 0.88)
      );
      lifespanRef.current = Math.max(
        MIN_LIFESPAN,
        Math.round(lifespanRef.current * 0.88)
      );

      const speedLevel =
        Math.round((BASE_LIFESPAN / lifespanRef.current) * 10) / 10;
      setCurrentSpeed(speedLevel);

      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
        spawnTimerRef.current = window.setInterval(
          spawn,
          spawnIntervalRef.current
        );
      }
    }, SPEEDUP_EVERY);

    return () => {
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
      if (speedupTimerRef.current) {
        clearInterval(speedupTimerRef.current);
        speedupTimerRef.current = null;
      }
    };
  }, [running]);

  useEffect(() => {
    setBest((b) => Math.max(b, score));
  }, [score]);

  useEffect(() => {
    if (!gameOver || !ysdk) return;
    if (savedRef.current) return;
    savedRef.current = true;

    ysdk
      .getLeaderboards()
      .then((lb: any) => {
        lb.setLeaderboardScore("clickrush", score);
      })
      .catch(() => {});
  }, [gameOver, ysdk, score]);

  const startGame = () => {
    nextId.current = 1;
    spawnIntervalRef.current = BASE_SPAWN_INTERVAL;
    lifespanRef.current = BASE_LIFESPAN;
    setTargets([]);
    setScore(0);
    setGameOver(null);
    setCurrentSpeed(1);
    setScorePopups([]);
    savedRef.current = false;
    setRunning(true);
  };

  const handleTargetClick = (t: Target) => {
    if (!running) return;

    if (t.color === "green") {
      const reaction = Date.now() - t.spawnAt;
      const max = Math.max(200, lifespanRef.current);
      const gained = Math.ceil(((max - reaction) / max) * 15) + 1;

      setScore((s) => s + gained);
      setTargets((list) => list.filter((x) => x.id !== t.id));

      const popupId = Date.now();
      setScorePopups((prev) => [
        ...prev,
        { id: popupId, x: t.x, y: t.y, value: gained },
      ]);

      setTimeout(() => {
        setScorePopups((prev) => prev.filter((p) => p.id !== popupId));
      }, 1200);

      return;
    }

    if (t.color === "red") {
      setGameOver("Нажали красный — игра окончена!");
      setRunning(false);
      return;
    }

    // Sariq: neytral
    setTargets((list) => list.filter((x) => x.id !== t.id));
  };

  if (!ysdk && typeof window !== "undefined" && window.YaGames) {
    return (
      <div
        style={{
          background: "#000",
          color: "#fff",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
        }}
      >
        Загрузка...
      </div>
    );
  }

  return (
    <div className="game-wrapper">
      {/* HUD – endi tezlik ham bor */}
      <div className="hud-bar">
        <div className="hud-item">
          <span className="label">Очки</span>
          <span className="value score">{score.toLocaleString()}</span>
        </div>
        <div className="hud-item">
          <span className="label">Рекорд</span>
          <span className="value best">{best.toLocaleString()}</span>
        </div>
        <div className="hud-item">
          <span className="label">Скорость</span>
          <span className="value speed">{currentSpeed.toFixed(1)}x</span>
        </div>
      </div>

      <div className="playfield">
        {/* Targetlar */}
        {targets.map((t) => (
          <button
            key={t.id}
            className={`target ${t.color}`}
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
            onClick={() => handleTargetClick(t)}
          />
        ))}

        {/* +Ball animatsiyalari */}
        {scorePopups.map((p) => (
          <div
            key={p.id}
            className="score-popup"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            +{p.value}
          </div>
        ))}

        {!running && !gameOver && (
          <div className="screen start-screen">
            <div className="start-content">
              {" "}
              <h1 className="game-title">Click Rush</h1>
              <p className="tagline">
                Нажимай только зелёные • Скорость растёт
              </p>
              <button className="action-btn" onClick={startGame}>
                ИГРАТЬ
              </button>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="screen gameover-screen">
            <div className="gameover-content">
              {" "}
              {/* ← YANGI wrapper */}
              <h2 className="over-title">Игра окончена</h2>
              <p className="reason">{gameOver}</p>
              <div className="final-score">{score}</div>
              <button className="action-btn" onClick={startGame}>
                ИГРАТЬ СНОВА
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
