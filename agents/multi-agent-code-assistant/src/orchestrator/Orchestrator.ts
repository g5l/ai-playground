import { randomUUID } from "node:crypto";
import type { OpenAIClient } from "../llm/OpenAIClient.js";
import type { AgentResult, AgentTask, ExecutionPlan } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { Agent } from "../agents/Agent.js";
import { AnalyzerAgent } from "../agents/AnalyzerAgent.js";
import { RefactorerAgent } from "../agents/RefactorerAgent.js";
import { TesterAgent } from "../agents/TesterAgent.js";

const ORCHESTRATOR_PROMPT = `You are a task orchestrator for a code assistant system. You have three specialist agents available:

1. **analyze** — Examines code for smells, complexity, bugs, and design issues
2. **refactor** — Refactors code based on analysis findings
3. **test** — Generates unit tests for the code

Given a user's request about their code, determine which agents to invoke and in what order.

IMPORTANT: Respond with ONLY a valid JSON object (no markdown, no backticks). Use this exact format:
{
  "summary": "Brief description of the plan",
  "steps": [
    {
      "agentType": "analyze",
      "description": "What this step will do",
      "dependsOn": [],
      "parallel": false
    }
  ]
}

Rules:
- If refactoring is needed, ALWAYS run analysis first (refactor depends on analyze)
- If testing is requested, it can run after analysis (or after refactoring if both are requested)
- If the user just wants analysis, only include the analyze step
- Order steps by dependencies`;

export class Orchestrator extends Agent {
  private workers: Map<string, Agent>;

  constructor(llm: OpenAIClient) {
    super(
      {
        name: "Orchestrator",
        systemPrompt: ORCHESTRATOR_PROMPT,
        model: "gpt-4o-mini",
        temperature: 0.1,
        maxTokens: 1000,
      },
      llm
    );

    this.workers = new Map<string, Agent>([
      ["analyze", new AnalyzerAgent(llm)],
      ["refactor", new RefactorerAgent(llm)],
      ["test", new TesterAgent(llm)],
    ]);
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    return this.withTracking(task, async () => {
      const plan = await this.createExecutionPlan(task);
      logger.plan(plan.summary, plan.steps);

      const stepResults = await this.executePlan(plan, task);
      const aggregatedOutput = this.aggregateResults(plan, stepResults);

      return {
        output: aggregatedOutput,
        data: {
          planSummary: plan.summary,
          stepsExecuted: plan.steps.length,
          allSuccessful: stepResults.every((r) => r.success),
        },
        subResults: stepResults,
      };
    });
  }

  // Uses the LLM to decompose a user request into concrete steps.
  // This is where the "intelligence" of the orchestrator lives.
  private async createExecutionPlan(task: AgentTask): Promise<ExecutionPlan> {
    const userMessage = `User request: "${task.context?.userRequest ?? "Analyze, refactor, and test this code"}"\n\nCode to work with:\n\`\`\`\n${task.code.substring(0, 500)}${task.code.length > 500 ? "\n... (truncated for planning)" : ""}\n\`\`\`\n\nDetermine which agents to invoke and in what order.`;

    const response = await this.callLLM(userMessage);

    try {
      const cleaned = response.replace(/```json\s*|```\s*/g, "").trim();
      const plan = JSON.parse(cleaned) as ExecutionPlan;

      plan.steps = plan.steps.filter((step) => this.workers.has(step.agentType));

      if (plan.steps.length === 0) {
        return this.defaultPlan();
      }

      return plan;
    } catch {
      logger.error("Failed to parse execution plan, using default");
      return this.defaultPlan();
    }
  }

  // Core orchestration logic. Each step's output becomes context for
  // the next step — this is what makes agents truly collaborative.
  private async executePlan(plan: ExecutionPlan, originalTask: AgentTask): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    const sharedContext: Record<string, unknown> = {
      userRequest: originalTask.context?.userRequest,
    };

    // Track which agent types succeeded, to gate dependency checks
    const succeeded = new Set<string>();

    for (const step of plan.steps) {
      const worker = this.workers.get(step.agentType);
      if (!worker) continue;

      // Skip this step if any dependency failed
      const blockedBy = step.dependsOn?.find((dep) => !succeeded.has(dep));
      if (blockedBy) {
        logger.info(`Skipping [${step.agentType}] — dependency [${blockedBy}] did not succeed`);
        continue;
      }

      const stepContext = { ...sharedContext };

      if (step.agentType === "refactor" && sharedContext.analysis) {
        stepContext.analysis = sharedContext.analysis;
      }

      if (step.agentType === "test") {
        if (sharedContext.analysis) stepContext.analysis = sharedContext.analysis;
        if (sharedContext.refactoredCode) stepContext.refactoredCode = sharedContext.refactoredCode;
      }

      const workerTask: AgentTask = {
        id: randomUUID(),
        type: step.agentType as AgentTask["type"],
        code: originalTask.code,
        context: stepContext,
        createdBy: this.name,
        createdAt: new Date(),
      };

      const result = await worker.execute(workerTask);
      results.push(result);

      // Feed output into shared context for downstream agents
      if (result.success) {
        succeeded.add(step.agentType);
        if (step.agentType === "analyze") {
          sharedContext.analysis = result.output;
        } else if (step.agentType === "refactor") {
          sharedContext.refactoredCode = result.output;
        } else if (step.agentType === "test") {
          sharedContext.tests = result.output;
        }
      }
    }

    return results;
  }

  private aggregateResults(plan: ExecutionPlan, results: AgentResult[]): string {
    const sections: string[] = [];

    sections.push(`# Code Assistant Report`);
    sections.push(`**Plan**: ${plan.summary}\n`);

    for (const result of results) {
      const status = result.success ? "✅" : "❌";
      sections.push(`---`);
      sections.push(`## ${status} ${result.agentName} (${result.durationMs}ms)\n`);
      sections.push(result.output);

      if (result.subResults?.length) {
        for (const sub of result.subResults) {
          sections.push(`\n### ↳ Sub-agent: ${sub.agentName} (${sub.durationMs}ms)\n`);
          sections.push(sub.output);
        }
      }
    }

    const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
    const allSuccess = results.every((r) => r.success);
    sections.push(`\n---`);
    sections.push(
      `**Total execution time**: ${totalDuration}ms | **Status**: ${allSuccess ? "All agents succeeded ✅" : "Some agents failed ❌"}`
    );

    return sections.join("\n");
  }

  private defaultPlan(): ExecutionPlan {
    return {
      summary: "Full analysis pipeline: analyze → refactor → test",
      steps: [
        {
          agentType: "analyze",
          description: "Analyze code quality and identify issues",
          parallel: false,
        },
        {
          agentType: "refactor",
          description: "Refactor code based on analysis",
          dependsOn: ["analyze"],
          parallel: false,
        },
        {
          agentType: "test",
          description: "Generate tests for refactored code",
          dependsOn: ["refactor"],
          parallel: false,
        },
      ],
    };
  }
}
