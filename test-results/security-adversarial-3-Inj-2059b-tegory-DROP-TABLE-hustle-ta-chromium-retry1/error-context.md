# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security-adversarial.spec.ts >> 3. Injection Attack Resistance >> 3b. SQL Injection via query parameters >> Query param injection blocked: /api/hustle/tasks?category='; DROP TABLE hustle_ta
- Location: tests\security-adversarial.spec.ts:260:11

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED ::1:3000
Call log:
  - → GET http://localhost:3000/api/hustle/tasks?category=%27;%20DROP%20TABLE%20hustle_tasks;--
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.15 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br

```