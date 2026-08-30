import { TrueForge, isEventDelta, mergeEventDelta, type TrueForgeApi } from '@truefoundry/trueforge-sdk'
import { assertTrueForgeSdkBaseUrl } from './localProxy'
import { ROOK_V003_MCP_ATTACHMENT } from './v003'
import { ROOK_V004_RUNTIME_GUARDRAILS } from './v004'
import {
  HarnessProtocolError,
  type LocalTrueForgeTransportConfig,
  type TrueForgeSessionSeed,
  type TrueForgeStreamItem,
} from './trueforge'

export interface V004SplitAuthorityTransport {
  createObservationSession(seed: TrueForgeSessionSeed): Promise<{ id: string }>
  createReproductionSession(seed: TrueForgeSessionSeed): Promise<{ id: string }>
  streamTurn(sessionId: string, instruction: string): AsyncIterable<TrueForgeStreamItem>
}

export const buildV004ObservationAgentSpec = (seed: TrueForgeSessionSeed) => ({
  model: { name: seed.modelName },
  instructions: seed.instructions,
  mcpServers: [{
    name: ROOK_V003_MCP_ATTACHMENT.name,
    enableTools: [...ROOK_V003_MCP_ATTACHMENT.enableTools],
    preload: ROOK_V003_MCP_ATTACHMENT.preload,
  }],
  skills: [],
  config: {
    iterationLimit: ROOK_V004_RUNTIME_GUARDRAILS.iterationLimit,
    sandbox: { enabled: false },
    dynamicSubAgents: { enabled: ROOK_V004_RUNTIME_GUARDRAILS.dynamicSubAgentsEnabled },
    askUserQuestions: { enabled: ROOK_V004_RUNTIME_GUARDRAILS.askUserQuestionsEnabled },
    generativeUi: { enabled: ROOK_V004_RUNTIME_GUARDRAILS.generativeUiEnabled },
  },
})

export const buildV004ReproductionAgentSpec = (seed: TrueForgeSessionSeed) => ({
  model: { name: seed.modelName },
  instructions: seed.instructions,
  // Intentionally no mcpServers property: this session has sandbox-only authority.
  skills: [],
  config: {
    iterationLimit: ROOK_V004_RUNTIME_GUARDRAILS.iterationLimit,
    sandbox: {
      enabled: ROOK_V004_RUNTIME_GUARDRAILS.sandboxEnabled,
      fileDownloads: ROOK_V004_RUNTIME_GUARDRAILS.sandboxFileDownloadsEnabled,
    },
    dynamicSubAgents: { enabled: ROOK_V004_RUNTIME_GUARDRAILS.dynamicSubAgentsEnabled },
    askUserQuestions: { enabled: ROOK_V004_RUNTIME_GUARDRAILS.askUserQuestionsEnabled },
    generativeUi: { enabled: ROOK_V004_RUNTIME_GUARDRAILS.generativeUiEnabled },
  },
})

/**
 * v0.004 deliberately separates authority across two inline TrueForge sessions.
 * The observation session can reach only the owned read-only MCP source and has
 * no sandbox. The reproduction session has a sandbox but no MCP connector at all.
 *
 * Besides reducing authority, omitting MCP servers from the reproduction session
 * prevents TrueForge's deferred MCP discovery helpers from competing with the
 * managed sandbox exec tool in the constrained local model's tool context.
 */
export class V004SplitAuthoritySdkTransport implements V004SplitAuthorityTransport {
  private readonly client: TrueForge

  constructor(config: LocalTrueForgeTransportConfig) {
    this.client = new TrueForge({
      baseUrl: assertTrueForgeSdkBaseUrl(config.baseUrl),
      timeoutInSeconds: config.timeoutInSeconds ?? 600,
    })
  }

  async createObservationSession(seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    const { data } = await this.client.sessions.create({
      agent: { spec: buildV004ObservationAgentSpec(seed) },
    })
    return { id: data.id }
  }

  async createReproductionSession(seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    const { data } = await this.client.sessions.create({
      agent: { spec: buildV004ReproductionAgentSpec(seed) },
    })
    return { id: data.id }
  }

  async *streamTurn(sessionId: string, instruction: string): AsyncIterable<TrueForgeStreamItem> {
    const stream = await this.client.sessions.createTurnStream(sessionId, {
      input: [{ type: 'user.message', content: instruction }],
    })
    const pendingModelMessages = new Map<string, TrueForgeApi.ModelMessageEvent>()

    for await (const item of stream.withMetadata()) {
      const event = item.data
      const sequence = item.id == null ? undefined : String(item.id)

      if (isEventDelta(event)) {
        const base = pendingModelMessages.get(event.id)
        if (!base) throw new HarnessProtocolError(`TrueForge model.message.delta ${event.id} arrived without its base model.message.`)
        mergeEventDelta(base, event)
        if (base.finishReason != null) {
          yield { event: base, sequence }
          pendingModelMessages.delete(event.id)
        }
        continue
      }

      if (event.type === 'model.message') {
        if (pendingModelMessages.has(event.id)) throw new HarnessProtocolError(`TrueForge repeated model.message base ${event.id}.`)
        pendingModelMessages.set(event.id, event)
        if (event.finishReason != null) {
          yield { event, sequence }
          pendingModelMessages.delete(event.id)
        }
        continue
      }

      yield { event, sequence }
    }

    if (pendingModelMessages.size > 0) {
      throw new HarnessProtocolError(`TrueForge stream ended with ${pendingModelMessages.size} unsettled model.message event(s).`)
    }
  }
}
