import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const ROOT_ID = "quizler-root";

let mountPoint = document.getElementById(ROOT_ID);

if (!mountPoint) {
  mountPoint = document.createElement("div");
  mountPoint.id = ROOT_ID;
  document.documentElement.appendChild(mountPoint);
}

mountPoint.style.position = "fixed";
mountPoint.style.zIndex = "2147483647";
mountPoint.style.display = "block";
mountPoint.style.visibility = "visible";
mountPoint.style.opacity = "1";
mountPoint.style.inset = "0";
mountPoint.style.pointerEvents = "none";

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

const MAX_TEXT_LENGTH = 9000;
const TOTAL_QUESTIONS = 5;

type QuizItem = {
  question: string;
  options: string[];
  correctIndex: number;
};

type QuizPayload = {
  questions: QuizItem[];
};

const isQuizPayload = (value: QuizPayload | null): value is QuizPayload =>
  Boolean(
    value &&
      value.questions.length > 0 &&
      value.questions.every((item) => item.options.length === 4)
  );

const collectPageText = () => {
  const text = document.body?.innerText ?? "";
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
};

function QuizlerWidget() {
  const [scrollPercent, setScrollPercent] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

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
  const showLoading =
    isOpen && (status === "loading" || (status === "idle" && !quiz));
  const quizData = isQuizPayload(quiz) ? quiz : null;
  const totalQuestions = quizData?.questions.length ?? TOTAL_QUESTIONS;
  const currentQuestion = quizData?.questions[questionIndex] ?? null;
  const hasResult =
    showResult &&
    currentQuestion !== null &&
    selectedIndex !== null &&
    Number.isInteger(currentQuestion.correctIndex);
  const isLastQuestion = questionIndex >= totalQuestions - 1;
  const canAdvance = selectedIndex !== null;
  const primaryCtaLabel = !showResult
    ? "Submit Answer"
    : isLastQuestion
      ? "Finish Quiz"
      : "Next Question";
  const correctLetter = currentQuestion
    ? String.fromCharCode(65 + currentQuestion.correctIndex)
    : "";
  const requestQuiz = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setQuiz(null);
    setSelectedIndex(null);
    setShowResult(false);

    try {
      const payload = {
        url: window.location.href,
        title: document.title,
        text: collectPageText(),
        count: TOTAL_QUESTIONS,
      };

      const response = await new Promise<QuizPayload>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "quizler:generate", payload },
          (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (!result?.ok) {
              reject(new Error(result?.error ?? "Request failed"));
              return;
            }
            resolve(result.data as QuizPayload);
          }
        );
      });

      setQuiz(response);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  const openWidget = useCallback(() => {
    setSelectedIndex(null);
    setShowResult(false);
    setQuestionIndex(0);
    setCorrectCount(0);
    setIsComplete(false);
    setIsOpen(true);
    if (status === "idle" || status === "error") {
      void requestQuiz();
    }
  }, [requestQuiz, status]);

  useEffect(() => {
    if (status !== "idle") return;
    void requestQuiz();
  }, [requestQuiz, status]);

  const handleNext = useCallback(() => {
    if (!currentQuestion || selectedIndex === null) return;

    if (!showResult) {
      if (selectedIndex === currentQuestion.correctIndex) {
        setCorrectCount((prev) => prev + 1);
      }
      setShowResult(true);
      return;
    }

    if (!isLastQuestion) {
      setQuestionIndex((prev) => prev + 1);
      setSelectedIndex(null);
      setShowResult(false);
      return;
    }

    // Handle completion of the last question
    setIsComplete(true);
  }, [currentQuestion, isLastQuestion, selectedIndex, showResult]);

  const fabClasses = [
    "grid h-[72px] w-[72px] cursor-pointer place-items-center rounded-[20px] border-0 p-1 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,28,26,0.28)] max-[480px]:h-[64px] max-[480px]:w-[64px] max-[480px]:rounded-[18px] active:scale-95",
    "shadow-[0_14px_28px_rgba(16,28,26,0.25)]",
    isReady && !isOpen
      ? "animate-[quizler-pulse_1.8s_ease-in-out_infinite] shadow-[0_0_0_3px_rgba(243,167,59,0.35),0_18px_32px_rgba(16,28,26,0.3)]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="pointer-events-auto fixed bottom-12 right-8 z-[2147483647] flex flex-col items-end gap-3 font-['Space_Grotesk'] text-[#1c1b1f] tracking-[0.1px] max-[480px]:bottom-4 max-[480px]:right-4 max-[380px]:right-2"
      style={{ position: "fixed", right: 32, bottom: 48, zIndex: 2147483647 }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="relative w-[340px] max-w-[calc(100vw-16px)] rounded-[22px] border-2 border-[#1c1b1f] bg-[#f7f2e9] p-[14px] shadow-[0_18px_40px_rgba(20,30,28,0.4)] [background-image:linear-gradient(rgba(28,27,31,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(28,27,31,0.04)_1px,transparent_1px)] [background-size:18px_18px] max-[480px]:w-[calc(100vw-16px)] max-[480px]:rounded-[18px] max-[380px]:p-[12px]"
            role="dialog"
            aria-label="Quizler quiz"
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}>
            <div className="flex items-center justify-between rounded-[18px] bg-[#2b8a7f] px-[14px] py-[12px] text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]">
              <div className="flex items-center gap-2.5 text-white">
                <div
                  className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-[#fdf3e1] font-bold shadow-[inset_0_0_0_1px_rgba(31,111,101,0.25)]"
                  style={{ color: "#1f6f65" }}>
                  Q
                </div>
                <div>
                  <div
                    className="text-[15px] font-semibold text-white"
                    style={{ color: "white" }}>
                    Quizler
                  </div>
                  <div
                    className="text-[12px] opacity-[0.85] text-white"
                    style={{ color: "white" }}>
                    Docs into Quizzes
                  </div>
                </div>
              </div>
              <button
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-[9px] bg-white/20 text-[16px] font-bold text-white transition hover:bg-white/30"
                type="button"
                style={{ color: "white" }}
                onClick={() => setIsOpen(false)}
                aria-label="Close quiz">
                x
              </button>
            </div>
            <div className="mx-1 mt-3 mb-[14px] flex items-center justify-between gap-3">
              <div className="grid flex-1 grid-cols-5 gap-1.5">
                {Array.from({ length: totalQuestions }).map((_, index) => (
                  <span
                    key={`progress-${index}`}
                    className={`h-1.5 rounded-full ${
                      index <= questionIndex ? "bg-[#f3a73b]" : "bg-[#dfe7e2]"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                <span className="rounded-full border border-[#e1c27a] bg-[#f6e1a8] px-2.5 py-1 text-[11px] font-semibold text-[#6a4400]">
                  Q{questionIndex + 1} of {totalQuestions}
                </span>
                <span className="rounded-full border border-[#df7a38] bg-[#f08a46] px-2.5 py-1 text-[11px] font-semibold text-white">
                  +10 XP
                </span>
              </div>
            </div>
            <div>
              {showLoading && (
                <div className="mb-3 space-y-3">
                  <div className="h-4 w-4/5 rounded-[8px] bg-[#e4d8c7] opacity-70 animate-pulse" />
                  <div className="h-4 w-3/5 rounded-[8px] bg-[#e4d8c7] opacity-60 animate-pulse" />
                  <div className="h-10 rounded-[12px] border border-[#e4d8c7] bg-white/80 animate-pulse" />
                  <div className="h-10 rounded-[12px] border border-[#e4d8c7] bg-white/80 animate-pulse" />
                  <div className="h-10 rounded-[12px] border border-[#e4d8c7] bg-white/80 animate-pulse" />
                  <div className="h-10 rounded-[12px] border border-[#e4d8c7] bg-white/80 animate-pulse" />
                </div>
              )}
              {status === "error" && (
                <div className="mb-3 rounded-[12px] border border-[#e4d8c7] bg-[#fffaf3] px-3 py-2 text-[12px] font-semibold text-[#6a4400]">
                  Could not generate yet. {error ? `(${error})` : ""}{" "}
                  <button
                    className="ml-1 underline underline-offset-2"
                    type="button"
                    onClick={requestQuiz}>
                    Try again
                  </button>
                </div>
              )}
              {!showLoading && currentQuestion && (
                <>
                  {!isComplete && (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`question-${questionIndex}`}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}>
                        <h3 className="mb-3 text-[16px] font-semibold leading-[1.35]">
                          {currentQuestion.question}
                        </h3>
                        <div className="grid gap-2.5">
                          <button
                            className={`flex cursor-pointer items-center gap-2.5 rounded-[14px] border-2 px-3 py-2.5 text-left text-[14px] text-[#1c1b1f] shadow-[0_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 ease-out ${
                              hasResult
                                ? currentQuestion.correctIndex === 0
                                  ? "border-[#2e7d32] bg-[#eaf6ee] shadow-[0_4px_8px_rgba(46,125,50,0.15)]"
                                  : selectedIndex === 0
                                    ? "border-[#c33d3d] bg-[#fdecec] shadow-[0_4px_8px_rgba(195,61,61,0.15)]"
                                    : "border-[#e4d8c7] bg-white opacity-70"
                                : selectedIndex === 0
                                  ? "border-[#1f6f65] bg-[#eef7f6] shadow-[0_4px_8px_rgba(31,111,101,0.15)] transform scale-[1.02]"
                                  : "border-[#e4d8c7] bg-white hover:-translate-y-1 hover:border-[#1f6f65] hover:shadow-[0_8px_20px_rgba(31,111,101,0.15)] hover:scale-[1.02] active:scale-[0.98]"
                            }`}
                            type="button"
                            disabled={hasResult}
                            onClick={() => {
                              setSelectedIndex(0);
                            }}>
                            <span className="grid h-7 w-7 place-items-center rounded-[10px] border-2 border-[#d9c7ad] bg-[#fff6e9] font-bold text-[#7a5c2e]">
                              A
                            </span>
                            <span>{currentQuestion.options[0]}</span>
                          </button>
                          <button
                            className={`flex cursor-pointer items-center gap-2.5 rounded-[14px] border-2 px-3 py-2.5 text-left text-[14px] text-[#1c1b1f] shadow-[0_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 ease-out ${
                              hasResult
                                ? currentQuestion.correctIndex === 1
                                  ? "border-[#2e7d32] bg-[#eaf6ee] shadow-[0_4px_8px_rgba(46,125,50,0.15)]"
                                  : selectedIndex === 1
                                    ? "border-[#c33d3d] bg-[#fdecec] shadow-[0_4px_8px_rgba(195,61,61,0.15)]"
                                    : "border-[#e4d8c7] bg-white opacity-70"
                                : selectedIndex === 1
                                  ? "border-[#1f6f65] bg-[#eef7f6] shadow-[0_4px_8px_rgba(31,111,101,0.15)] transform scale-[1.02]"
                                  : "border-[#e4d8c7] bg-white hover:-translate-y-1 hover:border-[#1f6f65] hover:shadow-[0_8px_20px_rgba(31,111,101,0.15)] hover:scale-[1.02] active:scale-[0.98]"
                            }`}
                            type="button"
                            disabled={hasResult}
                            onClick={() => {
                              setSelectedIndex(1);
                            }}>
                            <span className="grid h-7 w-7 place-items-center rounded-[10px] border-2 border-[#d9c7ad] bg-[#fff6e9] font-bold text-[#7a5c2e]">
                              B
                            </span>
                            <span>{currentQuestion.options[1]}</span>
                          </button>
                          <button
                            className={`flex cursor-pointer items-center gap-2.5 rounded-[14px] border-2 px-3 py-2.5 text-left text-[14px] text-[#1c1b1f] shadow-[0_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 ease-out ${
                              hasResult
                                ? currentQuestion.correctIndex === 2
                                  ? "border-[#2e7d32] bg-[#eaf6ee] shadow-[0_4px_8px_rgba(46,125,50,0.15)]"
                                  : selectedIndex === 2
                                    ? "border-[#c33d3d] bg-[#fdecec] shadow-[0_4px_8px_rgba(195,61,61,0.15)]"
                                    : "border-[#e4d8c7] bg-white opacity-70"
                                : selectedIndex === 2
                                  ? "border-[#1f6f65] bg-[#eef7f6] shadow-[0_4px_8px_rgba(31,111,101,0.15)] transform scale-[1.02]"
                                  : "border-[#e4d8c7] bg-white hover:-translate-y-1 hover:border-[#1f6f65] hover:shadow-[0_8px_20px_rgba(31,111,101,0.15)] hover:scale-[1.02] active:scale-[0.98]"
                            }`}
                            type="button"
                            disabled={hasResult}
                            onClick={() => {
                              setSelectedIndex(2);
                            }}>
                            <span className="grid h-7 w-7 place-items-center rounded-[10px] border-2 border-[#d9c7ad] bg-[#fff6e9] font-bold text-[#7a5c2e]">
                              C
                            </span>
                            <span>{currentQuestion.options[2]}</span>
                          </button>
                          <button
                            className={`flex cursor-pointer items-center gap-2.5 rounded-[14px] border-2 px-3 py-2.5 text-left text-[14px] text-[#1c1b1f] shadow-[0_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 ease-out ${
                              hasResult
                                ? currentQuestion.correctIndex === 3
                                  ? "border-[#2e7d32] bg-[#eaf6ee] shadow-[0_4px_8px_rgba(46,125,50,0.15)]"
                                  : selectedIndex === 3
                                    ? "border-[#c33d3d] bg-[#fdecec] shadow-[0_4px_8px_rgba(195,61,61,0.15)]"
                                    : "border-[#e4d8c7] bg-white opacity-70"
                                : selectedIndex === 3
                                  ? "border-[#1f6f65] bg-[#eef7f6] shadow-[0_4px_8px_rgba(31,111,101,0.15)] transform scale-[1.02]"
                                  : "border-[#e4d8c7] bg-white hover:-translate-y-1 hover:border-[#1f6f65] hover:shadow-[0_8px_20px_rgba(31,111,101,0.15)] hover:scale-[1.02] active:scale-[0.98]"
                            }`}
                            type="button"
                            disabled={hasResult}
                            onClick={() => {
                              setSelectedIndex(3);
                            }}>
                            <span className="grid h-7 w-7 place-items-center rounded-[10px] border-2 border-[#d9c7ad] bg-[#fff6e9] font-bold text-[#7a5c2e]">
                              D
                            </span>
                            <span>{currentQuestion.options[3]}</span>
                          </button>
                        </div>
                        {hasResult && (
                          <div className="mt-3 rounded-[12px] border border-[#e4d8c7] bg-[#fffaf3] px-3 py-2 text-[12px] font-semibold text-[#6a4400]">
                            {selectedIndex === currentQuestion.correctIndex
                              ? "Nice! You got it right."
                              : `Not quite. Correct answer: ${correctLetter}.`}
                          </div>
                        )}
                        {canAdvance && !isComplete && (
                          <button
                            className="mt-3 w-full rounded-[12px] border-2 border-[#1c1b1f] bg-[#1c1b1f] px-3 py-2 text-white font-semibold transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(16,28,26,0.25)] min-h-[40px] flex items-center justify-center"
                            type="button"
                            onClick={handleNext}
                            style={{
                              color: "white !important",
                              backgroundColor: "#1c1b1f",
                              fontSize: "12px",
                            }}>
                            <span style={{ color: "white", fontWeight: "600" }}>
                              {primaryCtaLabel}
                            </span>
                          </button>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  )}
                  {isComplete && (
                    <motion.div
                      className="space-y-4 rounded-[20px] border-2 border-[#2e7d32] bg-gradient-to-b from-[#f8fff9] to-[#eaf6ee] p-5 shadow-[0_20px_40px_rgba(46,125,50,0.15)]"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}>
                      {/* Header with celebration */}
                      <div className="text-center space-y-2">
                        <div className="text-[28px]">🎉</div>
                        <div className="text-[16px] font-bold text-[#1b5e20]">
                          Quiz Complete!
                        </div>
                        <div className="text-[12px] text-[#2e7d32] font-medium">
                          Great work on testing your knowledge
                        </div>
                      </div>

                      {/* Leaderboard & History CTA - MAIN FOCUS */}
                      <div className="bg-gradient-to-r from-[#1f6f65] to-[#2b8a7f] rounded-[18px] p-5 text-white shadow-[0_12px_24px_rgba(31,111,101,0.3)]">
                        <div className="flex items-start gap-3">
                          <div className="text-[28px]">🏆</div>
                          <div className="flex-1">
                            <div
                              style={{ color: "#ffffff" }}
                              className="text-[16px] font-bold mb-2 text-white">
                              Join the Leaderboard!
                            </div>
                            <div
                              style={{ color: "#ffffff" }}
                              className="text-[12px] text-white/90 mb-4 leading-relaxed">
                              Sign up to save your quiz history, compete with
                              others, and track your learning progress over
                              time.
                            </div>
                            <button
                              className="w-full bg-white text-[#1f6f65] rounded-[14px] px-4 py-3 text-[13px] font-bold transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)] active:scale-95"
                              type="button"
                              style={{
                                color: "#1f6f65",
                                backgroundColor: "white",
                                fontWeight: "700",
                              }}>
                              <span
                                style={{ color: "#1f6f65", fontWeight: "700" }}>
                                Create Account & Save Progress
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Score display - De-emphasized */}
                      <div className="bg-white/50 rounded-[12px] p-3 border border-[#e4d8c7]">
                        <div className="flex items-center justify-between text-[#6a4400]">
                          <div className="text-[12px] font-medium">
                            Score: {correctCount} / {totalQuestions}
                          </div>
                          <div className="text-[14px] font-semibold">
                            {Math.round((correctCount / totalQuestions) * 100)}%
                          </div>
                        </div>
                      </div>

                      {/* Secondary action */}
                      <button
                        className="w-full text-[#2e7d32] border-2 border-[#c8e6c9] rounded-[12px] px-3 py-2 text-[12px] font-semibold transition duration-150 ease-out hover:bg-[#f1f8e9] hover:border-[#a5d6a7] active:scale-95"
                        type="button"
                        onClick={() => setIsOpen(false)}>
                        <span style={{ color: "#2e7d32", fontWeight: "600" }}>
                          Continue Reading
                        </span>
                      </button>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {scrollPercent >= 80 && !isOpen && (
          <motion.div
            className="max-w-[220px] rounded-[14px] border border-[#e4d8c7] bg-[#fffaf3] px-3 py-2 text-[12px] font-semibold text-[#6a4400] shadow-[0_8px_18px_rgba(16,28,26,0.18)] max-[480px]:max-w-[180px] max-[480px]:text-[11px] max-[480px]:px-2.5 max-[480px]:py-1.5"
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
        onClick={openWidget}
        aria-label="Open quiz">
        <span className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-[16px] bg-[linear-gradient(135deg,#fffaf3,#f4eadb)] shadow-[inset_0_0_0_1px_rgba(38,45,42,0.12)] max-[480px]:h-14 max-[480px]:w-14 max-[480px]:rounded-[14px]">
          <span
            className="h-[22px] w-[22px] text-[#1f6f65] max-[480px]:h-[18px] max-[480px]:w-[18px]"
            aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation">
              <path d="M6 4h9a3 3 0 0 1 3 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zm0 2v12h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H6zm2 2h5v2H8V8zm0 4h8v2H8v-2z" />
            </svg>
          </span>
          <span className="text-[14px] font-bold max-[480px]:text-[12px]">
            {scrollPercent}%
          </span>
        </span>
      </button>
    </div>
  );
}

const root = createRoot(mountPoint);
root.render(<QuizlerWidget />);
