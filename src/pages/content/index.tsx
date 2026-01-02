import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./style.css";

// Custom storage adapter for Chrome extension
const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] ?? null);
      });
    });
  },
  setItem: async (key: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  },
  removeItem: async (key: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => {
        resolve();
      });
    });
  },
};

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  {
    auth: {
      storage: chromeStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

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

type LeaderboardEntry = {
  user_id: string;
  email: string;
  avatar_url: string | null;
  username: string | null;
  total_quizzes: number;
  total_score: number;
  avg_percentage: number;
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

  // Auth state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authOtp, setAuthOtp] = useState("");
  const [authStep, setAuthStep] = useState<"email" | "otp">("email");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [session, setSession] = useState<unknown>(null);

  // Leaderboard state
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [resultSaved, setResultSaved] = useState(false);

  // Pending result (for users who complete quiz before auth)
  const [pendingResult, setPendingResult] = useState<{
    score: number;
    total: number;
    percentage: number;
  } | null>(null);

  // Save quiz result to database
  const saveQuizResult = useCallback(async (score: number, total: number, percentage: number) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      // Save pending result for after auth
      setPendingResult({ score, total, percentage });
      return false;
    }

    const { error } = await supabase.from("quiz_results").insert({
      user_id: session.user.id,
      score,
      total_questions: total,
      percentage,
      page_url: window.location.href,
      page_title: document.title,
    });

    if (error) {
      console.error("Error saving quiz result:", error);
      return false;
    }

    setResultSaved(true);
    return true;
  }, []);

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    const { data, error } = await supabase
      .from("leaderboard")
      .select("*")
      .limit(10);

    if (error) {
      console.error("Error fetching leaderboard:", error);
    } else {
      setLeaderboard(data || []);
    }
    setLeaderboardLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        setShowAuthModal(false);
        setAuthMessage(null);
        setAuthStep("email");
        setAuthOtp("");

        // Save pending result if exists
        if (pendingResult) {
          await saveQuizResult(pendingResult.score, pendingResult.total, pendingResult.percentage);
          setPendingResult(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [pendingResult]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      setAuthMessage(error.message);
    } else {
      setAuthStep("otp");
      setAuthMessage("Check your email for the code!");
    }
    setAuthLoading(false);
  };

  const handleGithubSignIn = async () => {
    setAuthLoading(true);
    setAuthMessage(null);

    const redirectTo = chrome.runtime.getURL("src/pages/options/index.html");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo,
      },
    });

    if (error) {
      setAuthMessage(error.message);
      setAuthLoading(false);
    }
    // Don't set loading to false on success - user will be redirected
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    const { error } = await supabase.auth.verifyOtp({
      email: authEmail,
      token: authOtp,
      type: authMode === "signup" ? "signup" : "email",
    });

    if (error) {
      setAuthMessage(error.message);
      console.error("OTP verification error:", error);
    } else {
      // Success - close modal
      setShowAuthModal(false);
    }
    setAuthLoading(false);
  };

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

    // Calculate final score (need to add 1 if current answer is correct since state hasn't updated yet)
    const finalCorrect = selectedIndex === currentQuestion.correctIndex
      ? correctCount + 1
      : correctCount;
    const percentage = Math.round((finalCorrect / totalQuestions) * 100);

    // Save result (will be pending if not authenticated)
    void saveQuizResult(finalCorrect, totalQuestions, percentage);
  }, [currentQuestion, isLastQuestion, selectedIndex, showResult, correctCount, totalQuestions, saveQuizResult]);

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
                      className="space-y-4"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}>

                      {!showLeaderboard ? (
                        <>
                          {/* Quiz Complete Card */}
                          <div
                            style={{
                              borderRadius: 20,
                              border: "2px solid #2e7d32",
                              background: "linear-gradient(to bottom, #f8fff9, #eaf6ee)",
                              padding: 20,
                              boxShadow: "0 20px 40px rgba(46,125,50,0.15)",
                            }}>
                            {/* Header */}
                            <div style={{ textAlign: "center", marginBottom: 16 }}>
                              <div style={{ fontSize: 28 }}>🎉</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: "#1b5e20" }}>
                                Quiz Complete!
                              </div>
                              <div style={{ fontSize: 12, color: "#2e7d32", fontWeight: 500 }}>
                                Great work on testing your knowledge
                              </div>
                            </div>

                            {/* Score */}
                            <div
                              style={{
                                background: "#ffffff",
                                borderRadius: 14,
                                padding: "16px 20px",
                                textAlign: "center",
                                marginBottom: 16,
                                border: "1px solid #c8e6c9",
                              }}>
                              <div style={{ fontSize: 32, fontWeight: 700, color: "#1b5e20" }}>
                                {correctCount} / {totalQuestions}
                              </div>
                              <div style={{ fontSize: 14, color: "#2e7d32", fontWeight: 500 }}>
                                {Math.round((correctCount / totalQuestions) * 100)}% correct
                              </div>
                              {resultSaved && (
                                <div style={{ fontSize: 11, color: "#66bb6a", marginTop: 4 }}>
                                  ✓ Result saved
                                </div>
                              )}
                              {pendingResult && !session && (
                                <div style={{ fontSize: 11, color: "#f57c00", marginTop: 4 }}>
                                  Sign in to save your score!
                                </div>
                              )}
                            </div>

                            {/* Action buttons */}
                            {session ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowLeaderboard(true);
                                  void fetchLeaderboard();
                                }}
                                style={{
                                  width: "100%",
                                  backgroundColor: "#1f6f65",
                                  border: "none",
                                  borderRadius: 14,
                                  padding: "14px 20px",
                                  color: "#ffffff",
                                  fontSize: 14,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  marginBottom: 8,
                                }}>
                                🏆 View Leaderboard
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setAuthMode("signup");
                                  setShowAuthModal(true);
                                }}
                                style={{
                                  width: "100%",
                                  backgroundColor: "#1f6f65",
                                  border: "none",
                                  borderRadius: 14,
                                  padding: "14px 20px",
                                  color: "#ffffff",
                                  fontSize: 14,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  marginBottom: 8,
                                }}>
                                🏆 Create Account & Join Leaderboard
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setIsOpen(false)}
                              style={{
                                width: "100%",
                                backgroundColor: "transparent",
                                border: "2px solid #c8e6c9",
                                borderRadius: 12,
                                padding: "10px 16px",
                                color: "#2e7d32",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}>
                              Continue Reading
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Leaderboard View */}
                          <div
                            style={{
                              borderRadius: 20,
                              border: "2px solid #1f6f65",
                              background: "linear-gradient(to bottom, #f0faf8, #e8f5f3)",
                              padding: 16,
                              boxShadow: "0 20px 40px rgba(31,111,101,0.15)",
                            }}>
                            {/* Header */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 20 }}>🏆</span>
                                <span style={{ fontSize: 16, fontWeight: 700, color: "#1f6f65" }}>Leaderboard</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowLeaderboard(false)}
                                style={{
                                  backgroundColor: "#e4d8c7",
                                  border: "none",
                                  borderRadius: 8,
                                  padding: "4px 8px",
                                  fontSize: 12,
                                  color: "#6a4400",
                                  cursor: "pointer",
                                  fontWeight: 500,
                                }}>
                                ← Back
                              </button>
                            </div>

                            {/* Leaderboard list */}
                            {leaderboardLoading ? (
                              <div style={{ textAlign: "center", padding: 20 }}>
                                <div style={{ fontSize: 12, color: "#6a4400" }}>Loading...</div>
                              </div>
                            ) : leaderboard.length === 0 ? (
                              <div style={{ textAlign: "center", padding: 20 }}>
                                <div style={{ fontSize: 24, marginBottom: 8 }}>🎯</div>
                                <div style={{ fontSize: 13, color: "#1f6f65", fontWeight: 600 }}>Be the first!</div>
                                <div style={{ fontSize: 12, color: "#6a4400" }}>Complete more quizzes to appear here</div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {leaderboard.map((entry, index) => (
                                  <div
                                    key={entry.user_id}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 10,
                                      backgroundColor: index === 0 ? "#fff8e1" : "#ffffff",
                                      border: `1px solid ${index === 0 ? "#ffcc02" : "#e4d8c7"}`,
                                      borderRadius: 12,
                                      padding: "10px 12px",
                                    }}>
                                    {/* Rank */}
                                    <div
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 8,
                                        backgroundColor: index === 0 ? "#ffcc02" : index === 1 ? "#e0e0e0" : index === 2 ? "#ffcc80" : "#f5f5f5",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: index < 3 ? "#5d4037" : "#757575",
                                      }}>
                                      {index + 1}
                                    </div>

                                    {/* Avatar */}
                                    {entry.avatar_url ? (
                                      <img
                                        src={entry.avatar_url}
                                        alt=""
                                        style={{
                                          width: 32,
                                          height: 32,
                                          borderRadius: "50%",
                                          border: "2px solid #e4d8c7",
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          width: 32,
                                          height: 32,
                                          borderRadius: "50%",
                                          backgroundColor: "#1f6f65",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          color: "#ffffff",
                                          fontSize: 14,
                                          fontWeight: 600,
                                        }}>
                                        {(entry.username || entry.email)?.[0]?.toUpperCase() || "?"}
                                      </div>
                                    )}

                                    {/* Name & stats */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 600,
                                          color: "#1c1b1f",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}>
                                        {entry.username || entry.email?.split("@")[0] || "Anonymous"}
                                      </div>
                                      <div style={{ fontSize: 11, color: "#6a4400" }}>
                                        {entry.total_quizzes} quiz{entry.total_quizzes !== 1 ? "zes" : ""} · {entry.avg_percentage}% avg
                                      </div>
                                    </div>

                                    {/* Score */}
                                    <div
                                      style={{
                                        backgroundColor: "#eaf6ee",
                                        borderRadius: 8,
                                        padding: "4px 8px",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "#2e7d32",
                                      }}>
                                      {entry.total_score} pts
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
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

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAuthModal(false)}>
            <motion.div
              className="w-[340px] max-w-[calc(100vw-32px)] rounded-[22px] border-2 border-[#1c1b1f] bg-[#f7f2e9] p-5 shadow-[0_24px_50px_rgba(20,30,28,0.5)]"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 240, damping: 22 }}
              onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-[#2b8a7f] font-bold text-white shadow-[0_2px_4px_rgba(31,111,101,0.3)]">
                    Q
                  </div>
                  <div className="text-[16px] font-bold text-[#1c1b1f]">
                    {authMode === "signup" ? "Create Account" : "Sign In"}
                  </div>
                </div>
                <button
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-[9px] bg-[#e4d8c7] text-[16px] font-bold text-[#6a4400] transition hover:bg-[#d9c7ad]"
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  aria-label="Close">
                  ×
                </button>
              </div>

              {/* Description */}
              <p className="text-[13px] text-[#6a4400] mb-4">
                {authMode === "signup"
                  ? "Sign up to save your quiz results, track progress, and compete on the leaderboard."
                  : "Welcome back! Sign in to access your quiz history."}
              </p>

              {/* Form */}
              {authStep === "email" ? (
                <div className="space-y-3">
                  {/* GitHub Sign In - Primary */}
                  <button
                    type="button"
                    onClick={handleGithubSignIn}
                    disabled={authLoading}
                    className="w-full rounded-[12px] px-4 py-3 text-[14px] font-semibold transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(16,28,26,0.25)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: "#24292e",
                      border: "2px solid #24292e",
                      color: "#ffffff",
                    }}>
                    <svg style={{ width: 20, height: 20, fill: "#ffffff" }} viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: "#ffffff", fontWeight: 600 }}>
                      {authLoading ? "Opening GitHub..." : "Continue with GitHub"}
                    </span>
                  </button>

                  {/* Divider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, height: 1, backgroundColor: "#e4d8c7" }}></div>
                    <span style={{ fontSize: 11, color: "#a89f8f", fontWeight: 500 }}>or use email</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: "#e4d8c7" }}></div>
                  </div>

                  {/* Email Form */}
                  <form onSubmit={handleSendOtp} className="space-y-3">
                    <div>
                      <input
                        type="email"
                        placeholder="Enter your email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        required
                        className="w-full rounded-[12px] border-2 border-[#e4d8c7] bg-white px-4 py-3 text-[14px] text-[#1c1b1f] placeholder-[#a89f8f] outline-none transition focus:border-[#1f6f65] focus:shadow-[0_0_0_3px_rgba(31,111,101,0.15)]"
                        style={{ backgroundColor: "#ffffff", color: "#1c1b1f" }}
                      />
                    </div>

                    {authMessage && (
                      <div
                        style={{
                          borderRadius: 10,
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 500,
                          backgroundColor: authMessage.includes("Check your email") ? "#eaf6ee" : "#fdecec",
                          color: authMessage.includes("Check your email") ? "#2e7d32" : "#c33d3d",
                          border: `1px solid ${authMessage.includes("Check your email") ? "#c8e6c9" : "#f5c6c6"}`,
                        }}>
                        {authMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full rounded-[12px] px-4 py-3 text-[14px] font-semibold transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(31,111,101,0.15)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                      style={{
                        backgroundColor: "#ffffff",
                        border: "2px solid #e4d8c7",
                        color: "#1c1b1f",
                      }}>
                      <span style={{ color: "#1c1b1f", fontWeight: 600 }}>
                        {authLoading ? "Sending..." : "Send Code"}
                      </span>
                    </button>
                  </form>
                </div>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  {/* Success message */}
                  <div
                    style={{
                      borderRadius: 12,
                      padding: "12px 16px",
                      backgroundColor: "#eaf6ee",
                      border: "1px solid #c8e6c9",
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#2e7d32", marginBottom: 4 }}>
                      Code sent!
                    </div>
                    <div style={{ fontSize: 12, color: "#388e3c" }}>
                      Check your email at <strong>{authEmail}</strong>
                    </div>
                  </div>

                  {/* Code input */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6a4400", marginBottom: 6 }}>
                      Enter verification code
                    </label>
                    <input
                      type="text"
                      placeholder="12345678"
                      value={authOtp}
                      onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      required
                      maxLength={8}
                      className="w-full rounded-[12px] px-4 py-3 outline-none transition focus:shadow-[0_0_0_3px_rgba(31,111,101,0.15)]"
                      style={{
                        backgroundColor: "#ffffff",
                        border: "2px solid #e4d8c7",
                        color: "#1c1b1f",
                        fontSize: 18,
                        fontFamily: "monospace",
                        textAlign: "center",
                        letterSpacing: "0.25em",
                      }}
                    />
                  </div>

                  {/* Error message */}
                  {authMessage && !authMessage.includes("Check your email") && (
                    <div
                      style={{
                        borderRadius: 10,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 500,
                        backgroundColor: "#fdecec",
                        color: "#c33d3d",
                        border: "1px solid #f5c6c6",
                      }}>
                      {authMessage}
                    </div>
                  )}

                  {/* Verify button */}
                  <button
                    type="submit"
                    disabled={authLoading || authOtp.length < 6}
                    className="w-full rounded-[12px] px-4 py-3 text-[14px] font-semibold transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(16,28,26,0.25)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    style={{
                      backgroundColor: "#1f6f65",
                      border: "2px solid #1f6f65",
                      color: "#ffffff",
                    }}>
                    <span style={{ color: "#ffffff", fontWeight: 600 }}>
                      {authLoading ? "Verifying..." : "Verify Code"}
                    </span>
                  </button>

                  {/* Back button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep("email");
                      setAuthOtp("");
                      setAuthMessage(null);
                    }}
                    style={{
                      width: "100%",
                      fontSize: 12,
                      color: "#1f6f65",
                      fontWeight: 500,
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "8px 0",
                    }}>
                    Use different email
                  </button>
                </form>
              )}

              {/* Switch mode */}
              <div className="mt-4 text-center text-[12px] text-[#6a4400]">
                {authMode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthMode("signin")}
                      className="font-semibold text-[#1f6f65] underline underline-offset-2 hover:text-[#2b8a7f]">
                      Sign In
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthMode("signup")}
                      className="font-semibold text-[#1f6f65] underline underline-offset-2 hover:text-[#2b8a7f]">
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const root = createRoot(mountPoint);
root.render(<QuizlerWidget />);
