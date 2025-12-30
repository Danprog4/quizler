import { AnimatePresence, motion } from "framer-motion";
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
    () => ({
      backgroundImage: `conic-gradient(#f3a73b ${scrollPercent}%, rgba(22,25,24,0.15) 0)`,
    }),
    [scrollPercent]
  );

  const isReady = scrollPercent >= 95;
  const fabClasses = [
    "grid h-[72px] w-[72px] cursor-pointer place-items-center rounded-[20px] border-0 p-1 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,28,26,0.28)]",
    "shadow-[0_14px_28px_rgba(16,28,26,0.25)]",
    isReady && !isOpen
      ? "animate-[quizler-pulse_1.8s_ease-in-out_infinite] shadow-[0_0_0_3px_rgba(243,167,59,0.35),0_18px_32px_rgba(16,28,26,0.3)]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="fixed bottom-12 right-8 z-[2147483647] flex flex-col items-end gap-3 font-['Space_Grotesk'] text-[#1c1b1f] tracking-[0.1px] max-[480px]:bottom-6 max-[480px]:right-4"
      style={{ position: "fixed", right: 32, bottom: 48, zIndex: 2147483647 }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="w-[340px] max-w-[calc(100vw-32px)] rounded-[22px] border-2 border-[#1c1b1f] bg-[#f7f2e9] p-[14px] shadow-[0_18px_40px_rgba(20,30,28,0.2)] [background-image:linear-gradient(rgba(28,27,31,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(28,27,31,0.04)_1px,transparent_1px)] [background-size:18px_18px] max-[480px]:w-[calc(100vw-24px)]"
            role="dialog"
            aria-label="Quizler quiz"
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}>
            <div className="flex items-center justify-between rounded-[18px] bg-[#2b8a7f] px-[14px] py-[12px] text-[#fdf8f2] shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]">
              <div className="flex items-center gap-2.5">
                <div className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-[#fdf3e1] font-bold text-[#1f6f65] shadow-[inset_0_0_0_1px_rgba(31,111,101,0.25)]">
                  Q
                </div>
                <div>
                  <div className="text-[15px] font-semibold">Quizler</div>
                  <div className="text-[12px] opacity-[0.85]">
                    React Docs Quiz
                  </div>
                </div>
              </div>
              <button
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-[9px] bg-white/20 text-[16px] font-bold text-white transition hover:bg-white/30"
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close quiz">
                x
              </button>
            </div>
            <div className="mx-1 mt-3 mb-[14px] flex items-center justify-between gap-3">
              <div className="grid flex-1 grid-cols-5 gap-1.5">
                <span className="h-1.5 rounded-full bg-[#f3a73b]" />
                <span className="h-1.5 rounded-full bg-[#dfe7e2]" />
                <span className="h-1.5 rounded-full bg-[#dfe7e2]" />
                <span className="h-1.5 rounded-full bg-[#dfe7e2]" />
                <span className="h-1.5 rounded-full bg-[#dfe7e2]" />
              </div>
              <div className="flex gap-1.5">
                <span className="rounded-full border border-[#e1c27a] bg-[#f6e1a8] px-2.5 py-1 text-[11px] font-semibold text-[#6a4400]">
                  Q1 of 5
                </span>
                <span className="rounded-full border border-[#df7a38] bg-[#f08a46] px-2.5 py-1 text-[11px] font-semibold text-white">
                  +10 XP
                </span>
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-[16px] font-semibold leading-[1.35]">
                What is the primary purpose of React's useEffect hook?
              </h3>
              <div className="grid gap-2.5">
                <button
                  className="flex cursor-pointer items-center gap-2.5 rounded-[14px] border-2 border-[#e4d8c7] bg-white px-3 py-2.5 text-left text-[14px] text-[#1c1b1f] shadow-[0_2px_0_rgba(0,0,0,0.05)] transition duration-150 ease-out hover:-translate-y-0.5 hover:border-[#caa679] hover:shadow-[0_8px_16px_rgba(25,21,17,0.12)]"
                  type="button">
                  <span className="grid h-7 w-7 place-items-center rounded-[10px] border-2 border-[#d9c7ad] bg-[#fff6e9] font-bold text-[#7a5c2e]">
                    A
                  </span>
                  <span>To manage component state</span>
                </button>
                <button
                  className="flex cursor-pointer items-center gap-2.5 rounded-[14px] border-2 border-[#e4d8c7] bg-white px-3 py-2.5 text-left text-[14px] text-[#1c1b1f] shadow-[0_2px_0_rgba(0,0,0,0.05)] transition duration-150 ease-out hover:-translate-y-0.5 hover:border-[#caa679] hover:shadow-[0_8px_16px_rgba(25,21,17,0.12)]"
                  type="button">
                  <span className="grid h-7 w-7 place-items-center rounded-[10px] border-2 border-[#d9c7ad] bg-[#fff6e9] font-bold text-[#7a5c2e]">
                    B
                  </span>
                  <span>To perform side effects in components</span>
                </button>
                <button
                  className="flex cursor-pointer items-center gap-2.5 rounded-[14px] border-2 border-[#e4d8c7] bg-white px-3 py-2.5 text-left text-[14px] text-[#1c1b1f] shadow-[0_2px_0_rgba(0,0,0,0.05)] transition duration-150 ease-out hover:-translate-y-0.5 hover:border-[#caa679] hover:shadow-[0_8px_16px_rgba(25,21,17,0.12)]"
                  type="button">
                  <span className="grid h-7 w-7 place-items-center rounded-[10px] border-2 border-[#d9c7ad] bg-[#fff6e9] font-bold text-[#7a5c2e]">
                    C
                  </span>
                  <span>To create new components</span>
                </button>
                <button
                  className="flex cursor-pointer items-center gap-2.5 rounded-[14px] border-2 border-[#e4d8c7] bg-white px-3 py-2.5 text-left text-[14px] text-[#1c1b1f] shadow-[0_2px_0_rgba(0,0,0,0.05)] transition duration-150 ease-out hover:-translate-y-0.5 hover:border-[#caa679] hover:shadow-[0_8px_16px_rgba(25,21,17,0.12)]"
                  type="button">
                  <span className="grid h-7 w-7 place-items-center rounded-[10px] border-2 border-[#d9c7ad] bg-[#fff6e9] font-bold text-[#7a5c2e]">
                    D
                  </span>
                  <span>To style components</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {scrollPercent >= 70 && !isOpen && (
          <motion.div
            className="max-w-[220px] rounded-[14px] border border-[#e4d8c7] bg-[#fffaf3] px-3 py-2 text-[12px] font-semibold text-[#6a4400] shadow-[0_8px_18px_rgba(16,28,26,0.18)]"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}>
            Quiz ready - test your brain
          </motion.div>
        )}
      </AnimatePresence>
      <button
        className={fabClasses}
        type="button"
        style={progressStyle}
        onClick={() => setIsOpen(true)}
        aria-label="Open quiz">
        <span className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-[16px] bg-[linear-gradient(135deg,#fffaf3,#f4eadb)] shadow-[inset_0_0_0_1px_rgba(38,45,42,0.12)]">
          <span className="h-[22px] w-[22px] text-[#1f6f65]" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation">
              <path d="M6 4h9a3 3 0 0 1 3 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zm0 2v12h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H6zm2 2h5v2H8V8zm0 4h8v2H8v-2z" />
            </svg>
          </span>
          <span className="text-[14px] font-bold">{scrollPercent}%</span>
        </span>
      </button>
    </div>
  );
}

const root = createRoot(mountPoint);
root.render(<QuizlerWidget />);
