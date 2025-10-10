// src/pages/Game.tsx
import { useEffect, useRef, useState } from "react";

type Target = {
  id: number;
  x: number; // percentage
  y: number; // percentage
  color: "green" | "red" | "yellow";
  spawnAt: number; // timestamp ms
};

const COLORS: Target["color"][] = ["green", "yellow", "red"]; // o'zgartirish mumkin
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
  const [user, setUser] = useState<any>(null);
  const [gameOver, setGameOver] = useState<string | null>(null);

  const nextId = useRef(1);
  const spawnIntervalRef = useRef(BASE_SPAWN_INTERVAL);
  const lifespanRef = useRef(BASE_LIFESPAN);
  const spawnTimerRef = useRef<number | null>(null);
  const speedupTimerRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const scoreRef = useRef(score);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    // Telegram WebApp user (agar mavjud bo'lsa)
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
      const y = Math.random() * 70 + 5;
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
            // agar yashil missed bo'lsa -> o'yin tugaydi
            setGameOver("Vaqt tugadi — yashilni bosolmadingiz");
            setRunning(false);
            // o'shani olib tashla
            return list.filter((tt) => tt.id !== id);
          } else {
            // red yoki yellow expired bo'lsa — shunchaki o'chirib qo'yamiz
            return list.filter((tt) => tt.id !== id);
          }
        });
      }, lifespan);
    };

    // birinchi spawn va interval
    spawn();
    spawnTimerRef.current = window.setInterval(spawn, spawnIntervalRef.current);

    // tezlik oshirish
    speedupTimerRef.current = window.setInterval(() => {
      spawnIntervalRef.current = Math.max(
        MIN_SPAWN_INTERVAL,
        Math.round(spawnIntervalRef.current * 0.88)
      );
      lifespanRef.current = Math.max(
        MIN_LIFESPAN,
        Math.round(lifespanRef.current * 0.88)
      );

      // intervalni yangilash
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
        spawnTimerRef.current = window.setInterval(spawn, spawnIntervalRef.current);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    setBest((b) => Math.max(b, score));
  }, [score]);

  // avtomatik saqlash: o'yin tugagach backendga yuboradi (server '/save-score' eski score bilan taqqoslaydi)
  useEffect(() => {
    if (!gameOver) return;
    if (savedRef.current) return;
    savedRef.current = true;

    if (!user) return;

    (async () => {
      try {
        await fetch("https://clickrush-bot.onrender.com/save-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: String(user.id),
            username: user.username || `${user.first_name || "Anon"}`,
            score: scoreRef.current,
          }),
        });
        // natija backend tarafida faqat yuqori bo'lsa yangilanadi (server-side logic)
      } catch (e) {
        console.error("Save failed:", e);
      }
    })();
  }, [gameOver, user]);

  const startGame = () => {
    nextId.current = 1;
    spawnIntervalRef.current = BASE_SPAWN_INTERVAL;
    lifespanRef.current = BASE_LIFESPAN;
    setTargets([]);
    setScore(0);
    setGameOver(null);
    savedRef.current = false;
    setRunning(true);
  };

  const handleTargetClick = (t: Target) => {
    if (!running) return;

    if (t.color === "green") {
      const now = Date.now();
      const reaction = now - t.spawnAt;
      const maxReaction = Math.max(200, lifespanRef.current);
      const raw = Math.max(0, (maxReaction - reaction) / maxReaction);
      const gained = Math.ceil(raw * 15) + 1;
      setScore((s) => s + gained);
      setTargets((list) => list.filter((x) => x.id !== t.id));
      return;
    }

    if (t.color === "red") {
      // qizilni bosish -> o'yin tugaydi
      setGameOver("Qizilga tegdingiz — o'yin tugadi");
      setRunning(false);
      return;
    }

    // sariq: neytral — bosilsa yoki vaqt tugasa o'chadi, lekin o'yin tugamaydi
    setTargets((list) => list.filter((x) => x.id !== t.id));
  };

  return (
    <div className="page">
      <h2>🎯 Click Rush</h2>

      <div className="hud">
        <div>Ball: <strong>{score}</strong></div>
        <div>Best: <strong>{best}</strong></div>
        <div>Status: {running ? "Ishlayapti" : gameOver ? "Tugatildi" : "Tayyor"}</div>
      </div>

      <div className="game-area">
        {targets.map((t) => (
          <button
            key={t.id}
            className={`target ${t.color}`}
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
            onClick={() => handleTargetClick(t)}
            aria-label={`target-${t.id}`}
          >
            {t.color === "green" ? "🟢" : t.color === "red" ? "🔴" : "🟡"}
          </button>
        ))}

        {!running && !gameOver && (
          <div className="overlay center">
            <button className="btn" onClick={startGame}>Boshlash</button>
          </div>
        )}

        {gameOver && (
          <div className="overlay center">
            <p><strong>{gameOver}</strong></p>
            <p>Sizning ball: {score}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={startGame}>Yana o‘ynash</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: "#aaa" }}>
        Qoidalar: faqat <strong>yashil</strong>ni bosing. <strong>Qizil</strong>ni bossangiz o‘yin tugaydi.
        <br />
        <strong>Sariq</strong> neytral — uni bosish yoki bosmaslik o‘yinni tugatmaydi.
      </div>
    </div>
  );
}
