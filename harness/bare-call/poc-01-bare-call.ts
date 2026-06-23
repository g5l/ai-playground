import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

import OpenAI from "openai";

const client = new OpenAI();
const MODEL = "gpt-4o-mini";

async function main() {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 1024,
    messages: [
      { role: "user", content: "In one sentence, what is an AI agent harness?" },
    ],
  });
  
  console.log("finish_reason:", response.choices[0].finish_reason);
  console.log("raw response:", JSON.stringify(response, null, 2));

  const text = response.choices[0].message.content ?? "";
  console.log("\nanswer:", text);
  
  const amnesia = await client.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 256,
    messages: [{ role: "user", content: "What did I just ask you?" }],
  });
  console.log(
    "\namnesia demo:",
    amnesia.choices[0].message.content ?? ""
  );
}

main().catch(console.error);
