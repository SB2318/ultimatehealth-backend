
//   Prevents cascading system failures when third-party services (Gemini, S3, Firebase, SMTP, PocketBase, VeriWise) degrade.
 
//   States:
//    - CLOSED: Normal operation. Requests pass through.
//    - OPEN: Service is failing. Requests fail-fast immediately without hitting external API.
//    - HALF_OPEN: Cooldown expired. Testing if upstream service has recovered.
 

class CircuitBreaker {
    constructor(serviceName, options = {}) {
        this.serviceName = serviceName;

        // Consec failures before opening the circuit
        this.failureThreshold = options.failureThreshold || 5; 
        
        // Cooldown period in ms (30s)
        this.resetTimeout = options.resetTimeout || 30000;  
        
        // Per-request timeout in ms (15s)
        this.requestTimeout = options.requestTimeout || 15000; 

        this.state = 'CLOSED';
        this.failureCount = 0;
        this.nextAttempt = Date.now();
    }

   
     // Executes an async action wrapped in circuit breaker protection.
     // @param {Function} action - Async function making the external call.
     // @param {Function} [fallback] - Optional fallback function if circuit is OPEN or fails.
     // @returns {Promise} - Resolves with action result or fallback result.
    async execute(action, fallback = null) {
        if (this.state === 'OPEN') {
            if (Date.now() > this.nextAttempt) {
                this.state = 'HALF_OPEN';
                console.log(`[CircuitBreaker:${this.serviceName}] Cooldown expired. Switching to HALF_OPEN (probe request).`);
            } else {
                console.warn(`[CircuitBreaker:${this.serviceName}] Circuit is OPEN. Fast-failing external call.`);
                if (fallback) {
                    return fallback(new Error(`[CircuitBreaker] ${this.serviceName} is temporarily offline.`));
                }
                throw new Error(`[CircuitBreaker] Service ${this.serviceName} is currently unavailable.`);
            }
        }

        try {
            // Race the action against the request timeout limit
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(`[CircuitBreaker:${this.serviceName}] Request Timeout exceeded (${this.requestTimeout}ms)`));
                }, this.requestTimeout);
            });
           
            // Each request creates its own Promise.race() bucket. The requests are not competing with each other.
            const result = await Promise.race([action(), timeoutPromise]);
            clearTimeout(timeoutId);

            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            if (fallback) {
                return fallback(error);
            }
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            console.log(`[CircuitBreaker:${this.serviceName}] Upstream service recovered! Circuit reset to CLOSED.`);
        }
    }

    onFailure(error) {
        this.failureCount++;
        console.error(`[CircuitBreaker:${this.serviceName}] Call Failed (${this.failureCount}/${this.failureThreshold}): ${error.message}`);

        if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.resetTimeout;
            console.error(`[CircuitBreaker:${this.serviceName}] Threshold reached. Circuit is now OPEN for ${this.resetTimeout / 1000}s.`);
        }
    }

    getStatus() {
        return {
            service: this.serviceName,
            state: this.state,
            failureCount: this.failureCount,
            nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null,
        };
    }
}



const geminiBreaker = new CircuitBreaker('Google_Gemini_AI', {
    failureThreshold: 3,
    resetTimeout: 45000,   // 45s cooldown
    requestTimeout: 20000,  // 20s execution timeout
});

const veriwiseBreaker = new CircuitBreaker('VeriWise_Python_AI', {
    failureThreshold: 3,
    resetTimeout: 30000,   // 30s cooldown
    requestTimeout: 30000,  // 30s execution timeout
});

const s3Breaker = new CircuitBreaker('AWS_S3_Storage', {
    failureThreshold: 5,
    resetTimeout: 30000,   // 30s cooldown
    requestTimeout: 15000,  // 15s execution timeout
});

const firebaseBreaker = new CircuitBreaker('Firebase_Auth_FCM', {
    failureThreshold: 4,
    resetTimeout: 30000,   // 30s cooldown
    requestTimeout: 10000,  // 10s execution timeout
});

const emailBreaker = new CircuitBreaker('Nodemailer_SMTP', {
    failureThreshold: 5,
    resetTimeout: 60000,   // 60s cooldown
    requestTimeout: 15000,  // 15s execution timeout
});

const pocketbaseBreaker = new CircuitBreaker('PocketBase_CMS', {
    failureThreshold: 4,
    resetTimeout: 20000,   // 20s cooldown
    requestTimeout: 10000,  // 10s execution timeout
});


const allBreakers = [
    geminiBreaker,
    veriwiseBreaker,
    s3Breaker,
    firebaseBreaker,
    emailBreaker,
    pocketbaseBreaker,
];


// @returns {Array} - Array of circuit breaker status objects.
const getCircuitBreakerHealth = () => {
    return allBreakers.map((breaker) => breaker.getStatus());
};

module.exports = {
    CircuitBreaker,
    geminiBreaker,
    veriwiseBreaker,
    s3Breaker,
    firebaseBreaker,
    emailBreaker,
    pocketbaseBreaker,
    getCircuitBreakerHealth,
};
