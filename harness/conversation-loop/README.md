# POC 2 — The conversation loop

Goal: maintain history across turns. The model is stateless, so the harness holds the message list and resends the whole thing every turn.

This is a REPL: type a message, get a reply, repeat. Type "exit" to quit.

## Run

From the `harness/` root:

```bash
npm run poc-02
```

Or directly from this directory:

```bash
npx tsx --env-file=../.env poc-02-conversation-loop.ts
```

## Example output

```
Chat started. Type "exit" to quit.

you: Hello
gpt: Hello! How can I assist you today? 

you: I'm just testing
gpt: No problem at all! Feel free to test as much as you need. If you have any questions or need assistance, just let me know! 

you: What was my last message?
gpt: Your last message was, "I'm just testing." Is there anything specific you'd like to do or ask about? 
```

## Key ideas

1. **State lives in the harness** - `messages` is a plain array that grows every turn. The model never stores anything; we do.

2. **Full history every call** - Every `chat.completions.create` call sends the entire `messages` array, not just the latest message. That is why the model can answer "what did I just say?" correctly.

3. **Growing cost** - Token count increases with every turn. Trimming or summarising the history to keep costs under control is covered in POC 6.
