# Roy Toolbox

## Stack
- Vite
- React
- TypeScript
- GitHub Pages

## Architecture
- Each tool lives under `src/tools/`.
- Shared UI and utilities should be reused.
- Tool metadata should be registered centrally.
- Keep tools independent from each other.

## Rules
- Preserve existing user changes.
- Inspect only files relevant to the current task.
- Do not modify unrelated code.
- Do not add dependencies unless necessary.
- Prefer browser-side implementation when possible.
- Keep GitHub Pages compatibility.
- Avoid over-engineering.

## Verification
- Run lint and build after meaningful code changes.