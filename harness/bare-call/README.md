# POC 1 — The bare call

Goal: see the raw request/response shape and feel the statelessness.

No harness yet. Just: messages in, choices out.

## Run

From the `harness/` root:

```bash
npm run poc-01
```

Or directly from this directory:

```bash
npx tsx poc-01-bare-call.ts
```

## Example output

```
finish_reason: stop
raw response: {
  "id": "chatcmpl-DuJPXszR3VhEMydzt3nsQEheKEX30",
  "object": "chat.completion",
  "created": 1782313355,
  "model": "gpt-4o-mini-2024-07-18",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "An AI agent harness is a framework or platform designed to facilitate the development, deployment, and management of artificial intelligence agents, enabling them to perform specific tasks or solve problems autonomously within defined environments.",
        "refusal": null,
        "annotations": []
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 18,
    "completion_tokens": 39,
    "total_tokens": 57,
    "prompt_tokens_details": {
      "cached_tokens": 0,
      "audio_tokens": 0
    },
    "completion_tokens_details": {
      "reasoning_tokens": 0,
      "audio_tokens": 0,
      "accepted_prediction_tokens": 0,
      "rejected_prediction_tokens": 0
    }
  },
  "service_tier": "default",
  "system_fingerprint": "fp_bbc23ca3d7"
}

answer: An AI agent harness is a framework or platform designed to facilitate the development, deployment, and management of artificial intelligence agents, enabling them to perform specific tasks or solve problems autonomously within defined environments.

amnesia demo: You asked what you had just asked me. However, I don't have the ability to recall previous interactions in this chat. If you have a specific question or topic in mind, feel free to ask again!
```

## Key ideas

1. **Response shape** - OpenAI wraps the answer in `choices[0].message.content` (a plain string), not a content-block array. `finish_reason: "stop"` means the model ended naturally.

2. **Statelessness** - The second call has no memory of the first. The model can only guess what was asked because the harness never sent the conversation history. Fixing that is POC 2.
