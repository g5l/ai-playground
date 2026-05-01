import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { OpenAIClient } from "./llm/OpenAIClient.js";
import { Orchestrator } from "./orchestrator/Orchestrator.js";
import type { AgentTask } from "./types/index.js";
import { logger } from "./utils/logger.js";

config();

// Intentionally messy code: SQL injection, callback hell, duplicated
// logic, poor naming, missing error handling, potential bugs.
const SAMPLE_CODE = `
const db = require('./db');

function getUsers(req, res) {
  db.query('SELECT * FROM users', function(err, results) {
    if (err) {
      console.log(err);
      res.status(500).send('Error');
    }
    
    var users = [];
    for (var i = 0; i < results.length; i++) {
      var u = results[i];
      if (u.active == true) {
        var userData = {
          id: u.id,
          name: u.first_name + ' ' + u.last_name,
          email: u.email,
          role: u.role
        };
        users.push(userData);
      }
    }
    
    res.json(users);
  });
}

function getUserById(req, res) {
  var id = req.params.id;
  db.query('SELECT * FROM users WHERE id = ' + id, function(err, results) {
    if (err) {
      console.log(err);
      res.status(500).send('Error');
    }
    
    if (results.length > 0) {
      var u = results[0];
      var userData = {
        id: u.id,
        name: u.first_name + ' ' + u.last_name,
        email: u.email,
        role: u.role
      };
      res.json(userData);
    } else {
      res.status(404).send('Not found');
    }
  });
}

function deleteUser(req, res) {
  var id = req.params.id;
  db.query('DELETE FROM users WHERE id = ' + id, function(err) {
    if (err) {
      console.log(err);
      res.status(500).send('Error');
    }
    res.json({ success: true });
  });
}

module.exports = { getUsers, getUserById, deleteUser };
`;

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ Missing OPENAI_API_KEY in .env file");
    process.exit(1);
  }

  let code = SAMPLE_CODE;
  const fileArg = process.argv.indexOf("--file");
  if (fileArg !== -1 && process.argv[fileArg + 1]) {
    const filePath = process.argv[fileArg + 1];
    try {
      code = readFileSync(filePath, "utf-8");
      logger.info(`Loaded code from: ${filePath}`);
    } catch {
      console.error(`❌ Could not read file: ${filePath}`);
      process.exit(1);
    }
  }

  const llm = new OpenAIClient({
    apiKey,
    defaultModel: "gpt-4o-mini",
  });

  const orchestrator = new Orchestrator(llm);

  const task: AgentTask = {
    id: randomUUID(),
    type: "orchestrate",
    code,
    context: {
      userRequest:
        "Analyze this code for issues, refactor it to be cleaner and more maintainable, and generate comprehensive unit tests.",
    },
    createdBy: "user",
    createdAt: new Date(),
  };

  console.log("\n🤖 Multi-Agent Code Assistant\n");
  console.log(`Code to process: ${code.split("\n").length} lines\n`);

  const result = await orchestrator.execute(task);

  logger.finalOutput();
  console.log(result.output);
}

main().catch(console.error);
