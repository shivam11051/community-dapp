/**
 * SAFE CALL WRAPPER
 * 
 * Wraps async contract calls with:
 * - Error handling
 * - Timeout protection (15 seconds)
 * - Automatic retry logic (up to 3 attempts)
 * - Fallback values
 * - Detailed logging
 * 
 * ────────────────────────────────────────────────────
 * USAGE EXAMPLES:
 * ────────────────────────────────────────────────────
 * 
 * 1. Simple call with fallback:
 *    ─────────────────────────────
 *    const group = await safeCall(
 *      () => contract.groups(1),
 *      { fallback: null, label: "Fetch group" }
 *    );
 * 
 * 2. With custom timeout and retry:
 *    ──────────────────────────────
 *    const members = await safeCall(
 *      () => contract.getMembers(gid),
 *      { 
 *        fallback: [],
 *        label: "Fetch members",
 *        timeout: 20000,  // 20 seconds
 *        retry: 3         // Try 3 times
 *      }
 *    );
 * 
 * 3. Multiple calls in parallel:
 *    ──────────────────────────
 *    const [group, members, infos] = await safeCallAll([
 *      [() => contract.groups(gid), { fallback: null, label: "Group" }],
 *      [() => contract.getMembers(gid), { fallback: [], label: "Members" }],
 *      [() => loadMemberInfos(gid, members), { fallback: {}, label: "Infos" }],
 *    ]);
 * 
 * 4. Transaction with confirmation:
 *    ───────────────────────────────
 *    const receipt = await safeTransaction(
 *      contract.approveGroup(gid),
 *      { 
 *        label: "Approve Group",
 *        confirmations: 1,
 *        timeout: 60000  // 60 seconds for tx
 *      }
 *    );
 */

/**
 * Execute async function with safety checks
 * 
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Configuration
 * @param {*} options.fallback - Value to return if all retries fail
 * @param {string} options.label - Description for logging
 * @param {number} options.timeout - Max time in milliseconds (default: 15000)
 * @param {number} options.retry - Number of retry attempts (default: 2)
 * @param {Function} options.onError - Callback on final error
 * 
 * @returns {Promise} Result or fallback value
 */
export async function safeCall(fn, options = {}) {
    const {
      fallback = null,
      label = "Call",
      timeout = 15000,
      retry = 2,
      onError = null,
    } = options;
  
    let lastError;
  
    // ─── RETRY LOOP ────────────────────────────────────────
    for (let attempt = 1; attempt <= retry; attempt++) {
      try {
        console.log(`⏳ ${label} (attempt ${attempt}/${retry})...`);
  
        // Create timeout promise (will reject after timeout ms)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout after ${timeout}ms`)),
            timeout
          )
        );
  
        // Race between function call and timeout
        // Whichever finishes first wins
        const result = await Promise.race([fn(), timeoutPromise]);
  
        console.log(`✅ ${label} succeeded`);
        return result;
  
      } catch (err) {
        lastError = err;
        
        // Log the error
        console.warn(
          `⚠️ ${label} failed (attempt ${attempt}/${retry}): ${err.message}`
        );
  
        // If this was the last attempt, return fallback
        if (attempt === retry) {
          console.error(`❌ ${label} failed after ${retry} attempts`);
          
          // Call error handler if provided
          if (onError) {
            try {
              onError(err);
            } catch (cbErr) {
              console.error("Error in onError callback:", cbErr);
            }
          }
          
          return fallback;
        }
  
        // Aggressive backoff for better UX: 200ms, 500ms, 1s
        const waitTime = attempt === 1 ? 200 : attempt === 2 ? 500 : 1000;
        console.log(`⏸️  Retrying in ${waitTime}ms...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  
    // Fallback (shouldn't reach here, but just in case)
    return fallback;
  }
  
  /**
   * Execute multiple calls in parallel with safety
   * 
   * @param {Array} calls - Array of [fn, options] pairs
   * 
   * @returns {Promise<Array>} Results in same order as input
   * 
   * @example
   * const [group, members] = await safeCallAll([
   *   [() => contract.groups(1), { fallback: null }],
   *   [() => contract.getMembers(1), { fallback: [] }],
   * ]);
   */
  export async function safeCallAll(calls) {
    console.log(`📊 Executing ${calls.length} calls in parallel...`);
    
    return Promise.all(
      calls.map(([fn, opts]) => safeCall(fn, opts))
    );
  }
  
  /**
   * Execute transaction with confirmation waiting
   * 
   * @param {Promise} txPromise - Transaction promise
   * @param {Object} options - Configuration
   * @param {string} options.label - Description for logging
   * @param {number} options.confirmations - Blocks to wait for (default: 1)
   * @param {number} options.timeout - Max time in milliseconds (default: 60000)
   * 
   * @returns {Promise} Receipt or null
   * 
   * @example
   * const receipt = await safeTransaction(
   *   contract.approveGroup(gid),
   *   { label: "Approve Group", confirmations: 1 }
   * );
   */
  export async function safeTransaction(txPromise, options = {}) {
    const {
      label = "Transaction",
      confirmations = 1,
      timeout = 60000,
    } = options;
  
    try {
      console.log(`📤 Sending ${label}...`);
  
      // Send transaction safely
      const tx = await safeCall(() => txPromise, {
        label,
        timeout,
        fallback: null,
      });
  
      // If transaction sending failed
      if (!tx) {
        console.error(`❌ ${label} failed to send`);
        return null;
      }
  
      // Log transaction hash
      console.log(`📋 TX Hash: ${tx.hash}`);
  
      // Wait for confirmations
      console.log(`⏳ Waiting ${confirmations} confirmation(s)...`);
      const receipt = await tx.wait(confirmations);
  
      // Log confirmation
      console.log(`✅ ${label} confirmed in block ${receipt.blockNumber}`);
      return receipt;
  
    } catch (err) {
      console.error(`❌ ${label} failed:`, err.message);
      return null;
    }
  }
  
  /**
   * Utility: Wrap contract calls for error tracking
   * 
   * @param {ethers.Contract} contract - Contract instance
   * @param {string} method - Method name
   * @param {Array} args - Method arguments
   * @param {Object} options - safeCall options
   * 
   * @returns {Promise} Result or fallback
   */
  export async function safeContractCall(contract, method, args = [], options = {}) {
    return safeCall(
      () => contract[method](...args),
      {
        label: `contract.${method}(${args.length} args)`,
        ...options,
      }
    );
  }
  
  /**
   * Utility: Chain multiple safeCall operations
   * 
   * @param {Array} operations - Array of [fn, options] pairs
   * @param {boolean} stopOnError - Stop if one fails
   * 
   * @returns {Promise<Array>} Results
   */
  export async function safeCallSequence(operations, stopOnError = false) {
    const results = [];
  
    for (const [fn, opts] of operations) {
      try {
        const result = await safeCall(fn, opts);
        results.push(result);
  
        if (stopOnError && result === (opts.fallback ?? null)) {
          console.warn("Stopping sequence due to failed operation");
          break;
        }
      } catch (err) {
        if (stopOnError) {
          throw err;
        }
        results.push(opts?.fallback ?? null);
      }
    }
  
    return results;
  }
  
  export default {
    safeCall,
    safeCallAll,
    safeTransaction,
    safeContractCall,
    safeCallSequence,
  };