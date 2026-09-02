# Contributing to express-sentinel-limiter

Thank you for your interest in contributing to `express-sentinel-limiter`! We welcome bug reports, feature suggestions, documentation improvements, and pull requests.

---

## 🛠️ Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/rayrishu19-wq/express-sentinel-limiter.git
   cd express-sentinel-limiter
   ```

2. **Install peer dependencies (optional for local testing):**
   ```bash
   npm install --no-save express ioredis
   ```

3. **Run the test suite:**
   ```bash
   npm test
   ```

---

## 📋 Pull Request Guidelines

1. **Branch Naming**:
   - `feat/feature-name` for new features
   - `fix/bug-description` for bug fixes
   - `docs/improvement-area` for documentation updates
   - `test/new-tests` for test enhancements

2. **Commit Convention**:
   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` A new feature
   - `fix:` A bug fix
   - `docs:` Documentation only changes
   - `test:` Adding or updating tests
   - `refactor:` Code change that neither fixes a bug nor adds a feature
   - `chore:` Build process, auxiliary tools, or dependency updates

3. **Requirements for PR Approval**:
   - All tests must pass (`npm test`).
   - If adding new features, include matching unit tests in the `test/` directory.
   - Update TypeScript declarations in `types/index.d.ts` when modifying the public API.
   - Keep commits clean and atomic.

---

## 🐛 Reporting Bugs

If you find a bug:
- Check existing issues to ensure it hasn't been reported.
- Provide a minimal reproducible example (code snippet or repository).
- Specify Node.js version, Redis version (if applicable), and OS.
