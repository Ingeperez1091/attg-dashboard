# Branch Protection Integration Checklist

- Attempt direct push to protected branch (`main` or `develop`) and verify rejection.
- Open a pull request with a failing CI check and verify merge button is blocked.
- Open a pull request with all required checks passing and one approval; verify merge is allowed.
- Push a new commit after approval and verify stale review dismissal when enabled.
- Confirm required checks exactly match `Lint`, `TypeScript Type Check`, and `Unit Tests`.
