import { Agent } from '@strands-agents/sdk'
import { Tektona } from '@tektona/sdk'
import { TektonaSandbox } from '@tektona/strands'

const tek = new Tektona()
const sandbox = await tek.sandbox.create({
  template: 'tektona/desktop',
})
try {
  const agent = new Agent({
    sandbox: new TektonaSandbox({ sandbox }),
  })

  // Put input files in the sandbox, let the agent work, then read the result back.
  await agent.sandbox.writeText('/tmp/input.csv', 'id,value\n1,42\n2,17\n3,99\n')

  await agent.invoke('Read /tmp/input.csv. Write the sum of the value column to /tmp/out.txt.')

  console.log('out.txt:', await agent.sandbox.readText('/tmp/out.txt'))
} finally {
  await tek.sandbox.delete(sandbox.id)
}
