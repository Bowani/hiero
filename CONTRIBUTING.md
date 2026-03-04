# Contributing to @hiero-sdk/utils

Thank you for your interest in contributing! This document outlines the process for making contributions that meet the quality bar required for potential upstreaming into the Hiero ecosystem.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How to Contribute](#how-to-contribute)
3. [Development Setup](#development-setup)
4. [Commit Requirements](#commit-requirements)
5. [Pull Request Process](#pull-request-process)
6. [Coding Standards](#coding-standards)
7. [Testing Requirements](#testing-requirements)

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) Code of Conduct. By participating, you agree to uphold it. Please report unacceptable behavior to the maintainers.

---

## How to Contribute

### Reporting Bugs

Open an issue using the **Bug Report** template. Include:
- Library version
- Node.js version
- Minimal reproducible example
- Expected vs. actual behavior

### Suggesting Features

Open an issue using the **Feature Request** template before starting implementation. This avoids duplicated effort and ensures alignment with project goals.

### Submitting Code

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes (with tests)
4. Open a Pull Request

---

## Development Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/hiero-sdk-utils.git
cd hiero-sdk-utils

# Install dependencies
npm install

# Run tests
npm test

# Watch mode
npm run test:watch

# Type-check
npm run type-check

# Lint
npm run lint
```

---

## Commit Requirements

### GPG-Signed Commits

All commits **must be GPG-signed**. This is enforced on `main` via branch protection.

```bash
# Generate a GPG key (if you don't have one)
gpg --full-generate-key

# Configure git to use it
git config --global user.signingkey <YOUR_KEY_ID>
git config --global commit.gpgsign true

# Verify a signed commit
git log --show-signature -1
```

[GitHub docs: Signing commits](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits)

### DCO Sign-Off

Every commit must include a **Developer Certificate of Origin (DCO)** sign-off line:

```
Signed-off-by: Your Name <your@email.com>
```

Add it automatically with:

```bash
git commit -s -S -m "feat: add batch account query helper"
#          ^  ^ DCO sign-off
#          |    GPG sign
```

The DCO certifies that you wrote or have the right to submit the contribution under the Apache-2.0 license. See [developercertificate.org](https://developercertificate.org/) for the full text.

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
Signed-off-by: Your Name <your@email.com>
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`

**Scopes:** `mirror`, `scheduled`, `react`, `types`, `utils`, `ci`, `docs`

**Examples:**

```
feat(mirror): add contract query methods

Adds getContract() and getContractResults() to MirrorNodeClient.
Closes #42

Signed-off-by: Alice Dev <alice@example.com>
```

```
fix(react): cancel fetch on component unmount

Prevents state updates after unmount by tracking a cancellation
flag in the useEffect cleanup function.

Signed-off-by: Bob Dev <bob@example.com>
```

---

## Pull Request Process

1. **One concern per PR.** Keep PRs focused — one feature or fix at a time.
2. **Tests required.** New code must include unit tests. Coverage must not drop below existing thresholds.
3. **Update docs.** Update README / JSDoc if public API changes.
4. **Update CHANGELOG.** Add an entry under `[Unreleased]` following Keep a Changelog format.
5. **Pass CI.** All checks (build, lint, tests, type-check) must pass.
6. **Two approvals** from maintainers required before merge.
7. PRs are merged via **squash merge** into `main` to keep a clean history.

### PR Title

Follow Conventional Commits format for the PR title — it becomes the squash commit message.

---

## Coding Standards

- **TypeScript strict mode** is required (`"strict": true` + `"exactOptionalPropertyTypes": true`).
- **No `any`** unless absolutely unavoidable and justified with a comment.
- **Prefer `unknown`** over `any` for error handling.
- Public functions and types must have **JSDoc comments** with at least a `@example`.
- Use **named exports** (no default exports except React components).
- Keep modules focused — the `mirror`, `scheduled`, and `react` sub-modules should remain independently importable.
- No runtime dependencies outside of `@hashgraph/sdk` (peer dep), `react` (peer dep, optional), and `node` built-ins.

---

## Testing Requirements

- Framework: **Jest** with `ts-jest`
- Minimum coverage: 80% lines / functions / statements, 70% branches
- Tests must **not** make real network calls — mock `fetch` for Mirror Node tests
- Test file location: `tests/<module>/` mirroring `src/<module>/`
- Test file naming: `<name>.test.ts` or `<name>.test.tsx`

Run tests with coverage:

```bash
npm test -- --coverage
```

---

## Release Process (Maintainers Only)

1. Update `CHANGELOG.md` — move `[Unreleased]` to a versioned section
2. Bump version in `package.json`
3. Create a signed tag: `git tag -s v0.2.0 -m "Release v0.2.0"`
4. Push tag: `git push origin v0.2.0`
5. CI publishes to npm automatically via the release workflow

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
