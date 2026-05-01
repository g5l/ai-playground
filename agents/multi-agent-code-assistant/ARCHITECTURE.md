# Multi-Agent Code Assistant — Architecture & Context

## What This Is

A TypeScript multi-agent system that demonstrates two agent coordination patterns:

1. **Orchestrator-Worker**: A central `Orchestrator` agent plans work and delegates to three specialist workers (`Analyzer`, `Refactorer`, `Tester`).
2. **Hierarchical Delegation**: The `Refactorer` spawns an `Analyzer` sub-agent to validate its own output before returning.

The LLM backend is OpenAI (`gpt-4o-mini` by default). The abstraction layer (`OpenAIClient`) makes swapping providers straightforward.

---

## Project Layout

```
src/
├── main.ts                     Entry point; loads .env, builds Orchestrator, runs pipeline
├── types/index.ts              Shared interfaces: AgentTask, AgentResult, ExecutionPlan, …
├── llm/
│   └── OpenAIClient.ts         Thin wrapper over openai SDK — agents call this, not SDK directly
├── agents/
│   ├── Agent.ts                Abstract base: withTracking(), callLLM(), createSubTask()
│   ├── AnalyzerAgent.ts        Produces structured code analysis report
│   ├── RefactorerAgent.ts      Produces refactored code; delegates to Analyzer for validation
│   └── TesterAgent.ts          Generates Jest/Vitest unit test suite
├── orchestrator/
│   └── Orchestrator.ts         Plans execution via LLM, runs steps, aggregates results
└── utils/
    └── logger.ts               Colored, indented console logger with timing
```

---

## Data Flow

```
main.ts
  → creates OpenAIClient + Orchestrator
  → builds AgentTask { id, type:"orchestrate", code, context }
  → orchestrator.execute(task)

Orchestrator.execute
  1. createExecutionPlan(task)        ← LLM decides which agents to invoke and in what order
  2. executePlan(plan, task)          ← runs each step sequentially
     a. AnalyzerAgent.execute()
        └─ callLLM → analysis report
        └─ stores: sharedContext.analysis
     b. RefactorerAgent.execute()     (only if Analyzer succeeded — dependency check)
        └─ callLLM → refactored code
        └─ [hierarchical] AnalyzerAgent.execute(refactored code)   ← validates improvement
        └─ stores: sharedContext.refactoredCode
     c. TesterAgent.execute()         (only if dependencies succeeded)
        └─ callLLM → test suite (uses refactored code if available)
  3. aggregateResults()              ← markdown report with per-agent status + timing
```

### Context Propagation

A `sharedContext` dictionary accumulates agent outputs and feeds them to downstream agents:

| Produced by   | Key               | Consumed by              |
|---------------|-------------------|--------------------------|
| Analyzer      | `analysis`        | Refactorer, Tester       |
| Refactorer    | `refactoredCode`  | Tester                   |
| Tester        | `tests`           | (end of pipeline)        |

---

## Key Design Decisions

### 1. AgentTask as Message Envelope
Every inter-agent message has the same shape: `{ id, type, code, context?, createdBy, createdAt }`. This makes logging, tracing, and extending the system uniform.

### 2. AgentResult as Standardized Output
All agents return `{ agentName, taskId, success, output, data?, durationMs, subResults? }`. The `subResults` array carries hierarchical delegation results (e.g. Refactorer's validator).

### 3. `withTracking()` Template Method
Every agent's `execute()` wraps its logic in `this.withTracking(task, async () => {...})`. This gives uniform timing, logging (`agentStart`/`agentEnd`), and error handling without duplicating code.

### 4. Orchestrator is Also an Agent
`Orchestrator extends Agent`. This means it can itself be orchestrated by a higher-level coordinator — the system is composable without changes.

### 5. LLM-Driven Planning
The Orchestrator sends the user's request to the LLM to produce an `ExecutionPlan` JSON. If the LLM fails to return valid JSON, it falls back to a hardcoded default plan (analyze → refactor → test).

### 6. Dependency-Gated Execution
Steps with `dependsOn` are skipped if any listed dependency failed. This prevents cascading nonsense (e.g. running Refactorer with no analysis when Analyzer crashed).

---

## Agent Responsibilities

### AnalyzerAgent
- Input: raw code + optional `purpose` / `previousAnalysis` context
- Output: structured report covering code smells, complexity, bugs, design, positive aspects, and top-3 priority recommendations
- Temperature: 0.2 (deterministic analysis)

### RefactorerAgent (Hierarchical Pattern)
- Input: raw code + optional `analysis` from Analyzer
- Output: refactoring summary + complete refactored code + changes list
- After generating output, spawns `AnalyzerAgent` sub-agent with the *refactored* code to validate improvement
- Temperature: 0.3

### TesterAgent
- Input: refactored code (or original if no refactoring ran) + optional `analysis`
- Output: test strategy + complete test file + coverage notes
- Uses Jest/Vitest syntax, mocks external deps
- Temperature: 0.2

### Orchestrator
- Input: user request (in `context.userRequest`) + code
- LLM call 1: produce `ExecutionPlan` JSON
- Runs each step sequentially, passes accumulated context forward
- Output: aggregated markdown report
- Temperature: 0.1 (highly deterministic planning)

---

## Running the Project

```bash
# Prerequisites
cp .env.example .env        # add OPENAI_API_KEY
npm install

# Run with built-in sample code
npm start

# Run on your own file
npm start -- --file path/to/file.ts

# Watch mode (re-runs on file change)
npm run dev
```

The sample code in `main.ts` is intentionally messy Node.js (SQL injection, callback hell, duplicated logic, `var`, poor naming) — a good test case for the full pipeline.

---

## Known Limitations

| Area | Status | Notes |
|------|--------|-------|
| Parallel execution | Not implemented | `ExecutionStep.parallel` flag exists but execution is always sequential |
| Code validation | Not implemented | Refactored code and generated tests are strings; no syntax check |
| Test execution | Not implemented | Tests are generated, not run |
| Static analysis | Not implemented | All analysis is LLM-based only |
| Retry / rate limiting | Not implemented | OpenAI errors surface immediately |
| Streaming | Not implemented | All responses are full strings |
| Token tracking | Not implemented | No cost visibility |
| Logger thread-safety | N/A for now | Global `indentLevel` would corrupt with true parallel execution |

---

## Extension Points

**Add a new agent:**
1. Create `src/agents/MyAgent.ts` extending `Agent`
2. Register it in `Orchestrator.workers` map
3. Update `AgentTask.type` union in `types/index.ts`
4. Update the orchestrator's system prompt to describe the new agent

**Swap LLM provider:**
Replace `OpenAIClient` with another class implementing the same `complete(messages, options)` / `ask(system, user, options)` interface. No agent code changes needed.

**Add parallel execution:**
In `Orchestrator.executePlan`, group steps by dependency level (topological sort), then `Promise.all()` each group. Requires making logger indentation thread-safe (per-task indent tracking).
