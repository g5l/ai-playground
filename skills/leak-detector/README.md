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

## Examples

### Bad (will be flagged)
- `examples/leaked_secrets.py` - Hardcoded AWS keys, GitHub tokens, API keys, passwords
- `examples/leaked_pii.py` - SSNs, credit cards, emails, phone numbers
- `examples/security_disasters.py` - SQL injection, command injection, MD5 passwords, pickle.loads, secrets in logs
- `examples/insecure_server.js` - CORS wildcard, open redirect, path traversal, TLS disabled, stack traces exposed
- `examples/config.yml` - Debug mode on, hardcoded passwords, connection strings
- `examples/.env` - Secrets in .env file not in .gitignore

### Clean (will pass)
- `examples/clean_code.py` - Uses env vars, parameterized queries, bcrypt, no secret logging
- `examples/clean_server.js` - Allowlisted CORS, path traversal protection, no stack traces
