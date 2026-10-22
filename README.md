<h1 align="center"> UltimateHealth Backend</h1>

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-231F20?style=for-the-badge&logo=apachekafka&logoColor=white)](https://kafka.apache.org)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](https://swagger.io)

<br/>

[![Live Web Demo](https://img.shields.io/badge/Live%20Web%20Demo-4CAF50?style=for-the-badge&logo=globe&logoColor=white)](https://ultimatehealth.blog/web/en/)
[![Android App](https://img.shields.io/badge/Android%20App-Play%20Store-34A853?style=for-the-badge&logo=googleplay&logoColor=white)](https://play.google.com/store/apps/details?id=com.anonymous.UltimateHealth)
[![API Docs](https://img.shields.io/badge/API%20Docs-007ACC?style=for-the-badge&logo=swagger&logoColor=white)](https://ultimatehealth.blog/api/docs)

</div>

<div align="center">
<table>
  <tr>
    <td align="center"><b>🧾 License</b></td>
    <td align="center"><b>🌟 Stars</b></td>
    <td align="center"><b>🍴 Forks</b></td>
    <td align="center"><b>🐛 Issues</b></td>
  </tr>
  <tr>
    <td align="center"><img alt="License" src="https://img.shields.io/github/license/SB2318/ultimateHealth-backend?style=flat&logo=github&color=success"/></td>
    <td align="center"><img alt="Stars" src="https://img.shields.io/github/stars/SB2318/ultimateHealth-backend?style=flat&logo=github&color=success"/></td>
    <td align="center"><img alt="Forks" src="https://img.shields.io/github/forks/SB2318/ultimateHealth-backend?style=flat&logo=github"/></td>
    <td align="center"><img alt="Issues" src="https://img.shields.io/github/issues/SB2318/ultimateHealth-backend?style=flat&logo=github"/></td>
  </tr>
  <tr>
    <td align="center"><b>🔄 Open PRs</b></td>
    <td align="center"><b>✅ Closed PRs</b></td>
    <td align="center"><b>⏱️ Last Commit</b></td>
  </tr>
  <tr>
    <td align="center"><img alt="Open PRs" src="https://img.shields.io/github/issues-pr/SB2318/ultimateHealth-backend?style=flat&logo=github"/></td>
    <td align="center"><img alt="Closed PRs" src="https://img.shields.io/github/issues-pr-closed/SB2318/ultimateHealth-backend?style=flat&color=critical&logo=github"/></td>
    <td align="center"><img alt="Last Commit" src="https://img.shields.io/github/last-commit/SB2318/ultimateHealth-backend?style=flat&color=informational&logo=github"/></td>
  </tr>
</table>
</div>

---

## 📌 Article & Podcast Optimization (Completed & Deployed)

- ✅ **Compound Indexing**: Added MongoDB compound indexes across `Articles` and `Glossary` models for fast feed pagination and tag filtering.
- ✅ **Full-Text Search (FTS)**: Built-in weighted text search indexes (`title`, `summary`, `description`, `content`).
- ✅ **Stateless Glossary Autodetect**: High-speed, sliding-window medical terminology extraction for article preview pages.
- ✅ **Sub-Millisecond Auth**: Upgraded token service to **RS256 Asymmetric JWT** + **Redis JTI tracking** & **User Token Versioning**.

---

## 🚀 Overview

**The core backend engine** powering **[UltimateHealth](https://ultimatehealth.blog)** — a community-driven open-source health platform.

Provides secure, high-throughput REST & WebSocket APIs for:
- Multilingual health articles, podcasts & series playlists
- Medical terminology autodetect & glossary search
- Collaborative content review & admin moderation workflows
- High-performance RS256 JWT auth with Redis session revocation
- Asynchronous Kafka event queues for notifications & analytics
- Gemini AI medical assistant chat integration

## 🔗 Submodule Repositories

- **Frontend Repository**: [ultimatehealth-app](https://github.com/SB2318/UltimateHealth)
- **Admin Repository**: [ultimatehealth-admin](https://github.com/SB2318/ultimatehealth-admin-app)
- **Content Checker Repository**: [content-checker](https://github.com/SB2318/VeriWise-Content-Check)

---

## ✨ Key Features

- **Multilingual Articles & Podcasts**: CRUD with translation links (`translationOf`), audio tagging, and playlist curation.
- **Enterprise Security**: RS256 Asymmetric JWT signing, Redis sub-millisecond JTI blacklisting, User Token Versioning, and RBAC.
- **Asynchronous Event Queues**: Dual-broker Apache Kafka cluster with 12 partitions per topic for non-blocking emails and analytics.
- **Glossary Autodetect**: Stateless HTML plain-text extraction and medical phrase matching.
- **Content Moderation & Strikes**: Admin review pipeline for podcast and article approval.
- **Interactive Swagger Docs**: Deployed live at [https://ultimatehealth.blog/api/docs](https://ultimatehealth.blog/api/docs).

---

## 🔐 Authentication & Authorization Architecture

UltimateHealth implements an enterprise-grade, role-based authentication and authorization system powered by **RS256 asymmetric JWTs**, **Redis-backed token blacklisting**, and **User Token Versioning**.

### 1. User Authentication Flow

Regular users (`user` and `doctor` roles) manage their account lifecycle through self-registration and verified authentication:

- **Self-Registration (`POST /api/user/register`)**:
  - Validates user input (name, handle, email, password) against Zod schemas.
  - Generates a hashed password via `bcrypt` and creates an unverified user record with a verification token.
  - Dispatches an asynchronous email containing the account verification link.
- **Email Verification (`GET /api/user/verifyEmail`)**:
  - Validates the verification token and transitions the unverified user into the active `User` collection.
- **Login (`POST /api/user/login` or `POST /api/user/google-auth`)**:
  - Verifies credentials or Google OAuth ID token.
  - Enforces minimum response duration to protect against timing attacks.
  - Issues an **RS256-signed Access Token** in the response body (short-lived) and an **HTTP-only Refresh Token** in secure cookies.
  - Tracks the unique JWT ID (`jti`) and user token version in Redis for sub-millisecond session validation and instant revocation.
- **Logout & Session Revocation (`POST /api/user/logout`)**:
  - Blacklists the access token JTI until expiry in Redis and immediately revokes the refresh token.

---

### 2. Admin Authentication & Onboarding Flow

Admins possess privileged access to review, moderate, and publish health articles and podcasts. To ensure compliance and strict access governance:

#### 🚫 No Self-Registration & Complete Separation from `UnverifiedUser`
- **Admins cannot register themselves on the open platform.**
- **Zero Relation with `UnverifiedUser` Table:** The `UnverifiedUser` model is exclusively a temporary staging collection for public user self-registration before email activation. Admin accounts **never** touch or enter the `UnverifiedUser` table.
- **Direct Provisioning in Admin Table:** All admin accounts are created directly in the `Admin` (`adminModel`) collection by a **Super Admin** or **UltimateHealth Admin**.
- **Native Verification Flag (`isVerified`):** The `Admin` schema maintains its own independent `isVerified` boolean field (default: `false`) and `isSuperAdmin` field directly on the document.
- Initialized admin accounts remain non-functional (`isVerified: false`, `signature_url: ""` or null) until the onboarding agreement is formally signed from the website.

#### 📩 Candidate Application Pipeline (`POST /api/admin/apply`)
Prospective moderators, physicians, and reviewers apply to join the review team via the web portal or agreement page:
- **Endpoint**: `POST /api/admin/apply` (alias: `POST /api/admin-agreement/apply`)
- **Payload (`multipart/form-data`)**: `fullName`, `email`, `phone`, `role`, `experience`, `message`, and `resume` (PDF/DOC/DOCX up to 10MB).
- **Hybrid S3 + Email Architecture**:
  1. **Cloud Storage**: The resume file is permanently uploaded to S3 / Object Storage under `applicant-resumes/` to generate a secure, durable URL.
  2. **Database Record**: Application data is saved to MongoDB (`AdminApplicant`) with status `Pending`.
  3. **Admin Notification**: An email is dispatched to UltimateHealth administration (`ultimate.health25@gmail.com`) with `replyTo: applicant.email`, formatted candidate details, S3 download button, and the resume attached directly for immediate preview in email clients.
  4. **Applicant Confirmation**: An automatic acknowledgment receipt is emailed to the candidate.

#### ✍️ Mandatory Agreement Signing
- Before an admin can log in or access any moderation tools, they must review and digitally sign the administrator agreement through the website (`/admin/agreement`).
- The admin signs the document digitally, which calls `POST /api/admin/upload-agreement`.
- The system generates an archived PDF containing the agreement terms, user details, and digital signature, uploads it to S3/Object Storage, and persists the reference to `admin.signature_url`.
- Upon successful signing and upload, the account is marked `isVerified: true`.
- Both `POST /api/admin/login` and the `adminAuthenticateToken` middleware strictly enforce that **both** `isVerified === true` and a valid `signature_url` exist; otherwise, access is rejected with `403 Forbidden`.

#### 🛡️ Secure Admin Password Reset (`resetToken` Workflow)
Admin accounts use a secure, multi-step password reset flow utilizing a temporary, single-use `resetToken` (rather than a single-step OTP password override) to prevent race conditions and brute-force attacks:

```
[Admin Request] ───► POST /api/admin/forgot-password ───► 6-digit OTP sent to email
                             │
                             ▼
[Verify OTP]    ───► POST /api/admin/verify-otp       ───► Validates OTP & returns temporary resetToken
                             │
                             ▼
[Reset Password]───► POST /api/admin/reset-password   ───► Validates resetToken, checks Redis,
                                                           updates password & revokes all sessions
```

1. **Step 1: Request OTP (`POST /api/admin/forgot-password` or `/api/admin/forgotpassword`)**:
   - Generates a cryptographically secure 6-digit OTP (hashed before storing in the database).
   - Enforces rate limiting (`forgotPasswordLimiter`) and resend cooldowns.
   - Dispatches the OTP to the admin's verified email address.
2. **Step 2: Verify OTP & Issue Reset Token (`POST /api/admin/verify-otp`)**:
   - Validates the submitted OTP against the stored hash and checks expiry (10 minutes) and attempt counters (max 5 attempts).
   - Upon successful verification, issues a temporary, short-lived **`resetToken`** (15-minute validity) signed with the RS256 key pair and caches its JTI in Redis (`password_reset_token:<adminId>:<jti>`).
3. **Step 3: Reset Password (`POST /api/admin/reset-password`)**:
   - Accepts `{ resetToken, newPassword }`.
   - Validates the `resetToken` and confirms it has not been previously consumed or expired in Redis.
   - Deletes the token from Redis to enforce **single-use guarantees**.
   - Ensures the new password does not match the previous password, hashes the new password, clears OTP data, and triggers `revokeAllUserTokens` to immediately terminate any active sessions.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 22
- **Framework**: Express.js
- **Database**: MongoDB 6.0 + Mongoose
- **Cache & Auth Memory**: Redis 7 (`ioredis`)
- **Event Streaming**: Apache Kafka (Dual-broker)
- **Security**: RS256 RSA Key Pair + RBAC
- **Gateway & Proxy**: Nginx (SSL/TLS, HTTP/2, Socket.IO WebSockets)
- **Storage**: PocketBase + AWS S3 / Vultr Object Storage
- **Containerization**: Docker & Docker Compose
- **Docs**: Swagger (OpenAPI 3)

---

## 🚀 Quick Start (Local Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/SB2318/ultimatehealth-backend.git
   cd ultimatehealth-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Generate RS256 Key Pair (Optional for local RSA signing)**
   ```bash
   mkdir -p keys
   openssl genrsa -out keys/private.pem 2048
   openssl rsa -in keys/private.pem -outform PEM -pubout -out keys/public.pem
   ```

4. **Environment Setup**
   Copy `.env_sample` to `.env` and fill in your values:
   ```bash
   cp .env_sample .env
   ```

5. **Start Stack via Docker Compose**
   ```bash
   docker compose up -d --build
   ```

   *Or run Node API locally:*
   ```bash
   npm start
   ```

---

## 📁 Project Structure

```
ultimatehealth-backend/
├── config/            # Database, Redis & environment validation
├── controllers/       # Business logic (articles, podcasts, users, admin)
├── middleware/        # RS256 Auth, RBAC, rate limiting, error handling
├── models/            # Mongoose schemas (Articles, Podcast, Glossary, Users)
├── routes/            # API endpoints & OpenAPI specs
├── services/          # Token service, security, Kafka producers/consumers
├── utils/             # Circuit breaker, pocketbase utils, glossary detector
├── keys/              # RS256 RSA Private & Public Keys (Git ignored)
├── docker-compose.yml # Container orchestration (API, Mongo, Redis, Kafka, PocketBase)
├── Dockerfile         # Production Node.js container
├── index.js           # Express app entry point
└── README.md
```

---

## 🤝 How to Contribute

We welcome contributions! This backend is open for **students, developers, and open-source enthusiasts**.

### Getting Started

- Read our **[CONTRIBUTING.md](./CONTRIBUTING.md)** for detailed guidelines.
- Look for issues labeled with **`good-first-issue`** — perfect for beginners.

---

<div align="center">
 <h3>Thank you for contributing to our repository</h3>
 <h1> We appreciate your help in making UltimateHealth even better.😃</h1>

 <table>
  <tr>
    <td align="center"><a href="https://github.com/SB2318"><img src="https://avatars.githubusercontent.com/u/87614560?v=4" width="100px;" alt=""/><br/><sub><b>Susmita Bhattacharya</b></sub></a></td>
    <td align="center"><a href="https://github.com/rushiii3"><img src="https://avatars.githubusercontent.com/u/105168088?v=4" width="100px;" alt=""/><br/><sub><b>HRUSHIKESH SHINDE</b></sub></a></td>
    <td align="center"><a href="https://github.com/ionfwsrijan"><img src="https://avatars.githubusercontent.com/u/201338831?v=4" width="100px;" alt=""/><br/><sub><b>Srijan Jaiswal</b></sub></a></td>
    <td align="center"><a href="https://github.com/AdityaChaube"><img src="https://avatars.githubusercontent.com/u/233758866?v=4" width="100px;" alt=""/><br/><sub><b>Aditya Chaube</b></sub></a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/vedant7007"><img src="https://avatars.githubusercontent.com/u/170861579?v=4" width="100px;" alt=""/><br/><sub><b>Vedant Idlgave</b></sub></a></td>
    <td align="center"><a href="https://github.com/reddypnipun"><img src="https://avatars.githubusercontent.com/u/230384897?v=4" width="100px;" alt=""/><br/><sub><b>Nipun Kumar Reddy</b></sub></a></td>
    <td align="center"><a href="https://github.com/anshul23102"><img src="https://avatars.githubusercontent.com/u/167362756?v=4" width="100px;" alt=""/><br/><sub><b>Anshul Jain</b></sub></a></td>
    <td align="center"><a href="https://github.com/aeriellaaa"><img src="https://avatars.githubusercontent.com/u/202282989?v=4" width="100px;" alt=""/><br/><sub><b>Akshata Srivastava</b></sub></a></td>
  </tr>
 </table>

 <br/>

 <a href="https://github.com/SB2318/ultimatehealth-backend/graphs/contributors">
   <img src="https://contrib.rocks/image?repo=SB2318/ultimatehealth-backend" alt="All Contributors" />
 </a>
</div>
