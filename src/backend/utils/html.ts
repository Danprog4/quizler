const MAX_TEXT_LENGTH = 9000;

export const stripHtml = (html: string) => {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyles = withoutScripts.replace(
    /<style[\s\S]*?<\/style>/gi,
    " "
  );
  return withoutStyles
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const fetchPageText = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    const html = await response.text();
    return stripHtml(html).slice(0, MAX_TEXT_LENGTH);
  } catch {
    return "";
  }
};
