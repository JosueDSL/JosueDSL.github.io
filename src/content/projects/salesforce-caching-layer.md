---
title: 'Salesforce Caching Layer'
description: 'A Redis caching strategy that cut Salesforce API consumption by 53% and response times by 42% — over 800,000 API calls saved per day.'
stack: ['Redis', 'Node.js', 'TypeScript', 'Salesforce API', 'Azure']
role: 'Backend Engineer'
company: 'Kiosko'
companyUrl: 'https://mikiosko.mx/yaya/'
links: {}
featured: true
date: 2025-03-01
order: 2
---

## The problem

Salesforce was the system of record behind the loyalty program, which made it the bottleneck for both cost and latency. Every customer lookup and point balance check hit the Salesforce API directly. At 380k+ daily users, that volume pushed hard against API limits and put a third-party round trip on the critical path of nearly every request.

## The approach

I designed a Redis caching layer between the services and Salesforce, treating cache design as the core engineering problem rather than a bolt-on:

- **Read-through caching** for the hot paths — customer profiles and point balances — where the read-to-write ratio is heavily skewed
- **Targeted invalidation** on the write paths, so a point accrual or redemption invalidates precisely the affected keys instead of flushing broadly
- **TTL tuning per data class**, matched to how quickly each kind of record actually changes rather than a single global expiry

## Impact

- **53% reduction** in Salesforce API consumption
- **42% faster** API response times
- **800,000+ API calls saved per day**

The savings compound: lower third-party consumption keeps the platform within API limits as user volume grows, and removing the external round trip from hot paths is what made the latency improvement possible.
