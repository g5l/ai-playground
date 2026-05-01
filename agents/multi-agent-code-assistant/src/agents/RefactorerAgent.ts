// This is the most interesting agent: it demonstrates the HIERARCHICAL
// pattern. After producing refactored code, it delegates to an Analyzer
// sub-agent to validate the output is actually an improvement.

import type { OpenAIClient } from "../llm/OpenAIClient.js";
import type { AgentResult, AgentTask } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { Agent } from "./Agent.js";
import { AnalyzerAgent } from "./AnalyzerAgent.js";

const SYSTEM_PROMPT = `You are a senior software engineer specializing in code refactoring. Your job is to take code and its analysis, then produce a cleaner, more maintainable version.

Your refactoring principles:
- Apply SOLID principles where appropriate
- Reduce complexity (lower cyclomatic complexity, fewer nested blocks)
- Improve naming (variables, functions, classes should be self-documenting)
- Extract reusable functions/methods where there's duplication
- Add TypeScript types where they're missing or could be more precise
- Preserve the original behavior — refactoring must not change functionality

Your response format:
1. **Refactoring Summary**: Brief overview of changes made and why
2. **Refactored Code**: The complete refactored code in a code block
3. **Changes Made**: A numbered list of specific changes with brief justifications

Always produce the COMPLETE refactored code — never use comments like "// rest remains the same".`;

const MAX_VALIDATION_DEPTH = 1;

export class RefactorerAgent extends Agent {
  private analyzerSubAgent: AnalyzerAgent;

  constructor(llm: OpenAIClient) {
    super(
      {
        name: "Refactorer",
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.3,
        maxTokens: 4000,
      },
      llm
    );

    // Hierarchical pattern: Refactorer "manages" an Analyzer as sub-agent
    this.analyzerSubAgent = new AnalyzerAgent(llm);
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    return this.withTracking(task, async () => {
      let userMessage = `Please refactor the following code:\n\n\`\`\`\n${task.code}\n\`\`\``;

      if (task.context?.analysis) {
        userMessage += `\n\nAnalysis findings to address:\n${task.context.analysis}`;
      }

      // Step 1: Generate refactored code
      const refactoredOutput = await this.callLLM(userMessage);

      // Step 2: Hierarchical delegation — validate with Analyzer sub-agent
      const subResults: AgentResult[] = [];
      const validationDepth = (task.context?.validationDepth as number) ?? 0;

      if (validationDepth < MAX_VALIDATION_DEPTH) {
        logger.delegate(
          this.name,
          this.analyzerSubAgent.name,
          "Validating refactored code quality"
        );

        const validationTask = this.createSubTask("analyze", refactoredOutput, {
          purpose:
            "Validate that this refactored code is an improvement over the original. " +
            "Focus on whether the identified issues were addressed.",
          previousAnalysis: task.context?.analysis as string,
        });

        const validationResult = await this.analyzerSubAgent.execute(validationTask);
        subResults.push(validationResult);

        if (validationResult.success) {
          logger.info("Validation complete — sub-agent confirmed refactoring quality");
        }
      }

      return {
        output: refactoredOutput,
        data: {
          taskType: "refactoring",
          validationPerformed: validationDepth < MAX_VALIDATION_DEPTH,
          validationDepth,
        },
        subResults,
      };
    });
  }
}
