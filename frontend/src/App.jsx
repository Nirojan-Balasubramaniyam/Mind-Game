import { useState } from 'react';
import Game from './components/Game';
import Leaderboard from './components/Leaderboard';
import './styles/App.css';

export default function App() {
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  return (
    <div className="app-wrap">
      <div className="scan-bg" aria-hidden="true">
        <div className="scan-bg-gradient" />
        <div className="scan-bg-pulse" />
        <div className="scan-bg-line" />
        <div className="scan-bg-orbs">
          <span className="orb orb-1" />
          <span className="orb orb-2" />
          <span className="orb orb-3" />
          <span className="orb orb-4" />
          <span className="orb orb-5" />
        </div>
        <div className="scan-bg-stars" />
      </div>
      <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <img
            src="/Mind-Game/logo.png"
            alt="Unicorn Connected Apps"
            className="brand-logo"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling?.classList.add('visible'); }}
          />
          <span className="brand-logo-fallback" aria-hidden="true">◆</span>
          <span className="company-name">Unicorn Connected Apps</span>
        </div>
      </header>
      <div className="glass-card">
        <h1 className="game-title">Mind Game</h1>
        <p className="tagline">Think of something. I'll guess it.</p>
        <nav className="app-nav">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowLeaderboard((v) => !v)}
          >
            {showLeaderboard ? 'Back to Game' : 'Leaderboard'}
          </button>
        </nav>
        <main className="app-main">
          {showLeaderboard ? <Leaderboard /> : <Game />}
        </main>
      </div>
      <footer className="app-footer">
        <img src="/Mind-Game/logo.png" alt="" className="footer-logo" onError={(e) => { e.target.style.display = 'none'; }} />
        <span>Unicorn Connected Apps</span>
      </footer>
      </div>
    </div>
  );
}
