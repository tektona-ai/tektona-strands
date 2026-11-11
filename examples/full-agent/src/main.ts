import { Agent, tool } from '@strands-agents/sdk'
import { Tektona } from '@tektona/sdk'
import { TektonaSandbox } from '@tektona/strands'
import { z } from 'zod'

const tek = new Tektona()
const sandbox = await tek.sandbox.create({
  template: 'tektona/desktop',
})

// A custom tool. It runs on your machine, next to the sandbox tools that run in the sandbox.
// Here it stands in for an issue tracker the sandbox cannot reach.
const getTicket = tool({
  name: 'get_ticket',
  description: 'Get a bug ticket from the issue tracker by its ID.',
  inputSchema: z.object({
    id: z.string().describe('Ticket ID, for example BUG-17'),
  }),
  callback: ({ id }) => ({
    id,
    title: 'Cart total is wrong when a discount is applied',
    body: 'The project is in /home/tektona/shop. Run `python3 -m unittest` there to see the failure.',
  }),
})

// The typed result the agent must return.
const Report = z.object({
  rootCause: z.string(),
  filesChanged: z.array(z.string()),
  testsPass: z.boolean(),
})

try {
  const agent = new Agent({
    sandbox: new TektonaSandbox({
      sandbox,
      workingDir: '/home/tektona/shop',
    }),
    tools: [getTicket],
    // This example prints the stream itself.
    printer: false,
    systemPrompt: 'You are a careful engineer. Fix bugs with the smallest change, and run the tests before you finish.',
  })

  // Seed a small project with a bug.
  // Run this one from / because workingDir does not exist yet.
  await agent.sandbox.execute('mkdir -p /home/tektona/shop', {
    cwd: '/',
  })
  await agent.sandbox.writeText(
    '/home/tektona/shop/cart.py',
    'def total(prices, discount=0):\n    return sum(prices) - discount * 100\n',
  )
  await agent.sandbox.writeText(
    '/home/tektona/shop/test_cart.py',
    [
      'import unittest',
      'from cart import total',
      '',
      'class TestCart(unittest.TestCase):',
      '    def test_discount_is_a_fraction(self):',
      '        self.assertAlmostEqual(total([10, 30], discount=0.25), 30)',
      '',
    ].join('\n'),
  )

  // Turn 1: stream the work live, then read the typed report.
  const stream = agent.stream('Fix ticket BUG-17.', {
    structuredOutputSchema: Report,
  })
  let next = await stream.next()
  while (!next.done) {
    const event = next.value
    // Print the model's text as it arrives.
    if (
      event.type === 'modelStreamUpdateEvent' &&
      event.event.type === 'modelContentBlockDeltaEvent' &&
      event.event.delta.type === 'textDelta'
    ) {
      process.stdout.write(event.event.delta.text)
    }
    // Print each tool call before it runs.
    if (event.type === 'beforeToolCallEvent') {
      console.log(`\n> ${event.toolUse.name} ${JSON.stringify(event.toolUse.input)}`)
    }
    next = await stream.next()
  }
  const report = Report.parse(next.value.structuredOutput)
  console.log('\nReport:', report)

  // Turn 2: the agent keeps the conversation and the sandbox from turn 1.
  const followUp = await agent.invoke('Add a test for a discount of 0, and run all tests again.')
  console.log('\n' + followUp.toString())
} finally {
  await tek.sandbox.delete(sandbox.id)
}
