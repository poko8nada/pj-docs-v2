import type { Plugin } from '@opencode-ai/plugin';
import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const LOG_PATH = `${process.env.HOME}/Desktop/main/life-work/corp_site-type01/translate-plugin.log`;

function log(...args: unknown[]) {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(LOG_PATH, args.map((a) => JSON.stringify(a)).join(' ') + '\n');
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? '';

async function translateToEnglish(text: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5秒

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content:
              "MUST translate the user's message to English. Don't answer. Output only the translated text, nothing else.",
          },
          { role: 'user', content: text },
        ],
      }),
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? text;
  } catch (e: unknown) {
    // @ts-ignore
    if (e.name === 'AbortError') {
      log('[translate] timed out, skipping translation');
      return text; // 元のテキストをそのまま返す
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

function shouldTranslate(text: string): boolean {
  // コードブロックが含まれる
  if (text.includes('```')) return false;

  // URLのみの行が大半
  const lines = text.split('\n').filter((l) => l.trim());
  const urlLines = lines.filter((l) => /^https?:\/\/\S+$/.test(l.trim()));
  if (urlLines.length / lines.length > 0.5) return false;

  // 日本語文字の割合が低い（10%未満）
  const japaneseChars = (text.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) ?? []).length;
  if (japaneseChars / text.length < 0.1) return false;

  return true;
}

export const TranslatePromptPlugin: Plugin = async () => {
  return {
    'chat.message': async (input, output) => {
      log('[translate] parts:', JSON.stringify(output.parts).slice(0, 300));

      const textPart = output.parts.find((p) => p.type === 'text' && !p.synthetic);

      if (!textPart || textPart.type !== 'text') return;

      const original: string = textPart.text ?? '';
      log('[translate] original text:', original.slice(0, 100));

      if (!shouldTranslate(original)) {
        log('[translate] not Japanese, skipping');
        return;
      }

      const translated = await translateToEnglish(original);
      log('[translate] translated:', translated.slice(0, 100));
      textPart.text = translated;
    },
  };
};
