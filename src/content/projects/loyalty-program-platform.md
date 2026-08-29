---
title: 'Loyalty Program Platform'
description: 'Backend for a nationwide retail loyalty program serving 380k+ daily users at 50+ requests per second with 99.9% uptime.'
stack: ['Node.js', 'TypeScript', 'Azure', 'PostgreSQL', 'Redis', 'Salesforce']
role: 'Backend Lead'
company: 'Kiosko'
companyUrl: 'https://mikiosko.mx/yaya/'
links:
  live: 'https://mikiosko.mx/yaya/'
featured: true
date: 2024-10-01
order: 1
---

## Overview

Kiosko's loyalty program is the customer-facing rewards layer across a nationwide convenience store chain. I led backend development of the platform, which serves **380,000+ daily users** at a sustained **50+ requests per second** while holding **99.9% uptime**.

The backend owns point accrual and redemption, customer identity, and the synchronization contract with Salesforce as the system of record.

## Architecture

The hard constraint was that the program could not go dark during the platform transition. Rather than a cutover, I architected a **dual migration strategy**: the legacy and new platforms ran in parallel behind a custom interface that normalized both backends into a single contract. Consumers were migrated incrementally, and the interface absorbed the differences — **zero downtime** through the entire migration.

Services are written in TypeScript on Node.js, deployed on Azure, with PostgreSQL for transactional data and Redis for the caching layer. The codebase leans on OOP and SOLID principles — the parallel-platform interface in particular depends on clean substitution boundaries to keep both implementations swappable.

## Impact

- 380k+ daily active users served at 99.9% uptime
- 50+ req/s sustained throughput
- Zero downtime across a full platform migration
- CI/CD on Azure DevOps and GitHub Actions, with optimized PostgreSQL pipelines
