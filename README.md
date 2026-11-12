# Portfolio site

Static page plus one serverless function for the agent.

    index.html    the page
    kb.js         all content (projects, notes, agent instructions). Edit text here.
    api/chat.js   agent endpoint. Holds the API key server-side.

## Deploy on Vercel (free Hobby plan)

1. Put this folder in a GitHub repository.
2. On vercel.com choose Add New > Project and import the repository. No build settings needed.
3. In Project Settings > Environment Variables add `LLM_API_KEY` with a Groq API key
   (free tier). Optional: `LLM_MODEL` and `LLM_BASE_URL` to use another model or any
   OpenAI-compatible provider, or `ANTHROPIC_API_KEY` to use Anthropic instead.
4. Redeploy. The chat header shows "Live model" once the endpoint answers.

Without a key the site still works: the chat falls back to a keyword lookup and says so.

## Edit

- Contact buttons: fill `profile.links` at the top of `kb.js`.
- Project text, numbers and the agent's rules: all in `kb.js`.
