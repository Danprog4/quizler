const API_BASE_URL = import.meta.env.DEV
  ? "http://localhost:8787"
  : "https://quizler-production-cdad.up.railway.app";
const SUPABASE_URL = "https://uftctlsnhxijyrrajixw.supabase.co";

type QuizRequest = {
  url: string;
  title: string;
  text: string;
  count: number;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handle GitHub OAuth
  if (message?.type === "quizler:github-auth") {
    const handleGithubAuth = async () => {
      try {
        const redirectUrl = chrome.identity.getRedirectURL();

        // Build the OAuth URL
        const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
        authUrl.searchParams.set("provider", "github");
        authUrl.searchParams.set("redirect_to", redirectUrl);
        authUrl.searchParams.set("scopes", "user:email");

        // Launch the auth flow
        const responseUrl = await chrome.identity.launchWebAuthFlow({
          url: authUrl.toString(),
          interactive: true,
        });

        if (responseUrl) {
          // Extract the tokens from the response URL
          const url = new URL(responseUrl);
          const hashParams = new URLSearchParams(url.hash.substring(1));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken) {
            sendResponse({
              ok: true,
              data: { accessToken, refreshToken },
            });
          } else {
            sendResponse({
              ok: false,
              error: "No access token received",
            });
          }
        } else {
          sendResponse({
            ok: false,
            error: "Authentication was cancelled",
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Authentication failed";
        // User closed the popup - not an error worth reporting
        if (message.includes("canceled") || message.includes("closed")) {
          sendResponse({ ok: false, error: "cancelled" });
        } else {
          sendResponse({ ok: false, error: message });
        }
      }
    };

    void handleGithubAuth();
    return true;
  }

  if (message?.type !== "quizler:generate") return false;

  const payload = message.payload as QuizRequest;
  const run = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json();
      sendResponse({ ok: true, data });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  void run();
  return true;
});
