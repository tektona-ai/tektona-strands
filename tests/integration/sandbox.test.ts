import { describe, expect, it } from 'vitest'
import { SandboxTimeoutError } from '@strands-agents/sdk'
import { TektonaSandbox } from '../../src/index.js'

// Needs TEKTONA_API_KEY, TEKTONA_ORG and TEKTONA_PROJECT,
// and TEKTONA_TEST_SANDBOX: the ID or name of a running sandbox.
const target = process.env.TEKTONA_TEST_SANDBOX

describe.skipIf(!target)('TektonaSandbox against a running sandbox', () => {
  const connect = () => TektonaSandbox.connect(target!)

  it('returns the output of a fast command', async () => {
    const r = await (await connect()).execute('echo hi')
    expect(r).toMatchObject({ exitCode: 0, stdout: 'hi\n', stderr: '' })
  })

  it('separates stderr and returns the exit code', async () => {
    const r = await (await connect()).execute('echo out; echo err >&2; exit 4')
    expect(r).toMatchObject({ exitCode: 4, stdout: 'out\n', stderr: 'err\n' })
  })

  it('applies cwd and env', async () => {
    const r = await (await connect()).execute('pwd; echo $FOO', { cwd: '/tmp', env: { FOO: 'bar' } })
    expect(r.stdout).toBe('/tmp\nbar\n')
  })

  it('times out a long command', async () => {
    await expect((await connect()).execute('sleep 30', { timeout: 2 })).rejects.toBeInstanceOf(SandboxTimeoutError)
  })

  it('runs code through an interpreter', async () => {
    const r = await (await connect()).executeCode('print(6 * 7)', 'python3')
    expect(r.stdout.trim()).toBe('42')
  })

  it('round-trips text and binary files', async () => {
    const sb = await connect()
    const path = `/tmp/tektona-strands-${Date.now()}`
    await sb.writeText(path, 'héllo\n')
    expect(await sb.readText(path)).toBe('héllo\n')
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i)
    await sb.writeFile(path, bytes)
    expect(await sb.readFile(path)).toEqual(bytes)
    await sb.removeFile(path)
  })

  it('round-trips a 1 MiB file', async () => {
    const sb = await connect()
    const path = `/tmp/tektona-strands-big-${Date.now()}`
    const bytes = new Uint8Array(1024 * 1024).map((_, i) => i % 251)
    await sb.writeFile(path, bytes)
    expect(await sb.readFile(path)).toEqual(bytes)
    await sb.removeFile(path)
  })
})
