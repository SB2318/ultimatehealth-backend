# UltimateHealth Backend — Infrastructure & Server Security Audit

**Audit Date:** 2026-11-17  
**Scope:** Container Configurations, Docker Compose, Port Exposures, Network Boundaries, Kafka Broker Security, Express Pipeline Hardening, and Dependencies  
**Application:** UltimateHealth Backend (`main` @ `6e3392d`)  

---

## 1. Executive Summary

The infrastructure architecture of UltimateHealth employs Docker Compose to orchestrate five core services:
1. `api`: The Node.js Express backend application (port 4000)
2. `mongodb`: Mongo 6.0 document database (port 27017)
3. `kafka1`: Apache Kafka message broker (ports 9092, 9093)
4. `pocketbase`: Supplementary datastore and auth server (port 8090)
5. `redis`: Redis 7-Alpine in-memory cache and session store (port 6379)

**Critical Findings:**
Every container service publishes its internal communication ports directly to the host interface (`0.0.0.0`), exposing database engines, message queues, and cache stores directly to the internet unless protected by a strict host-level firewall. Furthermore, the Kafka cluster operates in unauthenticated `PLAINTEXT` mode, and Express request limits are configured with excessively large thresholds (50MB).

---

## 2. Container Port Exposure & Network Perimeter

### 2.1. Port Exposure Matrix

| Service | Container Port | Host Mapping | Default Binding | Protocol / Auth | Exposure Risk |
|---|:---:|:---:|:---:|:---:|---|
| `api` | 4000 | `4000:4000` | `0.0.0.0` | HTTP / App Auth | Intended (Behind Nginx) |
| `mongodb` | 27017 | `27017:27017` | `0.0.0.0` | MongoDB / **None** | 🔴 **CRITICAL (SEC-017)** |
| `kafka1` | 9092 | `9092:9092` | `0.0.0.0` | Kafka / **PLAINTEXT** | 🔴 **CRITICAL (SEC-020)** |
| `pocketbase` | 8090 | `8090:8090` | `0.0.0.0` | HTTP / Admin UI | 🟠 **HIGH (SEC-019)** |
| `redis` | 6379 | `6379:6379` | `0.0.0.0` | Redis / **None** | 🔴 **CRITICAL (SEC-018)** |

### 2.2. Architectural Impact of 0.0.0.0 Bindings
In standard Docker deployments on Linux (including cloud virtual machines on AWS, Vultr, or DigitalOcean), Docker alters host `iptables` rules. Published ports automatically bypass standard UFW (Uncomplicated Firewall) configurations unless explicitly mitigated via `DOCKER-USER` chains. As a result:
- Any external scanner can discover and directly connect to Redis and Kafka.
- Attackers can dump Redis memory, disrupt message streams, or tamper with message queue transactions without passing through the Express authentication gateway.

---

## 3. Kafka Broker Security Posture (SEC-020)

### 3.1. Plaintext Listener Configuration
Inspection of `docker-compose.yml` lines 103–119:
```yaml
KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka1:9092
```
- **Observations:**
  - Neither TLS encryption (`SSL`) nor SASL authentication (`SASL_PLAINTEXT` / `SASL_SSL`) is configured.
  - Topics processed by this broker include:
    - `email-events`: Contains password reset OTPs, verification tokens, and user email addresses.
    - `notification-events`: Contains user alerts, names, and interaction metadata.
    - `analytics-events`: User behavioral metrics.
- **Risk:**
  - An adversary capable of eavesdropping on the network or connecting to port 9092 can intercept plaintext messages containing authentication tokens or inject forged messages into processing queues.

---

## 4. Express Server & Middleware Hardening

### 4.1. Payload Limits & Denial of Service (SEC-008)
In `index.js` lines 104–105:
```javascript
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
```
- Standard JSON APIs require payload sizes between 100KB and 2MB.
- Allocating a 50MB limit to general JSON parsing allows an attacker to stream large, deeply nested JSON objects simultaneously across multiple concurrent connections, exhausting the Node.js V8 heap and triggering process crashes.

### 4.2. Error Handler Case Sensitivity Bug (SEC-012)
In `middleware/errorHandler.js` line 80:
```javascript
if (process.env.NODE_ENV === "PRODUCTION") {
    // Sanitized production error response without stack trace
} else {
    // Development error response including err.stack
}
```
- `docker-compose.yml` line 15 defines `NODE_ENV=production` (lowercase).
- Because JavaScript string equality is case-sensitive, this condition evaluates to `false` in production.
- **Impact:** Any unhandled 500 error prints full stack traces, internal file paths, module names, and line numbers back to the client in JSON error responses.

### 4.3. Helmet & HTTP Headers
In `index.js` lines 109–111:
```javascript
app.use(helmet({}));
```
- Helmet is initialized with default settings. While this sets basic headers (`X-Content-Type-Options`, `X-Frame-Options`), Content Security Policy (CSP) and HSTS should be tuned specifically for production domains (`ultimatehealth.blog`).

### 4.4. Diagnostic & Information Disclosure Endpoints
1. **Public Swagger UI (SEC-021):**
   - Mounted at `/docs` and `/api/docs` without authentication in `index.js` lines 157–158.
   - Exposes complete API schema, request parameters, models, and deprecated endpoint definitions.
2. **Circuit Breaker Diagnostics:**
   - Mounted at `GET /api/health/circuit-breakers` without authentication in `index.js` lines 75–83.
   - Leaks infrastructure availability metrics, external service health, and operational failure states.
3. **Debug Routes (SEC-022):**
   - `GET /hello` left active in production code.

---

## 5. Dependency Vulnerability Analysis (SEC-014)

Execution of `npm audit` against the production package tree revealed **116 vulnerabilities**:
- **Critical:** 8
- **High:** 40
- **Moderate:** 62
- **Low:** 6

### 5.1. High-Impact Package Vulnerabilities

| Package | Severity | CVE / Advisory | Impact Description |
|---|:---:|---|---|
| `ws` | High | GHSA-96hv-2xvq-fx4p | Denial of Service via memory exhaustion in WebSocket frame handling. |
| `ws` | High | GHSA-3h5v-q93c-6h6q | Crash via null pointer dereference. |
| `zod` | High | GHSA-mrhx-c7xc-m3w5 | Memory exhaustion DoS in versions < 4.6.6 during recursive schema parsing. |
| `fast-xml-parser` | Moderate | GHSA-j26c-3m5v-6h47 | Embedded in `@aws-sdk/core`. Regex DoS and XML entity parsing issues. |
| `yaml` | Moderate | GHSA-f9xv-q969-pqx4 | Stack overflow when parsing deeply nested structures. |

---

## 6. Recommendations & Infrastructure Hardening

```
┌─────────────────────────────────────────────────────────────┐
│                       External Traffic                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Port 80/443 ONLY)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Nginx Reverse Proxy                    │
│   - Enforces SSL/TLS                                        │
│   - Buffers requests (Max 2MB body)                         │
│   - Filters /docs, /api/docs (Restrict to internal IPs)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Internal Network Only
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Node.js API Container (Port 4000)           │
│   - Bound to 127.0.0.1:4000                                 │
│   - Fix NODE_ENV lowercase check                            │
└──────┬───────────────────────┼───────────────────────┬──────┘
       │                       │                       │
       ▼                       ▼                       ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   MongoDB    │        │    Redis     │        │    Kafka     │
│ 127.0.0.1    │        │ 127.0.0.1    │        │ 127.0.0.1    │
│ + Auth user  │        │ + Password   │        │ + SASL auth  │
└──────────────┘        └──────────────┘        └──────────────┘
```

1. **Localhost Binding:** Update all service port definitions in `docker-compose.yml` to specify `127.0.0.1:<port>:<port>` or remove host port publishing entirely for services accessed only by the `api` container.
2. **Fix Payload Limits:** Reduce `express.json({ limit: '2mb' })` in `index.js`.
3. **Fix Error Handler:** Update condition to `process.env.NODE_ENV?.toLowerCase() === "production"`.
4. **Patch Dependencies:** Execute `npm audit fix` and upgrade `ws` and `zod` to remediate critical CVEs.
