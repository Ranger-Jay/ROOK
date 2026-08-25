export interface AuditProvenanceStore {
  /**
   * Issues an opaque token bound to one canonical audit fingerprint.
   * Persistent/distributed implementations must store this binding durably.
   */
  issue(auditFingerprint: string): Promise<string>

  /** Verify that a token was issued by this store for this exact fingerprint. */
  verify(provenanceToken: string, auditFingerprint: string): Promise<boolean>
}

/**
 * Test/demo-process implementation only. Tokens are meaningful only inside this
 * process. Production/distributed execution must use a durable store-backed or
 * cryptographically authenticated implementation.
 */
export class InMemoryAuditProvenanceStore implements AuditProvenanceStore {
  private readonly issued = new Map<string, string>()
  private sequence = 0

  async issue(auditFingerprint: string): Promise<string> {
    this.sequence += 1
    const token = `audit-proof-${this.sequence}`
    this.issued.set(token, auditFingerprint)
    return token
  }

  async verify(provenanceToken: string, auditFingerprint: string): Promise<boolean> {
    return this.issued.get(provenanceToken) === auditFingerprint
  }
}
