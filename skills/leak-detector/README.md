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