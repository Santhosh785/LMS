/**
 * The 2026 redesign's "Ask AI" affordances on an article (js/blog-ask-ai.js):
 * a meta bar under the hero, and a fixed rail of deep links that open the
 * article in an assistant with a summarise prompt prefilled.
 *
 * One deliberate difference from the drop: it loaded each assistant's logo from
 * a Bunny CDN belonging to an unrelated WordPress theme
 * (`.../themes/chitti-stem-blog/assets/img/ask-ai/*.png`). Hotlinking another
 * site's assets puts a third party in control of how this page renders and
 * leaks a referrer on every view, so the rail is lettered instead. Swap in
 * self-hosted marks under client/public/ if the brand logos are wanted.
 */

const PROMPT = (title, url) =>
  `Read and summarize this article. Include key takeaways and actionable steps.\n\nTitle: ${title}\nURL: ${url}`

/** `mark` is the short label drawn in the rail; `name` is the accessible name. */
const ASSISTANTS = [
  { name: 'ChatGPT', mark: 'GPT', url: (q) => `https://chatgpt.com/?q=${q}` },
  { name: 'Claude', mark: 'C', url: (q) => `https://claude.ai/new?q=${q}` },
  { name: 'Gemini', mark: 'G', url: (q) => `https://gemini.google.com/app?q=${q}` },
  { name: 'Grok', mark: 'X', url: (q) => `https://grok.com/?q=${q}` },
  { name: 'Perplexity', mark: 'P', url: (q) => `https://www.perplexity.ai/search?q=${q}` },
]

export function AskAiMetaBar({ title, publishedLabel, readTime }) {
  const prompt = encodeURIComponent(PROMPT(title, window.location.href))
  const chatgpt = ASSISTANTS[0].url(prompt)

  return (
    <div className="post-meta-bar">
      <div className="post-meta-bar-stats">
        {publishedLabel && (
          <span className="post-meta-item post-meta-item--date">
            <svg
              className="post-meta-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Published: {publishedLabel}
          </span>
        )}
        {readTime && (
          <span className="post-meta-item post-meta-item--read">
            <svg
              className="post-meta-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {readTime}
          </span>
        )}
      </div>
      <div className="post-meta-bar-actions">
        <a
          className="post-meta-btn post-meta-btn--chatgpt"
          href={chatgpt}
          target="_blank"
          rel="noopener noreferrer"
        >
          Summarize in ChatGPT
        </a>
      </div>
    </div>
  )
}

export function AskAiRail({ title }) {
  const prompt = encodeURIComponent(PROMPT(title, window.location.href))

  return (
    <aside className="ask-ai-rail" aria-label="Ask AI about this article">
      <span className="ask-ai-label" aria-hidden="true">
        ASK AI
      </span>
      {ASSISTANTS.map((a) => (
        <a
          key={a.name}
          className="ask-ai-link"
          href={a.url(prompt)}
          target="_blank"
          rel="noopener noreferrer"
          title={`Summarize in ${a.name}`}
        >
          <span aria-hidden="true">{a.mark}</span>
          <span className="sr-only">Summarize in {a.name}</span>
        </a>
      ))}
    </aside>
  )
}
