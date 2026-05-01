// Every task flowing through the system carries this structure.
// It's the "message envelope" that agents send to each other.

export interface AgentTask {
  id: string;
  type: "analyze" | "refactor" | "test" | "orchestrate";
  code: string;
  context?: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
}

// Every agent returns this structure.
// Standardized output makes it easy to aggregate results.

export interface AgentResult {
  agentName: string;
  taskId: string;
  success: boolean;
  output: string;
  data?: Record<string, unknown>;
  durationMs: number;
  subResults?: AgentResult[];
}

export interface AgentConfig {
  name: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// The orchestrator's decomposition plan.
// When the orchestrator analyzes a user request, it produces this.

export interface ExecutionPlan {
  summary: string;
  steps: ExecutionStep[];
}

export interface ExecutionStep {
  agentType: "analyze" | "refactor" | "test";
  description: string;
  dependsOn?: string[];
  parallel?: boolean;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
