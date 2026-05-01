// Agents don't import 'openai' directly. They call `complete(messages)`
// and get a string back. This makes it trivial to swap providers later.

import OpenAI from "openai";
import type { LLMMessage } from "../types/index.js";

export interface LLMClientConfig {
  apiKey: string;
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class OpenAIClient {
  private client: OpenAI;
  private defaultModel: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(config: LLMClientConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.defaultModel = config.defaultModel ?? "gpt-4o-mini";
    this.defaultTemperature = config.defaultTemperature ?? 0.3;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 4096;
  }

  async complete(messages: LLMMessage[], options: CompletionOptions = {}): Promise<string> {
    const model = options.model ?? this.defaultModel;
    const temperature = options.temperature ?? this.defaultTemperature;
    const maxTokens = options.maxTokens ?? this.defaultMaxTokens;

    try {
      const response = await this.client.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from LLM");
      }

      return content;
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`LLM API Error [${error.status}]: ${error.message}`);
      }
      throw error;
    }
  }

  async ask(
    systemPrompt: string,
    userMessage: string,
    options: CompletionOptions = {}
  ): Promise<string> {
    return this.complete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      options
    );
  }
}
