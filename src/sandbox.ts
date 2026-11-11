import {
  PosixShellSandbox,
  SandboxAbortError,
  SandboxTimeoutError,
  type Tool,
} from '@strands-agents/sdk'
import type {
  ExecuteOptions,
  ExecutionResult,
  StreamChunk,
} from '@strands-agents/sdk/sandbox'
import {
  DEFAULT_FILE_EDITOR_DESCRIPTION,
  makeFileEditor,
} from '@strands-agents/sdk/vended-tools/file-editor'
import {
  SANDBOX_SHELL_DESCRIPTION,
  makeShell,
} from '@strands-agents/sdk/vended-tools/shell'
import { Tektona, type Sandbox, type TektonaOptions } from '@tektona/sdk'

export interface TektonaSandboxOptions {
  /** A running Tektona sandbox. */
  sandbox: Sandbox
  /** Default working directory. Omit to use the sandbox default. */
  workingDir?: string
  /** Linux user for commands. Omit to use the image default. */
  user?: string
}

/**
 * Run Strands commands and file operations in a Tektona sandbox.
 *
 * The sandbox must exist and run. This class does not create, pause or delete it.
 */
export class TektonaSandbox extends PosixShellSandbox {
  readonly sandbox: Sandbox
  readonly workingDir: string | undefined
  readonly user: string | undefined

  constructor(options: TektonaSandboxOptions) {
    super()
    this.sandbox = options.sandbox
    this.workingDir = options.workingDir
    this.user = options.user
  }

  /** Look up a sandbox by ID or name. Credentials come from `TEKTONA_*` env vars unless `client` sets them. */
  static async connect(
    idOrName: string,
    options: Omit<TektonaSandboxOptions, 'sandbox'> & { client?: TektonaOptions } = {},
  ): Promise<TektonaSandbox> {
    const { client, ...rest } = options
    const sandbox = await new Tektona(client).sandbox.get(idOrName)
    return new TektonaSandbox({ ...rest, sandbox })
  }

  async *executeStreaming(
    command: string,
    options?: ExecuteOptions,
  ): AsyncGenerator<StreamChunk | ExecutionResult, void, undefined> {
    const signal = options?.signal
    if (signal?.aborted) throw new SandboxAbortError()

    const timeout = options?.timeout !== undefined && options.timeout > 0 ? options.timeout : undefined
    const handle = await this.sandbox.process.start(command, {
      cwd: options?.cwd ?? this.workingDir,
      env: options?.env,
      user: this.user,
      timeoutSeconds: timeout === undefined ? undefined : Math.ceil(timeout),
    })

    let finished = false
    const stop = () => handle.stop({ force: true }).catch(() => undefined)
    const onAbort = () => void stop()
    signal?.addEventListener('abort', onAbort, { once: true })

    const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() }
    let stdout = ''
    let stderr = ''
    try {
      for await (const event of handle.logs({ follow: true })) {
        const streamType = event.stream === 'stderr' ? 'stderr' : 'stdout'
        const data = decoders[streamType].decode(event.data, { stream: true })
        if (data === '') continue
        if (streamType === 'stderr') stderr += data
        else stdout += data
        yield { type: 'streamChunk', data, streamType }
      }
      for (const streamType of ['stdout', 'stderr'] as const) {
        const data = decoders[streamType].decode()
        if (data === '') continue
        if (streamType === 'stderr') stderr += data
        else stdout += data
        yield { type: 'streamChunk', data, streamType }
      }

      const exitCode = await handle.wait()
      finished = true
      if (signal?.aborted) throw new SandboxAbortError()
      if (timeout !== undefined && exitCode !== 0) {
        const done = await this.sandbox.process.getById(handle.id)
        if (done.finishReason === 'timeout') throw new SandboxTimeoutError(timeout, stdout, stderr)
      }
      yield { type: 'executionResult', exitCode, stdout, stderr, outputFiles: [] }
    } finally {
      signal?.removeEventListener('abort', onAbort)
      // The consumer stopped reading or an error occurred: do not leave the process running.
      if (!finished) await stop()
    }
  }

  override getTools(): Tool[] {
    const cwd = this.workingDir ? ` Working directory: ${this.workingDir}.` : ''
    return [
      makeFileEditor(this, {
        name: 'sandbox_file_editor',
        description: `${DEFAULT_FILE_EDITOR_DESCRIPTION} Files are in Tektona sandbox "${this.sandbox.id}".`,
      }),
      makeShell(this, {
        name: 'sandbox_shell',
        description: `${SANDBOX_SHELL_DESCRIPTION} Runs in Tektona sandbox "${this.sandbox.id}".${cwd}`,
      }),
    ]
  }
}
