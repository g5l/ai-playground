const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
} as const;

let indentLevel = 0;

function indent(): string {
  return "  ".repeat(indentLevel);
}

export const logger = {
  agentStart(agentName: string, taskType: string): void {
    console.log(
      `${indent()}${COLORS.cyan}${COLORS.bright}▶ [${agentName}]${COLORS.reset} ` +
        `Starting task: ${COLORS.yellow}${taskType}${COLORS.reset}`
    );
    indentLevel++;
  },

  agentEnd(agentName: string, durationMs: number, success: boolean): void {
    indentLevel = Math.max(0, indentLevel - 1);
    const status = success
      ? `${COLORS.green}✓ SUCCESS${COLORS.reset}`
      : `${COLORS.red}✗ FAILED${COLORS.reset}`;
    console.log(
      `${indent()}${COLORS.cyan}${COLORS.bright}◀ [${agentName}]${COLORS.reset} ` +
        `${status} ${COLORS.dim}(${durationMs}ms)${COLORS.reset}`
    );
  },

  plan(summary: string, steps: { agentType: string; description: string }[]): void {
    console.log(`\n${indent()}${COLORS.magenta}${COLORS.bright}📋 Execution Plan${COLORS.reset}`);
    console.log(`${indent()}${COLORS.dim}${summary}${COLORS.reset}`);
    steps.forEach((step, i) => {
      console.log(
        `${indent()}  ${i + 1}. ${COLORS.blue}[${step.agentType}]${COLORS.reset} ${step.description}`
      );
    });
    console.log();
  },

  delegate(parentAgent: string, childAgent: string, reason: string): void {
    console.log(
      `${indent()}${COLORS.yellow}↳ [${parentAgent}]${COLORS.reset} delegating to ` +
        `${COLORS.cyan}[${childAgent}]${COLORS.reset}: ${reason}`
    );
  },

  info(message: string): void {
    console.log(`${indent()}${COLORS.dim}  ℹ ${message}${COLORS.reset}`);
  },

  error(message: string, error?: unknown): void {
    console.error(`${indent()}${COLORS.red}  ✗ ${message}${COLORS.reset}`);
    if (error instanceof Error) {
      console.error(`${indent()}${COLORS.dim}    ${error.message}${COLORS.reset}`);
    }
  },

  finalOutput(): void {
    console.log(`\n${COLORS.green}${COLORS.bright}${"═".repeat(60)}${COLORS.reset}`);
    console.log(`${COLORS.green}${COLORS.bright}  AGGREGATED RESULT${COLORS.reset}`);
    console.log(`${COLORS.green}${COLORS.bright}${"═".repeat(60)}${COLORS.reset}\n`);
  },
};
