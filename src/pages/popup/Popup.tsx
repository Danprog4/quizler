import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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
      detectSessionInUrl: false,
    },
  }
);

export default function Popup() {
  const [session, setSession] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.url) {
      await chrome.storage.local.set({ quizler_return_url: tab.url });
    }
    chrome.runtime.openOptionsPage();
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) {
    return (
      <div className="w-[400px] max-w-[400px] p-4 bg-[#f7f2e9]">
        <div className="text-center text-[#6a4400] text-[13px]">Loading...</div>
      </div>
    );
  }

  const user = (
    session as {
      user?: {
        email?: string;
        user_metadata?: { full_name?: string; avatar_url?: string };
      };
    }
  )?.user;

  return (
    <div className="w-[400px] max-w-[400px] bg-[#f7f2e9] m-0 p-0 box-border overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2b8a7f] to-[#1f6f65] p-4 box-border">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-white/20 rounded-[10px] flex items-center justify-center text-xl font-bold border-2 border-white/30 shrink-0 text-white">
            Q
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold text-white">Quizler</div>
            <div className="text-[11px] opacity-90 text-white">Docs into Quizzes</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 box-border">
        {session ? (
          <>
            {/* User Info */}
            <div className="bg-white rounded-[10px] p-3 mb-2.5 border-2 border-[#e4d8c7]">
              <div className="flex items-center gap-2.5 mb-2.5">
                {user?.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    className="w-9 h-9 rounded-full border-2 border-[#e4d8c7]"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#1f6f65] flex items-center justify-center text-white text-sm font-bold">
                    {user?.email?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#1c1b1f] overflow-hidden text-ellipsis whitespace-nowrap">
                    {user?.user_metadata?.full_name ||
                      user?.email?.split("@")[0] ||
                      "User"}
                  </div>
                  <div className="text-[10px] text-[#6a4400] overflow-hidden text-ellipsis whitespace-nowrap">
                    {user?.email}
                  </div>
                </div>
              </div>
              <div className="bg-[#eaf6ee] border border-[#c8e6c9] rounded-md px-2.5 py-1.5 text-[11px] text-[#2e7d32] text-center font-medium">
                ✓ Signed In
              </div>
            </div>

            {/* Buttons */}
            <button
              onClick={handleOpenOptions}
              style={{ color: 'white' }}
              className="w-full py-2.5 px-4 bg-[#1f6f65] border-2 border-[#1f6f65] rounded-lg text-xs font-semibold cursor-pointer mb-2">
              View Stats & Settings
            </button>

            <button
              onClick={handleLogout}
              style={{ color: '#c33d3d' }}
              className="w-full py-2 px-4 bg-white border-2 border-[#e4d8c7] rounded-lg text-[11px] font-semibold cursor-pointer">
              Sign Out
            </button>
          </>
        ) : (
          <>
            {/* Not signed in */}
            <div className="bg-white rounded-[10px] p-4 mb-2.5 border-2 border-[#e4d8c7] text-center">
              <div className="text-[32px] mb-2.5">🎓</div>
              <div className="text-sm font-bold text-[#1c1b1f] mb-1.5">
                Welcome to Quizler!
              </div>
              <div className="text-[11px] text-[#6a4400] leading-[1.4] mb-3.5">
                Save your quiz results and compete on leaderboards
              </div>

              <button
                onClick={handleAuth}
                style={{ color: 'white' }}
                className="w-full py-3 px-4 bg-[#1f6f65] border-2 border-[#1f6f65] rounded-lg text-[13px] font-semibold cursor-pointer mb-2">
                🚀 Create Account
              </button>

              <div className="text-[10px] text-[#a89f8f]">
                Already signed up? Click above
              </div>
            </div>

            {/* Quick Guide */}
            <div className="bg-[#fffaf3] border border-[#e4d8c7] rounded-lg p-3">
              <div className="text-[11px] font-semibold text-[#1f6f65] mb-1.5">
                How it works
              </div>
              <div className="text-[10px] text-[#6a4400] leading-[1.5]">
                1. Scroll to 95% on any docs page
                <br />
                2. Click the Quizler button
                <br />
                3. Answer AI-generated questions
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
