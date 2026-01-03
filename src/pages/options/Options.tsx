import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "@pages/options/Options.css";

// Custom storage adapter for Chrome extension
const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key);
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
      detectSessionInUrl: true,
    },
  }
);

type UserStats = {
  total_quizzes: number;
  total_score: number;
  avg_percentage: number;
};

export default function Options() {
  const [session, setSession] = useState<unknown>(null);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    // Check for OAuth callback in hash fragment
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      setVerifying(true);
    }

    // Check URL params for magic link callback
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get("token_hash");
    const type = params.get("type");

    if (token_hash) {
      setVerifying(true);
      supabase.auth
        .verifyOtp({
          token_hash,
          type: (type as "email" | "magiclink") || "email",
        })
        .then(({ error }) => {
          if (error) {
            setAuthError(error.message);
          } else {
            setAuthSuccess(true);
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          }
          setVerifying(false);
        });
    }

    // Get return URL from storage
    chrome.storage.local.get("quizler_return_url").then((result) => {
      if (result.quizler_return_url) {
        setReturnUrl(result.quizler_return_url);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && verifying) {
        setVerifying(false);
        setAuthSuccess(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && verifying) {
        setVerifying(false);
        setAuthSuccess(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user stats when session is available
  useEffect(() => {
    const fetchStats = async () => {
      const typedSession = session as { user?: { id?: string } } | null;
      if (!typedSession?.user?.id) return;

      setLoadingStats(true);
      const { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("user_id", typedSession.user.id)
        .single();

      if (!error && data) {
        setStats(data);
      }
      setLoadingStats(false);
    };

    void fetchStats();
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setStats(null);
  };

  const handleReturnToPage = () => {
    if (returnUrl) {
      chrome.storage.local.remove("quizler_return_url");
      window.open(returnUrl, "_blank");
    }
  };

  if (verifying) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f2e9",
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
      }}>
        <div style={{
          maxWidth: 480,
          width: "100%",
          padding: 32,
          background: "white",
          borderRadius: 20,
          border: "2px solid #e4d8c7",
          boxShadow: "0 20px 40px rgba(20,30,28,0.15)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1c1b1f", marginBottom: 8 }}>
            Quizler
          </h1>
          <p style={{ fontSize: 14, color: "#6a4400" }}>Confirming your authentication...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f2e9",
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
      }}>
        <div style={{
          maxWidth: 480,
          width: "100%",
          padding: 32,
          background: "white",
          borderRadius: 20,
          border: "2px solid #c33d3d",
          boxShadow: "0 20px 40px rgba(195,61,61,0.15)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1c1b1f", marginBottom: 8 }}>
            Authentication Failed
          </h1>
          <p style={{ fontSize: 14, color: "#c33d3d", marginBottom: 20 }}>{authError}</p>
          <button
            onClick={() => {
              setAuthError(null);
              window.history.replaceState({}, document.title, window.location.pathname);
            }}
            style={{
              width: "100%",
              padding: "12px 24px",
              background: "#1f6f65",
              border: "2px solid #1f6f65",
              borderRadius: 12,
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (authSuccess && !session) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f2e9",
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
      }}>
        <div style={{
          maxWidth: 480,
          width: "100%",
          padding: 32,
          background: "white",
          borderRadius: 20,
          border: "2px solid #2e7d32",
          boxShadow: "0 20px 40px rgba(46,125,50,0.15)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1c1b1f", marginBottom: 8 }}>
            Success!
          </h1>
          <p style={{ fontSize: 14, color: "#2e7d32" }}>Loading your account...</p>
        </div>
      </div>
    );
  }

  if (session) {
    const user = (session as { user?: { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } })?.user;

    return (
      <div style={{
        minHeight: "100vh",
        background: "#f7f2e9",
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
        padding: 40,
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #2b8a7f, #1f6f65)",
            borderRadius: 20,
            padding: 32,
            marginBottom: 24,
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: 20,
            boxShadow: "0 20px 40px rgba(31,111,101,0.2)",
          }}>
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Avatar"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  border: "4px solid rgba(255,255,255,0.3)",
                }}
              />
            ) : (
              <div style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 700,
                border: "4px solid rgba(255,255,255,0.3)",
              }}>
                {user?.email?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
                {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}
              </h1>
              <p style={{ fontSize: 14, opacity: 0.9 }}>{user?.email}</p>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.15)",
              borderRadius: 12,
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid rgba(255,255,255,0.2)",
            }}>
              ✓ Authenticated
            </div>
          </div>

          {/* Stats Section */}
          {loadingStats ? (
            <div style={{
              background: "white",
              borderRadius: 20,
              padding: 32,
              marginBottom: 24,
              border: "2px solid #e4d8c7",
              textAlign: "center",
            }}>
              <p style={{ fontSize: 14, color: "#6a4400" }}>Loading your stats...</p>
            </div>
          ) : stats ? (
            <div style={{
              background: "white",
              borderRadius: 20,
              padding: 32,
              marginBottom: 24,
              border: "2px solid #e4d8c7",
              boxShadow: "0 10px 30px rgba(20,30,28,0.1)",
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1c1b1f", marginBottom: 20 }}>
                📊 Your Stats
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                <div style={{
                  background: "#eaf6ee",
                  borderRadius: 12,
                  padding: 20,
                  border: "1px solid #c8e6c9",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#2e7d32", marginBottom: 4 }}>
                    {stats.total_quizzes}
                  </div>
                  <div style={{ fontSize: 13, color: "#1b5e20" }}>Quizzes Taken</div>
                </div>
                <div style={{
                  background: "#fff8e1",
                  borderRadius: 12,
                  padding: 20,
                  border: "1px solid #ffcc80",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#f57c00", marginBottom: 4 }}>
                    {stats.total_score}
                  </div>
                  <div style={{ fontSize: 13, color: "#e65100" }}>Total Score</div>
                </div>
                <div style={{
                  background: "#eef7f6",
                  borderRadius: 12,
                  padding: 20,
                  border: "1px solid #b2dfdb",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#1f6f65", marginBottom: 4 }}>
                    {stats.avg_percentage}%
                  </div>
                  <div style={{ fontSize: 13, color: "#00695c" }}>Average</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: "white",
              borderRadius: 20,
              padding: 32,
              marginBottom: 24,
              border: "2px solid #e4d8c7",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1c1b1f", marginBottom: 8 }}>
                No quizzes yet!
              </h2>
              <p style={{ fontSize: 14, color: "#6a4400" }}>
                Complete your first quiz to see your stats here
              </p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 12 }}>
            {returnUrl && (
              <button
                onClick={handleReturnToPage}
                style={{
                  flex: 1,
                  padding: "14px 24px",
                  background: "#1f6f65",
                  border: "2px solid #1f6f65",
                  borderRadius: 12,
                  color: "white",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}>
                ← Return to Page
              </button>
            )}
            <button
              onClick={handleLogout}
              style={{
                flex: returnUrl ? 0 : 1,
                padding: "14px 24px",
                background: "white",
                border: "2px solid #e4d8c7",
                borderRadius: 12,
                color: "#c33d3d",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f7f2e9",
      fontFamily: "'Space Grotesk', -apple-system, sans-serif",
    }}>
      <div style={{
        maxWidth: 480,
        width: "100%",
        padding: 32,
        background: "white",
        borderRadius: 20,
        border: "2px solid #e4d8c7",
        boxShadow: "0 20px 40px rgba(20,30,28,0.15)",
        textAlign: "center",
      }}>
        <div style={{
          width: 80,
          height: 80,
          margin: "0 auto 20px",
          background: "linear-gradient(135deg, #2b8a7f, #1f6f65)",
          borderRadius: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
          color: "white",
          fontWeight: 700,
        }}>
          Q
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1c1b1f", marginBottom: 12 }}>
          Quizler
        </h1>
        <p style={{ fontSize: 14, color: "#6a4400", marginBottom: 8 }}>
          You are not logged in
        </p>
        <p style={{ fontSize: 13, color: "#a89f8f", marginBottom: 24 }}>
          Complete a quiz and sign up to save your progress and compete on leaderboards!
        </p>
        <div style={{
          background: "#fffaf3",
          border: "1px solid #e4d8c7",
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1f6f65", marginBottom: 4 }}>
            💡 How to get started
          </div>
          <div style={{ fontSize: 12, color: "#6a4400", textAlign: "left" }}>
            1. Visit any documentation site<br />
            2. Click the Quizler button (appears at 95% scroll)<br />
            3. Complete a quiz and sign up to save your score!
          </div>
        </div>
      </div>
    </div>
  );
}
