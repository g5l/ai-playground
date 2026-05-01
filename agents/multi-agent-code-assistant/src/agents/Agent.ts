// An Agent is just a function that takes a Task and returns a Result,
// with an LLM in the middle. The system prompt defines its expertise.

import { randomUUID } from "node:crypto";
import type { OpenAIClient } from "../llm/OpenAIClient.js";
import type { AgentConfig, AgentResult, AgentTask, LLMMessage } from "../types/index.js";
import { logger } from "../utils/logger.js";

export abstract class Agent {
  protected config: AgentConfig;
  protected llm: OpenAIClient;

  constructor(config: AgentConfig, llm: OpenAIClient) {
    this.config = config;
    this.llm = llm;
  }

  get name(): string {
    return this.config.name;
  }

  abstract execute(task: AgentTask): Promise<AgentResult>;

  protected async callLLM(userMessage: string): Promise<string> {
    return this.llm.ask(this.config.systemPrompt, userMessage, {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });
  }

  protected async callLLMWithHistory(messages: LLMMessage[]): Promise<string> {
    const fullMessages: LLMMessage[] = [
      { role: "system", content: this.config.systemPrompt },
      ...messages,
    ];
    return this.llm.complete(fullMessages, {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });
  }

  // Wraps execution with timing, logging, and error handling.
  // Every subclass calls this in their execute() implementation.
  protected async withTracking(
    task: AgentTask,
    fn: () => Promise<{
      output: string;
      data?: Record<string, unknown>;
      subResults?: AgentResult[];
    }>
  ): Promise<AgentResult> {
    logger.agentStart(this.name, task.type);
    const start = performance.now();

    try {
      const result = await fn();
      const durationMs = Math.round(performance.now() - start);
      logger.agentEnd(this.name, durationMs, true);

      return {
        agentName: this.name,
        taskId: task.id,
        success: true,
        output: result.output,
        data: result.data,
        durationMs,
        subResults: result.subResults,
      };
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      logger.agentEnd(this.name, durationMs, false);
      logger.error(`Agent ${this.name} failed`, error);

      return {
        agentName: this.name,
        taskId: task.id,
        success: false,
        output: error instanceof Error ? error.message : "Unknown error",
        durationMs,
      };
    }
  }

  // Helper to create a sub-task (for hierarchical delegation).
  protected createSubTask(
    type: AgentTask["type"],
    code: string,
    context?: Record<string, unknown>
  ): AgentTask {
    return {
      id: randomUUID(),
      type,
      code,
      context,
      createdBy: this.name,
      createdAt: new Date(),
    };
  }
}
