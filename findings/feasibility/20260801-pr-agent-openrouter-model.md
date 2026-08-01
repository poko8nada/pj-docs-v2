# PR-Agent OpenRouter Model Selection

Date: 2026-08-01

## Research

### DeepSeek V4 Flash 0731 as the cost-first primary

- Claim: DeepSeek V4 Flash 0731 is a post-training upgrade of the V4 Flash preview, with the same 284B/13B-active architecture and 1M context, but substantially stronger reported agent and coding results.
- Confidence: High for the release and published specifications; medium for production quality because the headline agent benchmarks use DeepSeek's own unreleased harness.

#### Evidence

- Official: The DeepSeek model card reports Terminal-Bench 2.1 82.7 versus 61.8 for the preview, DeepSWE 54.4 versus 7.3, and Toolathlon-Verified 70.3 versus 49.7. The notes identify DeepSeek Harness and maximum reasoning settings.
- Practice: OpenRouter lists the dated model at 1M context, $0.09 input / $0.18 output per million tokens, Coding Index 69.1, and Agentic Index 45.7. These are current operational/catalog signals rather than a guarantee for PR-Agent.
- Failure: The PR-Agent community discussion identifies `reasoning_content` preservation, streaming, tool calling, max-token limits, and fallback behavior as integration risks for DeepSeek V4 models.

### GPT-5.6 Luna as the reliability fallback

- Claim: GPT-5.6 Luna is a low-cost fallback with a stronger current operational signal than the newly released 0731 snapshot.
- Confidence: Medium to high for current catalog data; pricing includes a current OpenRouter discount and may change.

#### Evidence

- Official: OpenRouter lists GPT-5.6 Luna at 1M context and $0.10 input / $0.60 output per million tokens while the 50% discount is active.
- Practice: The same page reports Coding Index 71.4, Agentic Index 45.6, and average provider uptime of 99.86% over the recent period.
- Failure: PR-Agent's current model registry contains the base `gpt-5.6-luna` identifier, but an `openrouter/...` model path still needs configuration validation.

### Selected model policy

- Claim: Use the newly released DeepSeek snapshot for normal reviews and GPT-5.6 Luna as the cross-provider fallback.
- Confidence: Medium; the order is cost-first and must be validated against the current repository's real pull request.

```text
Primary:  openrouter/deepseek/deepseek-v4-flash-0731
Fallback: openrouter/openai/gpt-5.6-luna
```

- Use the dated OpenRouter model ID to avoid silently following a later model update.
- Do not add `model_weak` or `model_reasoning` in the first configuration slice.
- Leave provider routing and explicit reasoning controls unset until the basic review path works.
- Verify `custom_model_max_tokens` before writing `.pr_agent.toml`; the dated OpenRouter model may not be present in PR-Agent's token registry.
- Test the `auto_review` path before enabling more complex multi-step actions, because DeepSeek V4 thinking-mode integrations have reported `reasoning_content` round-trip failures.

## Handoff

- Topic: Cost-first PR-Agent model selection through OpenRouter.
- Path: `findings/feasibility/20260801-pr-agent-openrouter-model.md`
- Why: The previous generic V4 Flash candidate was superseded by the 0731 release; the user selected the dated snapshot with GPT-5.6 Luna as fallback.
- Summary: The dated DeepSeek snapshot is the selected primary because its cost and current agent/coding signals fit the goal. GPT-5.6 Luna is the fallback because its current operational signal and PR-Agent registry support are stronger.
- Axes touched: Primary/fallback model IDs, model pinning, token-limit compatibility, initial reasoning/provider-routing restraint.

## Sources

- https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731
- https://openrouter.ai/deepseek/deepseek-v4-flash-0731
- https://openrouter.ai/openai/gpt-5.6-luna
- https://github.com/The-PR-Agent/pr-agent/releases/tag/v0.38.0
- https://github.com/The-PR-Agent/pr-agent/discussions/2437
- https://github.com/anomalyco/opencode/issues/24190
