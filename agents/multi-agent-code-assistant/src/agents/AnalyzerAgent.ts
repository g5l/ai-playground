import type { OpenAIClient } from "../llm/OpenAIClient.js";
import type { AgentResult, AgentTask } from "../types/index.js";
import { Agent } from "./Agent.js";

const SYSTEM_PROMPT = `You are a senior code analyst. Your job is to examine code and provide a thorough, structured analysis.

For every piece of code you receive, analyze and report on:

1. **Code Smells**: Identify any anti-patterns, duplicated logic, overly complex functions, or violations of clean code principles.
2. **Complexity Issues**: Point out deeply nested logic, functions that do too much, or hard-to-follow control flow.
3. **Potential Bugs**: Flag anything that could cause runtime errors, edge case failures, or unexpected behavior.
4. **Design Patterns**: Identify which patterns are used (or should be used). Note any SOLID principle violations.
5. **Positive Aspects**: What's done well? Acknowledge good practices.

Format your response as a structured report with clear sections. Be specific — reference line numbers or function names when possible. Be constructive, not just critical.

End with a "Priority Recommendations" section listing the top 3 things to fix, ordered by impact.`;

export class AnalyzerAgent extends Agent {
  constructor(llm: OpenAIClient) {
    super(
      {
        name: "Analyzer",
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.2,
        maxTokens: 3000,
      },
      llm
    );
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    return this.withTracking(task, async () => {
      let userMessage = `Please analyze the following code:\n\n\`\`\`\n${task.code}\n\`\`\``;

      if (task.context?.purpose) {
        userMessage += `\n\nContext: ${task.context.purpose}`;
      }

      if (task.context?.previousAnalysis) {
        userMessage += `\n\nA previous analysis found these issues:\n${task.context.previousAnalysis}\n\nFocus on whether these issues have been addressed.`;
      }

      const output = await this.callLLM(userMessage);

      return {
        output,
        data: {
          taskType: "analysis",
          codeLength: task.code.length,
          analysisText: output,
        },
      };
    });
  }
}