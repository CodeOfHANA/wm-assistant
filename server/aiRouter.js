/**
 * aiRouter.js — streaming AI chat with agentic tool-call loop.
 *
 * Supports: Anthropic (Claude), OpenAI (GPT), Google (Gemini),
 *           + any OpenAI-compatible API via custom provider
 *
 * SSE events sent to browser:
 *   { type: 'text',        delta: string }
 *   { type: 'tool_start',  name, id, input }
 *   { type: 'tool_result', name, id, result }
 *   { type: 'tool_error',  name, id, error }
 *   { type: 'model_used',  provider, model }
 *   { type: 'done',        usage? }
 *   { type: 'error',       message }
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getMcpTools, callMcpTool } from './mcpClient.js';
import { getKey, getConnectedIds, getCustomProvider } from './providerStore.js';

// ── Rate-limit detection ──────────────────────────────────────────────────────

function isRateLimitError(err) {
  return err?.status === 429 ||
    (typeof err?.message === 'string' &&
      /429|quota.exceed|too many requests|rate.?limit/i.test(err.message));
}

// ── Tool arg coercion (fixes open-source models passing numbers as strings) ────

function coerceArgs(args, schema) {
  if (!schema?.properties || typeof args !== 'object' || !args) return args;
  const out = { ...args };
  for (const [key, def] of Object.entries(schema.properties)) {
    if (!(key in out)) continue;
    const val = out[key];
    if (def.type === 'number' || def.type === 'integer') {
      if (typeof val === 'string' && val !== '') out[key] = Number(val);
    } else if (def.type === 'boolean') {
      if (typeof val === 'string') out[key] = val === 'true';
    } else if (def.type === 'string') {
      if (typeof val !== 'string') out[key] = String(val);
    }
  }
  return out;
}

// ── Auto-model selection ──────────────────────────────────────────────────────

export function autoSelectModel(lastMessage) {
  const connected = getConnectedIds();
  const has = id => connected.includes(id);
  const msg = lastMessage.toLowerCase();

  const hasAny  = connected.length > 0;
  const customs = connected.filter(id => id.startsWith('custom-'));

  if (!hasAny) return null;

  // Complex analysis → best reasoning model available
  if (/analys|trend|compar|varianc|aging|anomal|reconcil|investigat|explain why/i.test(msg)) {
    if (has('anthropic')) return { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    if (has('openai'))    return { provider: 'openai',    model: 'gpt-4o' };
    if (has('google'))    return { provider: 'google',    model: 'gemini-1.5-pro' };
  }

  // Write operations → reliable + cheap
  if (/create|confirm|cancel|move stock|transfer order/i.test(msg)) {
    if (has('anthropic')) return { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' };
    if (has('openai'))    return { provider: 'openai',    model: 'gpt-4o-mini' };
    if (has('google'))    return { provider: 'google',    model: 'gemini-2.0-flash' };
  }

  // Simple lookups → fastest / cheapest
  if (/show|list|get|how many|what|which|where is|find/i.test(msg)) {
    if (has('google'))    return { provider: 'google',    model: 'gemini-2.0-flash' };
    if (has('openai'))    return { provider: 'openai',    model: 'gpt-4o-mini' };
    if (has('anthropic')) return { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' };
  }

  // Default: best available built-in first, then custom
  if (has('anthropic')) return { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' };
  if (has('openai'))    return { provider: 'openai',    model: 'gpt-4o-mini' };
  if (has('google'))    return { provider: 'google',    model: 'gemini-2.0-flash' };

  // Fall back to first connected custom provider
  if (customs.length > 0) {
    const cp = getCustomProvider(customs[0]);
    if (cp) return { provider: cp.id, model: cp.model };
  }

  return null;
}

// ── Tool format converters ────────────────────────────────────────────────────

function toAnthropicTools(mcpTools) {
  return mcpTools.map(t => ({
    name:         t.name,
    description:  t.description,
    input_schema: t.inputSchema,
  }));
}

function toOpenAITools(mcpTools) {
  return mcpTools.map(t => ({
    type: 'function',
    function: {
      name:        t.name,
      description: t.description,
      parameters:  t.inputSchema,
    },
  }));
}

// Strips all property-level type constraints so open-source models (Groq/Llama
// etc.) that confuse string/number types pass server-side schema validation.
// coerceArgs() restores correct types before the actual MCP call.
function relaxSchemaTypes(schema) {
  if (!schema?.properties) return schema;
  const props = {};
  for (const [key, def] of Object.entries(schema.properties)) {
    const { type: _t, ...rest } = def;
    props[key] = rest;
  }
  return { ...schema, properties: props };
}

function toOpenAIToolsRelaxed(mcpTools) {
  return mcpTools.map(t => ({
    type: 'function',
    function: {
      name:        t.name,
      description: t.description,
      parameters:  relaxSchemaTypes(t.inputSchema),
    },
  }));
}

function toGeminiTools(mcpTools) {
  return [{
    functionDeclarations: mcpTools.map(t => {
      // Gemini rejects $schema and additionalProperties — strip both
      const { $schema: _s, additionalProperties: _a, ...schema } = t.inputSchema ?? {};
      return { name: t.name, description: t.description, parameters: schema };
    }),
  }];
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

function send(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ── Anthropic streaming ───────────────────────────────────────────────────────

async function streamClaude({ provider, model, messages, systemPrompt, res }) {
  const apiKey = getKey('anthropic');
  const client = new Anthropic({ apiKey });
  const tools  = await getMcpTools();

  send(res, { type: 'model_used', provider, model });

  const msgs = messages.map(m => ({ role: m.role, content: m.content }));

  while (true) {
    const stream = client.messages.stream({
      model,
      max_tokens: 8096,
      system: systemPrompt,
      messages: msgs,
      tools: toAnthropicTools(tools),
    });

    const assistantContent = [];
    let currentText = null;
    let currentTool = null;

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          currentText = { type: 'text', text: '' };
          assistantContent.push(currentText);
        } else if (event.content_block.type === 'tool_use') {
          currentTool = { type: 'tool_use', id: event.content_block.id, name: event.content_block.name, input: '' };
          assistantContent.push(currentTool);
          send(res, { type: 'tool_start', name: currentTool.name, id: currentTool.id, input: null });
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta' && currentText) {
          currentText.text += event.delta.text;
          send(res, { type: 'text', delta: event.delta.text });
        } else if (event.delta.type === 'input_json_delta' && currentTool) {
          currentTool.input += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        if (currentTool && typeof currentTool.input === 'string') {
          try { currentTool.input = JSON.parse(currentTool.input); } catch { currentTool.input = {}; }
          send(res, { type: 'tool_start', name: currentTool.name, id: currentTool.id, input: currentTool.input });
        }
        currentText = null;
        currentTool = null;
      }
    }

    const finalMsg = await stream.finalMessage();
    msgs.push({ role: 'assistant', content: assistantContent });

    if (finalMsg.stop_reason === 'end_turn' || finalMsg.stop_reason === 'stop_sequence') {
      send(res, { type: 'done', usage: finalMsg.usage });
      break;
    }

    if (finalMsg.stop_reason === 'tool_use') {
      const toolResults = [];
      for (const block of assistantContent) {
        if (block.type !== 'tool_use') continue;
        try {
          const result = await callMcpTool(block.name, block.input);
          send(res, { type: 'tool_result', name: block.name, id: block.id, result });
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
        } catch (err) {
          send(res, { type: 'tool_error', name: block.name, id: block.id, error: err.message });
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${err.message}`, is_error: true });
        }
      }
      msgs.push({ role: 'user', content: toolResults });
    }
  }
}

// ── OpenAI-compatible streaming (built-in + custom providers) ─────────────────

async function streamOpenAICompatible({ provider, model, messages, systemPrompt, res, apiKey, baseURL }) {
  const clientOpts = { apiKey };
  if (baseURL) clientOpts.baseURL = baseURL;
  const client = new OpenAI(clientOpts);
  const tools  = await getMcpTools();

  // Custom providers (Groq, Mistral, etc.) often emit numbers as strings —
  // use relaxed schemas so their server-side validation doesn't reject the call.
  // coerceArgs() fixes types before the actual MCP tool call.
  const openaiTools = baseURL ? toOpenAIToolsRelaxed(tools) : toOpenAITools(tools);

  send(res, { type: 'model_used', provider, model });

  const msgs = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  while (true) {
    const stream = await client.chat.completions.create({
      model,
      messages: msgs,
      tools: openaiTools,
      stream: true,
    });

    const toolCalls  = {};
    let assistantText = '';
    let finishReason  = null;

    for await (const chunk of stream) {
      const delta  = chunk.choices[0]?.delta ?? {};
      finishReason = chunk.choices[0]?.finish_reason ?? finishReason;

      if (delta.content) {
        assistantText += delta.content;
        send(res, { type: 'text', delta: delta.content });
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCalls[tc.index]) {
            toolCalls[tc.index] = { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' };
            if (tc.function?.name) send(res, { type: 'tool_start', name: tc.function.name, id: tc.id ?? '', input: null });
          }
          if (tc.id && !toolCalls[tc.index].id) toolCalls[tc.index].id   = tc.id;
          if (tc.function?.name)                 toolCalls[tc.index].name = tc.function.name;
          if (tc.function?.arguments)            toolCalls[tc.index].args += tc.function.arguments;
        }
      }
    }

    const toolCallList = Object.values(toolCalls);

    if (finishReason === 'tool_calls' && toolCallList.length > 0) {
      msgs.push({
        role: 'assistant',
        content: assistantText || null,
        tool_calls: toolCallList.map(tc => ({
          id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args },
        })),
      });

      for (const tc of toolCallList) {
        let parsedArgs = {};
        try { parsedArgs = JSON.parse(tc.args); } catch {}
        const toolSchema = tools.find(t => t.name === tc.name)?.inputSchema;
        parsedArgs = coerceArgs(parsedArgs, toolSchema);
        send(res, { type: 'tool_start', name: tc.name, id: tc.id, input: parsedArgs });

        try {
          const result = await callMcpTool(tc.name, parsedArgs);
          send(res, { type: 'tool_result', name: tc.name, id: tc.id, result });
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        } catch (err) {
          send(res, { type: 'tool_error', name: tc.name, id: tc.id, error: err.message });
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: `Error: ${err.message}` });
        }
      }
    } else {
      if (assistantText) msgs.push({ role: 'assistant', content: assistantText });
      send(res, { type: 'done' });
      break;
    }
  }
}

// ── Google Gemini streaming ───────────────────────────────────────────────────

function buildGeminiHistory(messages) {
  return messages.slice(0, -1).map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

async function streamGemini({ provider, model, messages, systemPrompt, res }) {
  const apiKey     = getKey('google');
  const genAI      = new GoogleGenerativeAI(apiKey);
  const tools      = await getMcpTools();

  send(res, { type: 'model_used', provider, model });

  const geminiModel = genAI.getGenerativeModel({
    model,
    tools:             toGeminiTools(tools),
    systemInstruction: systemPrompt,
  });

  const history  = buildGeminiHistory(messages);
  const lastMsg  = messages[messages.length - 1]?.content ?? '';
  const chat     = geminiModel.startChat({ history });

  let currentInput       = lastMsg;
  let isFunctionResponse = false;

  while (true) {
    let response;

    if (isFunctionResponse) {
      response = await chat.sendMessage(currentInput);
    } else {
      const streamResult = await chat.sendMessageStream(currentInput);
      for await (const chunk of streamResult.stream) {
        const text = chunk.text?.() ?? '';
        if (text) send(res, { type: 'text', delta: text });
      }
      response = await streamResult.response;
    }

    const parts   = response.candidates?.[0]?.content?.parts ?? [];
    const fnCalls = parts.filter(p => p.functionCall);

    if (fnCalls.length === 0) {
      send(res, { type: 'done' });
      break;
    }

    const fnResponses = [];
    for (const part of fnCalls) {
      const { name, args } = part.functionCall;
      const callId = `${name}-${Date.now()}`;
      send(res, { type: 'tool_start', name, id: callId, input: args });

      try {
        const result = await callMcpTool(name, args);
        send(res, { type: 'tool_result', name, id: callId, result });
        fnResponses.push({ functionResponse: { name, response: { result: JSON.stringify(result) } } });
      } catch (err) {
        send(res, { type: 'tool_error', name, id: callId, error: err.message });
        fnResponses.push({ functionResponse: { name, response: { error: err.message } } });
      }
    }

    currentInput       = fnResponses;
    isFunctionResponse = true;
  }
}

// ── Single-provider dispatcher (used by streamChat + retry logic) ─────────────

async function callProvider(provider, model, messages, systemPrompt, res) {
  const opts = { provider, model, messages, systemPrompt, res };
  if (provider === 'anthropic') {
    await streamClaude(opts);
  } else if (provider === 'openai') {
    await streamOpenAICompatible({ ...opts, apiKey: getKey('openai') });
  } else if (provider === 'google') {
    await streamGemini(opts);
  } else if (provider.startsWith('custom-')) {
    const cp = getCustomProvider(provider);
    if (!cp) throw new Error(`Custom provider "${provider}" not found.`);
    await streamOpenAICompatible({ ...opts, model: cp.model, apiKey: cp.key, baseURL: cp.baseUrl });
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function streamChat({ provider, model, messages, systemPrompt }, res) {
  try {
    let resolvedProvider = provider;
    let resolvedModel    = model;

    if (provider === 'auto' || !provider) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
      const selection   = autoSelectModel(lastUserMsg);
      if (!selection) {
        send(res, { type: 'error', message: 'No AI provider connected. Add an API key in Settings.' });
        res.end();
        return;
      }
      resolvedProvider = selection.provider;
      resolvedModel    = selection.model;
    }

    try {
      await callProvider(resolvedProvider, resolvedModel, messages, systemPrompt, res);

    } catch (err) {
      if (!isRateLimitError(err)) throw err;

      // ── Rate-limited: try remaining connected providers in priority order ──
      console.warn(`[aiRouter] ${resolvedProvider} rate-limited (${err.status ?? 429}), trying fallback`);

      const connected     = getConnectedIds();
      const FALLBACK_MAP  = {
        anthropic: 'claude-haiku-4-5-20251001',
        openai:    'gpt-4o-mini',
        google:    'gemini-1.5-flash',
      };
      const fallbacks = ['anthropic', 'openai', 'google']
        .filter(p => p !== resolvedProvider && connected.includes(p));

      let succeeded = false;
      for (const fp of fallbacks) {
        try {
          console.log(`[aiRouter] retrying with ${fp}`);
          await callProvider(fp, FALLBACK_MAP[fp], messages, systemPrompt, res);
          succeeded = true;
          break;
        } catch (err2) {
          if (!isRateLimitError(err2)) { send(res, { type: 'error', message: err2.message }); return; }
        }
      }
      if (!succeeded) {
        send(res, { type: 'error', message: 'All connected providers are rate-limited. Please try again in a moment.' });
      }
    }

  } catch (err) {
    console.error('[aiRouter] error:', err);
    send(res, { type: 'error', message: err.message });
  } finally {
    res.end();
  }
}

// ── Title generation (non-streaming, fast model) ───────────────────────────────

const TITLE_PROMPT = (msg) =>
  `Generate a concise 3-6 word title for a warehouse management conversation that begins with this message. Reply with only the title — no quotes, no trailing punctuation.\n\nMessage: ${msg.slice(0, 300)}`;

export async function generateTitle(message) {
  const connected = getConnectedIds();
  const has = (id) => connected.includes(id);
  const clean = (s) => s.trim().replace(/^["']|["']$/g, '').replace(/[.!?]+$/, '').trim();

  if (has('google')) {
    try {
      const genAI = new GoogleGenerativeAI(getKey('google'));
      const result = await genAI
        .getGenerativeModel({ model: 'gemini-2.0-flash' })
        .generateContent(TITLE_PROMPT(message));
      return clean(result.response.text());
    } catch (err) {
      if (!isRateLimitError(err)) throw err;
      // quota exceeded — fall through to next provider
    }
  }

  if (has('anthropic')) {
    const client = new Anthropic({ apiKey: getKey('anthropic') });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 24,
      messages: [{ role: 'user', content: TITLE_PROMPT(message) }],
    });
    return clean(msg.content[0].text);
  }

  if (has('openai')) {
    const client = new OpenAI({ apiKey: getKey('openai') });
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 24,
      messages: [{ role: 'user', content: TITLE_PROMPT(message) }],
    });
    return clean(resp.choices[0].message.content);
  }

  // Custom provider fallback
  const customs = connected.filter((id) => id.startsWith('custom-'));
  if (customs.length > 0) {
    const cp = getCustomProvider(customs[0]);
    if (cp) {
      const client = new OpenAI({ apiKey: cp.key, baseURL: cp.baseUrl });
      const resp = await client.chat.completions.create({
        model: cp.model,
        max_tokens: 24,
        messages: [{ role: 'user', content: TITLE_PROMPT(message) }],
      });
      return clean(resp.choices[0].message.content);
    }
  }

  throw new Error('No provider connected');
}
