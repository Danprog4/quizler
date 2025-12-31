const API_BASE_URL = "http://localhost:8787";

type QuizRequest = {
  url: string;
  title: string;
  text: string;
  count: number;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
