import { describe, expect, it, vi } from 'vitest'
import { SandboxAbortError, SandboxTimeoutError } from '@strands-agents/sdk'
import type { Sandbox } from '@tektona/sdk'
import { TektonaSandbox } from './sandbox.js'

const enc = new TextEncoder()
const log = (stream: string, text: string | Uint8Array) => ({
  seq: 0,
  stream,
  ts: new Date(),
  data: typeof text === 'string' ? enc.encode(text) : text,
})

interface FakeOpts {
  events?: ReturnType<typeof log>[]
  exitCode?: number
  finishReason?: string
  hang?: boolean
}

function fake(opts: FakeOpts = {}) {
  const stop = vi.fn(async (_opts?: unknown) => undefined)
  let release: () => void = () => undefined
  const handle = {
    id: 'proc1',
    logs: async function* () {
      for (const e of opts.events ?? []) yield e
      if (opts.hang) await new Promise<void>((r) => (release = r))
    },
    wait: vi.fn(async () => opts.exitCode ?? 0),
    stop: vi.fn(async (o?: unknown) => {
      release()
      return stop(o)
    }),
  }
  const start = vi.fn(async (_cmd: string, _opts?: unknown) => handle)
  const getById = vi.fn(async () => ({ finishReason: opts.finishReason ?? 'exited' }))
  const sandbox = { id: 'sbx1', process: { start, getById } } as unknown as Sandbox
  return { sandbox, start, getById, handle, stop }
}

describe('TektonaSandbox.executeStreaming', () => {
  it('streams stdout and stderr separately and ends with the buffered result', async () => {
    const f = fake({ events: [log('stdout', 'a'), log('stderr', 'e'), log('stdout', 'b')], exitCode: 3 })
    const sb = new TektonaSandbox({ sandbox: f.sandbox })
    const out = []
    for await (const c of sb.executeStreaming('cmd')) out.push(c)
    expect(out).toEqual([
      { type: 'streamChunk', data: 'a', streamType: 'stdout' },
      { type: 'streamChunk', data: 'e', streamType: 'stderr' },
      { type: 'streamChunk', data: 'b', streamType: 'stdout' },
      { type: 'executionResult', exitCode: 3, stdout: 'ab', stderr: 'e', outputFiles: [] },
    ])
  })

  it('keeps a multi-byte character that is split across chunks', async () => {
    const bytes = enc.encode('é')
    const f = fake({ events: [log('stdout', bytes.slice(0, 1)), log('stdout', bytes.slice(1))] })
    const r = await new TektonaSandbox({ sandbox: f.sandbox }).execute('cmd')
    expect(r.stdout).toBe('é')
  })

  it('passes cwd, env, user and timeout to the process', async () => {
    const f = fake()
    const sb = new TektonaSandbox({ sandbox: f.sandbox, workingDir: '/w', user: 'dev' })
    await sb.execute('cmd', { env: { A: '1' }, timeout: 1.2 })
    expect(f.start).toHaveBeenCalledWith('cmd', {
      cwd: '/w',
      env: { A: '1' },
      user: 'dev',
      timeoutSeconds: 2,
    })
  })

  it('lets a per-call cwd override the default', async () => {
    const f = fake()
    await new TektonaSandbox({ sandbox: f.sandbox, workingDir: '/w' }).execute('cmd', { cwd: '/x' })
    expect(f.start.mock.calls[0]?.[1]).toMatchObject({ cwd: '/x' })
  })

  it('throws SandboxTimeoutError with the partial output when the process timed out', async () => {
    const f = fake({ events: [log('stdout', 'part')], exitCode: 137, finishReason: 'timeout' })
    const err = await new TektonaSandbox({ sandbox: f.sandbox })
      .execute('cmd', { timeout: 5 })
      .catch((e) => e)
    expect(err).toBeInstanceOf(SandboxTimeoutError)
    expect(err.stdout).toBe('part')
  })

  it('returns a non-zero exit code when the process did not time out', async () => {
    const f = fake({ exitCode: 2 })
    const r = await new TektonaSandbox({ sandbox: f.sandbox }).execute('cmd', { timeout: 5 })
    expect(r.exitCode).toBe(2)
  })

  it('throws SandboxAbortError without starting a process when the signal is already aborted', async () => {
    const f = fake()
    const ac = new AbortController()
    ac.abort()
    await expect(new TektonaSandbox({ sandbox: f.sandbox }).execute('cmd', { signal: ac.signal })).rejects.toBeInstanceOf(
      SandboxAbortError,
    )
    expect(f.start).not.toHaveBeenCalled()
  })

  it('kills the process and throws SandboxAbortError when the signal fires mid-run', async () => {
    const f = fake({ hang: true, exitCode: 137 })
    const ac = new AbortController()
    const p = new TektonaSandbox({ sandbox: f.sandbox }).execute('cmd', { signal: ac.signal })
    await new Promise((r) => setTimeout(r, 10))
    ac.abort()
    await expect(p).rejects.toBeInstanceOf(SandboxAbortError)
    expect(f.stop).toHaveBeenCalledWith({ force: true })
  })

  it('stops the process when the consumer quits early', async () => {
    const f = fake({ events: [log('stdout', 'a'), log('stdout', 'b')] })
    const it = new TektonaSandbox({ sandbox: f.sandbox }).executeStreaming('cmd')
    await it.next()
    await it.return(undefined)
    expect(f.stop).toHaveBeenCalledWith({ force: true })
  })
})

describe('TektonaSandbox.getTools', () => {
  it('vends sandbox_shell and sandbox_file_editor', () => {
    const names = new TektonaSandbox({ sandbox: fake().sandbox }).getTools().map((t) => t.name)
    expect(names.sort()).toEqual(['sandbox_file_editor', 'sandbox_shell'])
  })
})
