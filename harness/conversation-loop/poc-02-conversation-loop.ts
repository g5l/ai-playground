import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

import OpenAI from "openai";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const client = new OpenAI();
const MODEL = "gpt-4o-mini";

const messages: OpenAI.ChatCompletionMessageParam[] = [];

async function main() {
  const rl = readline.createInterface({ input, output });
  console.log('Chat started. Type "exit" to quit.\n');

  while (true) {
    const userText = await rl.question("you: ");
    if (userText.trim().toLowerCase() === "exit") break;

    messages.push({ role: "user", content: userText });

    const response = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 1024,
      messages, // <-- the whole array, not just the latest message
    });

    messages.push(response.choices[0].message);

    const reply = response.choices[0].message.content ?? "";
    console.log("gpt:", reply, "\n");
  }

  rl.close();
}

main().catch(console.error);
