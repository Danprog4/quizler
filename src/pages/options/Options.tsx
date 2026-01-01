import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "@pages/options/Options.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
);

export default function Options() {
  const [session, setSession] = useState<unknown>(null);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);

  useEffect(() => {
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

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
    const user = (session as { user?: { email?: string } })?.user;
    return (
      <div className="container">
        <h1>Quizler</h1>
        <p>You are logged in as: {user?.email}</p>
        <p style={{ color: "#2e7d32", marginTop: "10px" }}>
          You can now close this page and continue using Quizler on any
          website. Your quiz progress will be saved!
        </p>
        <button onClick={handleLogout} style={{ marginTop: "20px" }}>
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
