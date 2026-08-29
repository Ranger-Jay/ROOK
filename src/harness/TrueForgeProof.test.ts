import { describe, expect, it } from 'vitest'
import type { HarnessEvent } from './adapter'
import {
  V004_PROOF_INSTRUCTION,
  evidenceEventLabel,
  shouldPromoteReproducedEvidence,
} from './TrueForgeProof'
import {
  buildV004SandboxInstructions,
  ROOK_V004_SANDBOX_COMMAND,
  ROOK_V004_SANDBOX_INTENT,
} from './v004'

describe('TrueForge v0.004 proof truth boundary', () => {
  it('shows the authentic TrueForge terminal event name in the evidence row', () => {
    const event: HarnessEvent = {
      type: 'turn.completed',
      sessionId: 'session_live',
      status: 'done',
      requiredActionCount: 0,
      source: 'trueforge',
      sourceEventId: 'event_done',
      observedAt: '2026-08-29T19:08:15.474Z',
    }

    expect(evidenceEventLabel(event)).toBe('turn.done')
  })

  it('requires OBSERVED MCP evidence followed by the exact bounded sandbox reproduction', () => {
    expect(V004_PROOF_INSTRUCTION).toBe(buildV004SandboxInstructions({
      incidentId: 'INC-2048',
      title: 'Inventory Retry Storm',
      objective: 'Observe retry pressure from the owned non-production demo source, then reproduce the arithmetic in an isolated TrueForge sandbox without incident mutation.',
    }))
    expect(V004_PROOF_INSTRUCTION).toContain('First call get_retry_pressure exactly once')
    expect(V004_PROOF_INSTRUCTION).toContain('OBSERVED owned-demo evidence')
    expect(V004_PROOF_INSTRUCTION).toContain('sandbox exec tool exactly once')
    expect(V004_PROOF_INSTRUCTION).toContain(ROOK_V004_SANDBOX_INTENT)
    expect(V004_PROOF_INSTRUCTION).toContain(ROOK_V004_SANDBOX_COMMAND)
    expect(V004_PROOF_INSTRUCTION).toContain('sandbox exec arguments JSON must be exactly')
    expect(V004_PROOF_INSTRUCTION).toContain(JSON.stringify({
      intent: ROOK_V004_SANDBOX_INTENT,
      command: ROOK_V004_SANDBOX_COMMAND,
    }))
    expect(V004_PROOF_INSTRUCTION).toContain('OMIT cwd entirely. OMIT env entirely.')
    expect(V004_PROOF_INSTRUCTION).toContain('Never serialize optional sandbox fields as null.')
    expect(V004_PROOF_INSTRUCTION).toContain('REPRODUCED evidence')
    expect(V004_PROOF_INSTRUCTION).toContain('not production observation, applied remediation, or verified recovery')
    expect(V004_PROOF_INSTRUCTION).toContain('Do not supply files, network requests')
  })

  it('promotes the REPRODUCED claim card only after the whole proof reaches its final reproduced state', () => {
    expect(shouldPromoteReproducedEvidence('reproduced')).toBe(true)
    expect(shouldPromoteReproducedEvidence('failed')).toBe(false)
    expect(shouldPromoteReproducedEvidence('connecting')).toBe(false)
    expect(shouldPromoteReproducedEvidence('idle')).toBe(false)
    expect(shouldPromoteReproducedEvidence('unconfigured')).toBe(false)
  })

  it('retains distinct public labels for sandbox creation, execution, and return evidence', () => {
    const base = {
      sessionId: 'session_live',
      source: 'trueforge' as const,
      observedAt: '2026-08-29T19:08:15.474Z',
    }
    const started: HarnessEvent = {
      ...base,
      type: 'sandbox.started',
      sandboxId: 'rook.sandbox.01',
      sourceEventId: 'event_sandbox',
    }
    const called: HarnessEvent = {
      ...base,
      type: 'sandbox.exec.called',
      callId: 'call_sandbox',
      arguments: '{}',
      toolName: 'exec',
      sourceEventId: 'event_call',
    }
    const returned: HarnessEvent = {
      ...base,
      type: 'sandbox.exec.returned',
      callId: 'call_sandbox',
      content: '{}',
      sourceEventId: 'event_response',
    }

    expect(evidenceEventLabel(started)).toBe('sandbox.started')
    expect(evidenceEventLabel(called)).toBe('sandbox.exec.called')
    expect(evidenceEventLabel(returned)).toBe('sandbox.exec.returned')
  })
})
