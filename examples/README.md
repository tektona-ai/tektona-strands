# Examples

Each example is a small project. Copy one folder to start your own.

| Example | What it shows |
| --- | --- |
| [`quickstart`](quickstart) | Create a sandbox, run an agent in it, delete the sandbox. |
| [`seeded-workspace`](seeded-workspace) | Write input files, let the agent work, read the result back. |
| [`full-agent`](full-agent) | A full Strands agent: custom tool, system prompt, live streaming, typed result, and a second turn. |
| [`subagent`](subagent) | An orchestrator delegates coding to a sub-agent that works in the sandbox. Any OpenAI-compatible model. |
| [`open-hub-agent`](open-hub-agent) | An agent with a model from an AI hub such as LiteLLM or OpenCode Go. No Anthropic, OpenAI or AWS account. |

## Run an example

1. Set your Tektona API key, organization and project.

   ```bash
   export TEKTONA_API_KEY=...   # create one in the Tektona console
   export TEKTONA_ORG=...
   export TEKTONA_PROJECT=...
   ```

   With the Tektona CLI (0.28 or later), skip the exports and use `eval "$(tektona env)"`, or
   start an example with `tektona env -- npm start`.

2. Set the model credentials. `subagent` and `open-hub-agent` use any OpenAI-compatible endpoint and read
   `HUB_BASE_URL`, `HUB_MODEL` and `HUB_API_KEY` (see [`open-hub-agent`](open-hub-agent)).
   The other agent examples use the Strands default model, Amazon Bedrock. See the
   [Strands TypeScript quickstart](https://strandsagents.com/docs/user-guide/sdk/quickstart/typescript/)
   for the variables each provider needs.

3. Build the package once. The examples depend on the local copy.

   ```bash
   npm install && npm run build
   ```

4. Run the example.

   ```bash
   cd examples/quickstart
   npm install
   npm start
   ```

In your own project, depend on `"@tektona/strands": "^0.1.0"` instead of `file:../..`.

Each example creates a sandbox and deletes it in a `finally` block. If the process is killed, the
sandbox keeps running. Delete it with the Tektona CLI or console.
