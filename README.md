# @tektona/strands

<p>
  <a href="https://tektona.ai">
    <img src=".github/assets/tektona-logo.png" alt="Tektona" width="400">
  </a>
</p>

Run [Strands Agents](https://strandsagents.com) shell commands and file operations in a
[Tektona](https://tektona.ai) sandbox. The agent stays on your host. Only commands and file
operations enter the sandbox.

> Alpha: the API may change before `1.0`.

## Install

```bash
npm install @tektona/strands @strands-agents/sdk @tektona/sdk
```

Node.js 22.12 or later.

Set your Tektona API key, organization and project:

```bash
export TEKTONA_API_KEY=...   # create one in the Tektona console
export TEKTONA_ORG=...
export TEKTONA_PROJECT=...
```

With the [Tektona CLI](https://docs.tektona.ai/cli-reference/context#use-the-context-in-sdks-and-scripts)
(0.28 or later), skip the exports. `tektona env` sets the variables from the CLI's context for the
current folder:

```bash
tektona env -- node app.js   # run one command with the variables
eval "$(tektona env)"        # or set them in the current shell
```

## Use

```ts
import { Agent, BedrockModel } from '@strands-agents/sdk'
import { Tektona } from '@tektona/sdk'
import { TektonaSandbox } from '@tektona/strands'

// Reads TEKTONA_API_KEY, TEKTONA_ORG and TEKTONA_PROJECT.
const tek = new Tektona()

// Create a fresh sandbox from the desktop template.
const sandbox = await tek.sandbox.create({
  template: 'tektona/desktop',
})

try {
  const agent = new Agent({
    // Any Strands model works. This one uses your AWS credentials.
    model: new BedrockModel({
      modelId: 'eu.anthropic.claude-sonnet-5-5',
      region: 'eu-central-1',
    }),
    systemPrompt: 'You are a coding assistant. Run code in the sandbox to check it works.',
    sandbox: new TektonaSandbox({ sandbox }),
  })
  const result = await agent.invoke('Write a Python script that prints the first 10 Fibonacci numbers and run it')
  console.log(result.toString())
} finally {
  // Delete the sandbox when the job is done.
  await tek.sandbox.delete(sandbox.id)
}
```

The agent gets the `sandbox_shell` and `sandbox_file_editor` tools. Both run in the Tektona sandbox.

This package does not create or delete sandboxes. Create and delete them with `@tektona/sdk`, as above.
To use a sandbox that already runs, call `TektonaSandbox.connect('my-sandbox')` with its ID or name.
See [`examples/`](examples).

## Security

A sandbox is a boundary only when the environment behind it is isolated. Whatever the agent can reach
inside the Tektona sandbox, it can use. Restrict the sandbox with an egress network policy and give
it only the secrets the task needs.

## Test

```bash
npm test                  # unit tests
npm run test:integration  # needs TEKTONA_API_KEY, TEKTONA_ORG, TEKTONA_PROJECT, TEKTONA_TEST_SANDBOX
```

## Release

Commits on `main` follow [Conventional Commits](https://www.conventionalcommits.org). release-please keeps a
release PR open with the next version and the changelog. Merging it tags the version and creates the GitHub
release. The npm publish then waits for an approval and runs with npm trusted publishing, so the repository
holds no npm token.

## License

MIT
