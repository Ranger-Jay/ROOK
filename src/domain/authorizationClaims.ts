export interface AuthorizationClaimStore {
  /**
   * Atomically claims an authorization id for one-time execution.
   * Implementations must return false when the id was already claimed.
   * Persistent/distributed implementations must use a durable compare-and-set,
   * unique constraint, transaction, or equivalent atomic primitive.
   */
  claimOnce(authorizationId: string): Promise<boolean>
}

/**
 * Test/demo-process implementation only. JavaScript run-to-completion makes the
 * check-and-add atomic within one process, but this is not a distributed store.
 */
export class InMemoryAuthorizationClaimStore implements AuthorizationClaimStore {
  private readonly claimed = new Set<string>()

  async claimOnce(authorizationId: string): Promise<boolean> {
    if (this.claimed.has(authorizationId)) {
      return false
    }

    this.claimed.add(authorizationId)
    return true
  }
}
