import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

import OpenAI from "openai";

const client = new OpenAI();
const MODEL = "gpt-4o-mini";

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_current_time",
      description:
        "Returns the current date and time. Use this whenever the user asks what time or day it is.",
      parameters: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description: "IANA timezone, e.g. 'America/Sao_Paulo'. Optional.",
          },
        },
        required: [],
      },
    },
  },
];

const toolImpls: Record<string, (input: any) => string> = {
  get_current_time: ({ timezone }) => {
    const now = new Date();
    const formatted = timezone
      ? now.toLocaleString("en-US", { timeZone: timezone })
      : now.toISOString();
    return `The current time is ${formatted}${timezone ? ` (${timezone})` : " (UTC)"}.`;
  },
};


async function runAgent(userPrompt: string) {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  const MAX_ITERATIONS = 10; // safety cap so a confused model can't loop forever
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n--- iteration ${i + 1}: calling model ---`);

    const response = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 1024,
      tools, // <-- we advertise the tools every call
      messages,
    });

    const choice = response.choices[0];
    console.log("finish_reason:", choice.finish_reason);

    // Always record the assistant's full turn (text + any tool_calls).
    messages.push(choice.message);

    // If the model did NOT ask for a tool, it's done. Print and exit the loop.
    if (choice.finish_reason !== "tool_calls") {
      console.log("\n✅ final answer:", choice.message.content ?? "");
      return;
    }

    // Otherwise: execute every tool_call the model requested, in order.
    // (The model can request several at once — handle all of them.)
    for (const toolCall of choice.message.tool_calls ?? []) {
      const { name, arguments: argsJson } = toolCall.function;
      const input = JSON.parse(argsJson);

      console.log(`🔧 model wants: ${name}(${argsJson})`);
      const impl = toolImpls[name];

      const resultText = impl
        ? impl(input)
        : `Error: unknown tool "${name}"`;
      console.log(`   → result: ${resultText}`);

      // CRITICAL: tool_call_id MUST match the id the model gave us.
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: resultText,
      });
    }

    // Loop — the model now "sees" the tool output and continues
    // (often producing the final answer next).
  }

  console.log("\n⚠️ hit MAX_ITERATIONS without finishing.");
}

runAgent("What time is it right now in São Paulo?").catch(console.error);
