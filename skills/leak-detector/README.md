# Leak Detector Skill POC

Claude Code skill that scans code for leaked PII, secrets/credentials, and security vulnerabilities.

## Setup

Install the pre-commit hook:
```bash
chmod +x setup-hooks.sh
./setup-hooks.sh
```

## Usage

### Claude Code Skill
```
/leak-detect
```

### Pre-commit Hook
The hook runs automatically on `git commit` and blocks commits containing:
- Hardcoded secrets (AWS keys, GitHub tokens, API keys, passwords, connection strings)
- PII (SSNs, credit card numbers)
- `.env` files not in `.gitignore`

## Example

### Dirty files:

`.env.sample`:

```
DATABASE_URL=postgresql://admin:SuperSecret123@prod-db.internal:5432/myapp
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7812ASDH
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYOPWQEIO
```

`dirty_app.js`:

```
const express = require("express");
const https = require("https");
const app = express();

const AWS_ACCESS_KEY = "AKIAIOSFODNN7812ASDH";
const AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYOPWQEIO";

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/users", (req, res) => {
  const query = "SELECT * FROM users WHERE name = '" + req.query.name + "'";
  db.execute(query).then((result) => res.json(result));
});

app.get("/redirect", (req, res) => {
  res.redirect(req.query.url);
});

app.get("/file", (req, res) => {
  const filePath = "/data/" + req.query.path;
  res.sendFile(filePath);
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message, stackTrace: err.stack });
});

const agent = new https.Agent({ rejectUnauthorized: false });

app.listen(3000, "0.0.0.0");

```

### Commit log result:

```
git commit -m "test bad commit"

Running leak-detector scan before commit...

I now have all findings. Here's the full report:

---

## Leak Detector Report

[SECRET] AWS Access Key ID in examples/.env.sample:2
-> AKIA************ASDH
-> Remove from file; use environment variables or a secrets manager

[SECRET] AWS Secret Access Key in examples/.env.sample:3
-> wJal************************************
-> Remove from file; use environment variables or a secrets manager

[SECRET] Database connection string with credentials in examples/.env.sample:1
-> postgresql://admin:****@prod-db.internal:5432/myapp
-> Remove hardcoded credentials; use a secrets manager or env vars at runtime

[SECRET] AWS Access Key ID in examples/dirty_app.js:5
-> AKIA************ASDH
-> Never hardcode AWS keys; use IAM roles, env vars, or AWS Secrets Manager

[SECRET] AWS Secret Key in examples/dirty_app.js:6
-> wJal************************************
-> Never hardcode AWS secrets; use IAM roles, env vars, or AWS Secrets Manager

[DISASTER] SQL Injection in examples/dirty_app.js:14
-> const query = "SELECT * FROM users WHERE name = '" + req.query.name + "'";
-> Use parameterized queries (e.g., prepared statements) instead of string concatenation

[DISASTER] Open Redirect in examples/dirty_app.js:19
-> res.redirect(req.query.url);
-> Validate redirect URL against an allowlist of trusted domains

[DISASTER] Path Traversal in examples/dirty_app.js:23
-> const filePath = "/data/" + req.query.path;
-> Sanitize input and use path.resolve() with a check that the result stays within the allowed directory

[DISASTER] Stack Trace exposed to clients in examples/dirty_app.js:28
-> res.status(500).json({ error: err.message, stackTrace: err.stack });
-> Never send stack traces in responses; log them server-side and return a generic error

[DISASTER] CORS wildcard allows any origin in examples/dirty_app.js:9
-> res.setHeader("Access-Control-Allow-Origin", "*");
-> Restrict to specific trusted origins

[DISASTER] TLS/SSL verification disabled in examples/dirty_app.js:31
-> const agent = new https.Agent({ rejectUnauthorized: false });
-> Enable certificate verification; use proper CA certs instead

[DISASTER] Server listening on all interfaces in examples/dirty_app.js:33
-> app.listen(3000, "0.0.0.0");
-> Bind to 127.0.0.1 or a specific interface unless intentionally public

Scan complete: 2 files scanned

PII:              0 findings
Secrets:          5 findings
Security Issues:  7 findings
  --------------------------
Total:            12 findings

Verdict: DO NOT PUSH - critical issues found

COMMIT BLOCKED - Leaks detected by leak-detector skill!
```

---

Output when I was updating the `README.md` to add the example section

```
git commit -m "updated readme"^\
Running leak-detector scan before commit...

The only email-pattern match is `admin:SuperSecret123@prod-db.internal:5432/myapp` on line 33 — this is a connection string inside a documentation code block example, not a real email address. It's clearly illustrative/fake data in documentation. **Not a real PII finding.**

No SSNs, credit card numbers, or phone numbers were found.

Per the skill rules, `.md` files are **only scanned for PII** (not secrets or security disasters), so the secrets and vulnerable code shown in the README's example blocks are out of scope for this file type.

---

## Leak Detector Report

Scan complete: 1 file scanned

PII:              0 findings
Secrets:          0 findings
Security Issues:  0 findings
  --------------------------
Total:            0 findings

Verdict: CLEAN - no leaks detected

Leak-detector scan passed. Proceeding with commit.
[master f034b60] updated readme
 1 file changed, 124 insertions(+), 1 deletion(-)
```