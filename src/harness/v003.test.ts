import { describe, expect, it } from 'vitest'
import type { IncidentSessionRequest } from './adapter'
import {
  ROOK_V003_MCP_ATTACHMENT,
  ROOK_V003_MCP_SERVER_NAME,
  ROOK_V003_RUNTIME_GUARDRAILS,
  buildV003ReadOnlyInstructions,
} from './v003'

const request: IncidentSessionRequest = {
  incidentId: 'INC-2048',
  title: 'Inventory Retry Storm',
  objective: 'Investigate the owned non-production demo incident with read-only evidence only.',
}

describe('ROOK v0.003 TrueForge authority contract', () => {
  it('pins exactly one named MCP server to the positive @read-only selector', () => {
    expect(ROOK_V003_MCP_SERVER_NAME).toBe('rook-inventory-retry-storm')
    expect(ROOK_V003_MCP_ATTACHMENT).toEqual({
      name: 'rook-inventory-retry-storm',
      enableTools: ['@read-only'],
      preload: false,
    })
    expect(Object.isFrozen(ROOK_V003_MCP_ATTACHMENT)).toBe(true)
    expect(Object.isFrozen(ROOK_V003_MCP_ATTACHMENT.enableTools)).toBe(true)
  })

  it('disables every unrelated default capability and bounds agent-loop iterations', () => {
    expect(ROOK_V003_RUNTIME_GUARDRAILS).toEqual({
      iterationLimit: 12,
      sandboxEnabled: false,
      dynamicSubAgentsEnabled: false,
      askUserQuestionsEnabled: false,
      generativeUiEnabled: false,
    })
    expect(Object.isFrozen(ROOK_V003_RUNTIME_GUARDRAILS)).toBe(true)
  })

  it('labels the source as owned non-production demo evidence and preserves claim-state doctrine', () => {
    const instructions = buildV003ReadOnlyInstructions(request)
    expect(instructions).toContain('owned, fictional, non-production demo system')
    expect(instructions).toContain('Never present its observations as production telemetry')
    expect(instructions).toContain('Use only MCP tools exposed by the @read-only selector')
    expect(instructions).toContain('Treat MCP tool output as observed evidence')
    expect(instructions).toContain('causal explanations as inferred')
    expect(instructions).toContain('INC-2048 — Inventory Retry Storm')
  })
})
