import { useEffect, useState } from "react";

type Leader = { username: string | null; score: number };

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<Leader[]>([]);

  useEffect(() => {
    fetch("https://clickrush-bot.onrender.com/leaderboard")
      .then((res) => res.json())
      .then((data) => {
        setLeaders(data || []);
      })
      .catch((e) => {
        console.error(e);
      });
  }, []);

  return (
    <div className="page">
      <h2>🏆 Reyting (Top 10)</h2>
      <ol className="leaders">
        {leaders.map((u, i) => (
          <li key={i}>
            <span className="name">{u.username || "Anonim"}</span>
            <span className="score">{u.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
