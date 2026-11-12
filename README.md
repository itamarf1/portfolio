# Portfolio site

Static page plus one serverless function for the agent.

    index.html    the page
    kb.js         all content (projects, notes, agent instructions). Edit text here.
    api/chat.js   agent endpoint. Holds the API key server-side.

## Deploy on Vercel (free Hobby plan)

1. Put this folder in a GitHub repository.
2. On vercel.com choose Add New > Project and import the repository. No build settings needed.
3. In Project Settings > Environment Variables add ONE of:
   - `ANTHROPIC_API_KEY` (optionally `LLM_MODEL`)
   - or `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` for any OpenAI-compatible provider
     (several offer a free tier). `LLM_BASE_URL` is the provider's base URL that ends
     before `/chat/completions`.
4. Redeploy. The chat header shows "Live model" once the endpoint answers.

Without a key the site still works: the chat falls back to a keyword lookup and says so.

## Edit

- Contact buttons: fill `profile.links` at the top of `kb.js`.
- Project text, numbers and the agent's rules: all in `kb.js`.
