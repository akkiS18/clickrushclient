import { useEffect, useRef, useState } from "react";

type Target = {
  id: number;
  x: number; // percentage
  y: number; // percentage
  color: "green" | "red" | "yellow";
  spawnAt: number; // timestamp ms
};

const COLORS: Target["color"][] = ["green", "red", "yellow"];

const BASE_SPAWN_INTERVAL = 1200; // boshlang'ich yangi target uchun ms
const BASE_LIFESPAN = 1200; // target hayoti ms
const SPEEDUP_EVERY = 10000; // 10s da bir tezlik oshadi
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
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Telegram WebApp user (agar mavjud bo'lsa)
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      try {
        setUser(tg.initDataUnsafe.user);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!running) return;

    // spawn loop
    const spawn = () => {
      const id = nextId.current++;
      const x = Math.random() * 85 + 5; // 5% - 90% (sariq margin)
      const y = Math.random() * 70 + 5; // pastga joy uchun
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const t = Date.now();
      setTargets((s) => [...s, { id, x, y, color, spawnAt: t }]);

      // schedule removal if not clicked
      window.setTimeout(() => {
        setTargets((list) => {
          const exists = list.find((t) => t.id === id);
          if (!exists) return list;
          // agar mavjud va yashil emasligi -> agar u yashil bo'lsa kechikkan, o'yin tugaydi
          // talabga ko'ra: agar kechiksa o'yin tugaydi
          setGameOver("Vaqt tugadi — o'yin tugadi");
          setRunning(false);
          return list.filter((tt) => tt.id !== id);
        });
      }, lifespanRef.current);
    };

    spawn(); // boshlang'ich
    spawnTimerRef.current = window.setInterval(spawn, spawnIntervalRef.current);

    // tezlik oshirish timer
    speedupTimerRef.current = window.setInterval(() => {
      // har 10s kamaytirish
      spawnIntervalRef.current = Math.max(
        MIN_SPAWN_INTERVAL,
        Math.round(spawnIntervalRef.current * 0.88)
      );
      lifespanRef.current = Math.max(MIN_LIFESPAN, Math.round(lifespanRef.current * 0.88));
      // reset interval to use new spawnInterval
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
        spawnTimerRef.current = window.setInterval(
          spawn,
          spawnIntervalRef.current
        );
      }
    }, SPEEDUP_EVERY);

    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      if (speedupTimerRef.current) clearInterval(speedupTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    // update best
    setBest((b) => Math.max(b, score));
  }, [score]);

  const startGame = () => {
    // reset
    nextId.current = 1;
    spawnIntervalRef.current = BASE_SPAWN_INTERVAL;
    lifespanRef.current = BASE_LIFESPAN;
    setTargets([]);
    setScore(0);
    setGameOver(null);
    setRunning(true);
  };

  const endGame = (reason: string) => {
    setGameOver(reason);
    setRunning(false);
    setTargets([]);
  };

  const handleTargetClick = (t: Target) => {
    if (!running) return;
    const now = Date.now();
    const reaction = now - t.spawnAt; // ms
    // agar noto'g'ri rang bosildi -> o'yin tugaydi
    if (t.color !== "green") {
      endGame("Noto'g'ri rangni bosdingiz — o'yin tugadi");
      return;
    }
    // ball hisoblash: tezlikga teskari, reaction kichik bo'lsa ko'proq
    // formula: base 10 ballgacha, tezlik yuqori bo'lsa ko'proq
    const maxReaction = Math.max(200, lifespanRef.current); // ideal maksimal
    const raw = Math.max(0, (maxReaction - reaction) / maxReaction);
    const gained = Math.ceil(raw * 15) + 1; // 1..16 ball
    setScore((s) => s + gained);
    // targetni olib tashlash
    setTargets((list) => list.filter((x) => x.id !== t.id));
  };

  const saveScore = async () => {
    if (!user) {
      alert("Telegram user ma'lumotlari topilmadi, login orqali yuboring.");
      return;
    }
    try {
      await fetch("https://clickrush-bot.onrender.com/save-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: String(user.id),
          username: user.username || `${user.first_name || "Anon"}`,
          score,
        }),
      });
      alert("✅ Natija saqlandi!");
    } catch (e) {
      console.error(e);
      alert("Xatolik: natija saqlanmadi.");
    }
  };

  return (
    <div className="page">
      <h2>🎯 Click Rush (TS)</h2>

      <div className="hud">
        <div>Ball: <strong>{score}</strong></div>
        <div>Best: <strong>{best}</strong></div>
        <div>Status: {running ? "Ishlayapti" : gameOver ? "Tugatildi" : "Tayyor"}</div>
      </div>

      <div ref={containerRef} className="game-area">
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
              <button className="btn save" onClick={saveScore}>💾 Natijani saqlash</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: "#aaa" }}>
        Qoidalar: faqat <strong>yashil</strong>ni bosing. Kechiksa yoki qizilni bossangiz — o‘yin tugaydi.
      </div>
    </div>
  );
}
