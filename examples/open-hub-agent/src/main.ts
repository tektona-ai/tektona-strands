import { Agent } from '@strands-agents/sdk'
import { OpenAIModel } from '@strands-agents/sdk/models/openai'
import { Tektona } from '@tektona/sdk'
import { TektonaSandbox } from '@tektona/strands'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Set ${name}.`)
  return value
}

// The hub speaks the OpenAI chat protocol. The model behind it can be any model the hub serves.
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
  const agent = new Agent({
    model,
    sandbox: new TektonaSandbox({
      sandbox,
      workingDir: '/home/tektona/workspace',
    }),
    systemPrompt:
      'You are a software engineer. Work only in /home/tektona/workspace. ' +
      'Write the code, run the tests, and fix failures until they pass. Then summarize what you built.',
  })
  // Run this one from / because workingDir does not exist yet.
  await agent.sandbox.execute('mkdir -p /home/tektona/workspace', {
    cwd: '/',
  })

  await agent.invoke(
    'Create a Node.js command line tool `wordcount` that reads text from stdin and prints the number of words. ' +
      'Add tests with `node --test`. Run them.',
  )
} finally {
  await tek.sandbox.delete(sandbox.id)
}
