# AI-assisted development

## Project approach

This repository uses AI tools as development assistance. Depending on the task, AI may help with requirement breakdown, code exploration, implementation suggestions, documentation drafts, test ideas, and review checklists.

AI output is not treated as an authority. The checked-in source code, tests, explicit project requirements, and verified runtime behavior remain the sources of truth.

## Review principles

Every AI-assisted change should follow the same engineering process as a manually authored change:

1. State the problem and the intended behavior before changing files.
2. Inspect the existing implementation and its dependencies.
3. Keep the diff focused and avoid unrelated rewrites.
4. Review generated code for correctness, security, maintainability, and consistency with the existing architecture.
5. Run the relevant syntax checks, tests, bundle validation, and build.
6. Record checks that were skipped or blocked; never describe them as passing.
7. Keep secrets, session tokens, private room snapshots, and credentials out of prompts, logs, issues, and commits.
8. Keep a human maintainer responsible for accepting changes and deciding what is released.

## Suggested disclosure

A concise and accurate project description is:

> Developed GREEN TRAP DETECTIVE using an AI-assisted workflow. I defined requirements and project constraints, used AI tools to support implementation and documentation, and evaluated changes through GitHub reviews, automated tests, and runtime checks.

Only use statements about code review, testing, architecture, deployment, or release ownership when you have actually performed those tasks and can explain the decisions. Do not claim that every line was independently written by you if AI generated or substantially rewrote it.

## Skills to build alongside the project

A portfolio project is strongest when its maintainer can explain, at a high level:

- how a browser request reaches the server;
- how a room and player session are identified;
- why the engine, rather than the UI, owns game rules;
- how a per-player projection protects private game data;
- how SSE delivers room updates;
- what the file-based persistence model can and cannot guarantee;
- what each automated test proves, and what it does not prove.

You do not need to memorize every line of code. You should be able to trace the main data flow, describe the limits honestly, and locate the relevant implementation and tests.
