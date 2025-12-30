import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const ROOT_ID = "quizler-root";

let mountPoint = document.getElementById(ROOT_ID);

if (!mountPoint) {
  mountPoint = document.createElement("div");
  mountPoint.id = ROOT_ID;
  (document.body || document.documentElement).appendChild(mountPoint);
}

const getScrollPercent = () => {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop;
  const scrollRange = doc.scrollHeight - doc.clientHeight;

  if (scrollRange <= 0) {
    return 100;
  }

  const rawPercent = (scrollTop / scrollRange) * 100;
  return Math.min(100, Math.max(0, Math.round(rawPercent)));
};

function QuizlerWidget() {
  const [scrollPercent, setScrollPercent] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      setScrollPercent(getScrollPercent());
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const progressStyle = useMemo(
    () => ({ ["--progress" as string]: `${scrollPercent}%` }),
    [scrollPercent]
  );

  const isReady = scrollPercent >= 95;

  return (
    <div className="quizler-widget" data-open={isOpen} data-ready={isReady}>
      {isOpen && (
        <div
          className="quizler-widget__card"
          role="dialog"
          aria-label="Quizler quiz">
          <div className="quizler-widget__card-top">
            <div className="quizler-widget__brand">
              <div className="quizler-widget__logo">Q</div>
              <div>
                <div className="quizler-widget__brand-title">Quizler</div>
                <div className="quizler-widget__brand-sub">React Docs Quiz</div>
              </div>
            </div>
            <button
              className="quizler-widget__close"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close quiz">
              x
            </button>
          </div>
          <div className="quizler-widget__meta">
            <div className="quizler-widget__progress">
              <span className="is-active" />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="quizler-widget__chips">
              <span className="quizler-widget__chip">Q1 of 5</span>
              <span className="quizler-widget__chip quizler-widget__chip--xp">
                +10 XP
              </span>
            </div>
          </div>
          <div className="quizler-widget__question">
            <h3>What is the primary purpose of React's useEffect hook?</h3>
            <div className="quizler-widget__options">
              <button className="quizler-widget__option" type="button">
                <span className="quizler-widget__option-letter">A</span>
                <span>To manage component state</span>
              </button>
              <button className="quizler-widget__option" type="button">
                <span className="quizler-widget__option-letter">B</span>
                <span>To perform side effects in components</span>
              </button>
              <button className="quizler-widget__option" type="button">
                <span className="quizler-widget__option-letter">C</span>
                <span>To create new components</span>
              </button>
              <button className="quizler-widget__option" type="button">
                <span className="quizler-widget__option-letter">D</span>
                <span>To style components</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        className="quizler-widget__fab"
        type="button"
        style={progressStyle}
        onClick={() => setIsOpen(true)}
        aria-label="Open quiz">
        <span className="quizler-widget__fab-inner">
          <span className="quizler-widget__fab-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation">
              <path d="M6 4h9a3 3 0 0 1 3 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zm0 2v12h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H6zm2 2h5v2H8V8zm0 4h8v2H8v-2z" />
            </svg>
          </span>
          <span className="quizler-widget__fab-percent">{scrollPercent}%</span>
        </span>
      </button>
    </div>
  );
}

const root = createRoot(mountPoint);
root.render(<QuizlerWidget />);
