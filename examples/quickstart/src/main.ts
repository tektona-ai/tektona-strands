import { Agent } from '@strands-agents/sdk'
import { Tektona } from '@tektona/sdk'
import { TektonaSandbox } from '@tektona/strands'

// Reads TEKTONA_API_KEY, TEKTONA_ORG and TEKTONA_PROJECT.
const tek = new Tektona()

// Strands does not create sandboxes, so create one and delete it when the run ends.
const sandbox = await tek.sandbox.create({
  template: 'tektona/desktop',
})
try {
  const agent = new Agent({
    sandbox: new TektonaSandbox({ sandbox }),
  })
  await agent.invoke(
    'Write a Python script that prints the first 10 Fibonacci numbers. Run it and show the output.',
  )
} finally {
  await tek.sandbox.delete(sandbox.id)
}
