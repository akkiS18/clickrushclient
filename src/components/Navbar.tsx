import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const { pathname } = useLocation();
  return (
    <nav className="navbar">
      <Link to="/" className={pathname === "/" ? "active" : ""}>🎮 O‘yin</Link>
      <Link to="/leaderboard" className={pathname === "/leaderboard" ? "active" : ""}>🏆 Reyting</Link>
    </nav>
  );
}