---
title: 'Loyalty Wallet Authentication'
description: 'JWT lifecycle and OTP authentication flows built to banking standards for a wallet app integrated with a debit card SDK.'
stack: ['Node.js', 'TypeScript', 'JWT', 'OTP', 'Azure']
role: 'Backend Engineer'
company: 'Kiosko'
companyUrl: 'https://mikiosko.mx/yaya/'
links: {}
featured: true
date: 2025-06-01
order: 3
---

## Overview

The Loyalty Wallet extends the rewards program into a payments product, integrated with a debit card SDK. That integration changes the threat model: the authentication flows had to meet **banking security standards**, not the looser bar a rewards app alone would set.

## Authentication design

I implemented the full **JWT lifecycle** — issuance, short-lived access tokens, refresh rotation, and revocation — paired with **OTP verification** on sensitive operations. The design decisions that mattered:

- **Short access-token lifetimes with rotating refresh tokens**, so a leaked token has a narrow exploitation window and reuse is detectable
- **OTP as a step-up factor** gating the operations that touch funds, rather than a one-time gate at login
- **Server-side revocation**, so a compromised session can be terminated immediately instead of waiting out an expiry

## Constraints

Working against a debit card SDK means the authentication contract isn't fully yours to define — the flows had to satisfy the SDK's expectations and the compliance bar simultaneously, without degrading the experience for users who are, from their perspective, just checking a rewards balance.
