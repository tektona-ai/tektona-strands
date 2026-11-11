# open-hub-agent

Run a Strands agent with a model from an AI hub. The agent runs on your machine. Its shell and file
tools run in a Tektona sandbox. No Anthropic, OpenAI or AWS account is needed.

An AI hub is a gateway that serves many models behind one OpenAI-compatible endpoint. LiteLLM and
OpenCode Go are examples. Any hub with that API works.

## Run

Set `TEKTONA_API_KEY`, `TEKTONA_ORG` and `TEKTONA_PROJECT`, or use `tektona env` (see the
[examples README](../README.md)). Set the hub variables below. Then build the package once and run:

```bash
npm install && npm run build   # at the repository root
cd examples/open-hub-agent
npm install
npm start
```

| Variable | Use |
| --- | --- |
| `HUB_BASE_URL` | OpenAI-compatible base URL of the hub, with `/v1`. For example `https://hub.example.com/v1`. |
| `HUB_MODEL` | Model ID as the hub names it. |
| `HUB_API_KEY` | API key for the hub. |

Use a model that supports tool calls. A model without them cannot run the shell and file tools.

For OpenCode Go, set `HUB_BASE_URL=https://opencode.ai/inference/go/openai/v1` and pick a model with
the `chat-completions` API, for example `kimi-k3`.
