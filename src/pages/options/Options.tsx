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

export default function Options() {
  const [session, setSession] = useState<unknown>(null);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    // Check for OAuth callback in hash fragment
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      setVerifying(true);
      // Supabase will automatically handle the hash with detectSessionInUrl: true
      // We just need to wait for the session to be set
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
            // Clear URL params
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          }
          setVerifying(false);
        });
    }

    // Get return URL from storage and auto-redirect if authenticated
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
        // Clear hash
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
        // Clear hash and redirect back
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (verifying) {
    return (
      <div className="container">
        <h1>Quizler</h1>
        <p>Confirming your magic link...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="container">
        <h1>Quizler</h1>
        <p style={{ color: "#c33d3d" }}>Authentication failed: {authError}</p>
        <button
          onClick={() => {
            setAuthError(null);
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          }}>
          Try again
        </button>
      </div>
    );
  }

  const handleReturnToPage = () => {
    if (returnUrl) {
      // Clear the stored URL
      chrome.storage.local.remove("quizler_return_url");
      // Open the original page
      window.open(returnUrl, "_blank");
    }
  };

  if (authSuccess && !session) {
    return (
      <div className="container">
        <h1>Quizler</h1>
        <p style={{ color: "#2e7d32" }}>Authentication successful!</p>
        <p>Loading your account...</p>
      </div>
    );
  }

  if (session) {
    const user = (session as { user?: { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } })?.user;
    return (
      <div className="container">
        <h1>Quizler</h1>
        {user?.user_metadata?.avatar_url && (
          <img
            src={user.user_metadata.avatar_url}
            alt="Avatar"
            style={{ width: 64, height: 64, borderRadius: "50%", marginBottom: 16 }}
          />
        )}
        <p>Welcome, {user?.user_metadata?.full_name || user?.email}!</p>
        <p style={{ color: "#2e7d32", marginTop: "10px" }}>
          Authentication successful! Your quiz progress will be saved.
        </p>
        {returnUrl && (
          <button
            onClick={handleReturnToPage}
            style={{
              marginTop: "20px",
              backgroundColor: "#1f6f65",
              color: "#fff",
              border: "none",
              padding: "12px 24px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}>
            Return to page
          </button>
        )}
        <button onClick={handleLogout} style={{ marginTop: "12px" }}>
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Quizler Options</h1>
      <p>You are not logged in.</p>
      <p>Complete a quiz and sign up to save your progress!</p>
    </div>
  );
}
