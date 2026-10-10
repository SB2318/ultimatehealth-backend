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
    <td align="center"><a href="https://github.com/SB2318"><img src="https://avatars.githubusercontent.com/u/87614560?v=4" width="120px;" alt=""/><br/><sub><b>Susmita Bhattacharya</b></sub></a></td>
    <td align="center"><a href="https://github.com/rushiii3"><img src="https://avatars.githubusercontent.com/u/105168088?v=4" width="120px;" alt=""/><br/><sub><b>HRUSHIKESH SHINDE</b></sub></a></td>
    <td align="center"><a href="https://github.com/ionfwsrijan"><img src="https://avatars.githubusercontent.com/u/201338831?v=4" width="120px;" alt=""/><br/><sub><b>SrijanCodes</b></sub></a></td>
 </tr>
 </table>
</div>
