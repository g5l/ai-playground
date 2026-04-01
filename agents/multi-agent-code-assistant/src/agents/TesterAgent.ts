import type { OpenAIClient } from "../llm/OpenAIClient.js";
import type { AgentResult, AgentTask } from "../types/index.js";
import { Agent } from "./Agent.js";

const SYSTEM_PROMPT = `You are a senior QA engineer specializing in writing unit tests. Your job is to create comprehensive, meaningful test suites.

Your testing principles:
- Write tests using a common testing framework (Jest/Vitest syntax)
- Cover happy paths, edge cases, and error scenarios
- Use descriptive test names that explain the expected behavior
- Group related tests in describe blocks
- Mock external dependencies properly
- Aim for high coverage but prioritize meaningful assertions over line coverage
- If analysis findings mention potential bugs, write specific tests to catch those bugs

Your response format:
1. **Test Strategy**: Brief overview of what you're testing and why
2. **Test Code**: The complete test file in a code block
3. **Coverage Notes**: What's covered, what's not, and why

Always produce RUNNABLE test code with proper imports and setup.`;

export class TesterAgent extends Agent {
  constructor(llm: OpenAIClient) {
    super(
      {
        name: "Tester",
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.2,
        maxTokens: 4000,
      },
      llm
    );
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    return this.withTracking(task, async () => {
      const codeToTest =
        (task.context?.refactoredCode as string) ?? task.code;
      const isRefactored = !!task.context?.refactoredCode;

      let userMessage = `Please write comprehensive unit tests for the following ${isRefactored ? "refactored " : ""}code:\n\n\`\`\`\n${codeToTest}\n\`\`\``;

      if (task.context?.analysis) {
        userMessage += `\n\nCode analysis found these issues (write tests that catch these):\n${task.context.analysis}`;
      }

      const output = await this.callLLM(userMessage);

      return {
        output,
        data: {
          taskType: "testing",
          testedRefactoredVersion: isRefactored,
        },
      };
    });
  }
}