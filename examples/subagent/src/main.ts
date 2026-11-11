import { Agent } from '@strands-agents/sdk'
import { OpenAIModel } from '@strands-agents/sdk/models/openai'
import { Tektona } from '@tektona/sdk'
import { TektonaSandbox } from '@tektona/strands'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Set ${name}.`)
  return value
}

// Any OpenAI-compatible endpoint works: OpenAI, OpenCode Go, LiteLLM, and others.
const model = new OpenAIModel({
  api: 'chat',
  modelId: required('HUB_MODEL'),
  apiKey: required('HUB_API_KEY'),
  clientConfig: {
    baseURL: required('HUB_BASE_URL'),
    // Some hubs, such as OpenCode Go, need a client name and one session ID per conversation.
    // Other hubs ignore these headers.
    defaultHeaders: {
      'User-Agent': 'tektona-strands-example/0.1',
      'x-opencode-session': crypto.randomUUID(),
    },
  },
})

const tek = new Tektona()
const sandbox = await tek.sandbox.create({
  template: 'tektona/desktop',
})
try {
  // The sub-agent writes and runs code. Its shell and file tools run in the Tektona sandbox.
  const coder = new Agent({
    name: 'coder',
    description: 'Writes and runs code in an isolated sandbox. Give it one clear coding task.',
    model,
    sandbox: new TektonaSandbox({ sandbox }),
    printer: false,
  })

  // The orchestrator only plans and delegates. Its only tool is the coder.
  // `sandbox: false` opts out of a sandbox explicitly, so it never runs commands on your machine.
  const orchestrator = new Agent({
    model,
    sandbox: false,
    tools: [coder],
    systemPrompt: 'Break the task into steps. Delegate every coding step to the coder tool. Do not write code yourself.',
  })

  await orchestrator.invoke(
    'Write a Python script that counts the words in a text. Test it on three sample strings and report the results.',
  )
} finally {
  await tek.sandbox.delete(sandbox.id)
}
