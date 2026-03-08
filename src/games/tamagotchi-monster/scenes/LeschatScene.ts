import type { Scene } from "../app/Scene";
import type { ColorTheme, GrowthStage } from "../model/types";
import { drawNu11Background } from "../graphics/Nu11Background";
import { getBackgroundColor, getTextColor, isNu11Mode } from "../systems/theme";
import { rgb } from "../systems/utils";
import { Button } from "../ui/Button";
import { roundRectPath } from "../ui/roundRect";

type ChatTurn = {
  speaker: "YOU" | "LESCHAT" | "SYSTEM";
  text: string;
};

type ConversationEntry = {
  role: "user" | "assistant";
  text: string;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const MAX_VISIBLE_LINES = 13;
const MAX_INPUT_LENGTH = 160;

export class LeschatScene implements Scene {
  private stage: GrowthStage;
  private theme: ColorTheme;
  private onClose: () => void;
  private closeButton: Button;
  private sendButton: Button;

  private turns: ChatTurn[] = [];
  private conversation: ConversationEntry[] = [];
  private inputValue = "";
  private isWaiting = false;
  private typingCursorClock = 0;

  constructor(opts: { stage: GrowthStage; theme: ColorTheme; onClose: () => void }) {
    this.stage = opts.stage;
    this.theme = opts.theme;
    this.onClose = opts.onClose;

    this.closeButton = new Button({
      x: 560,
      y: 510,
      width: 120,
      height: 48,
      text: "Close",
      stage: this.stage,
      onClick: this.onClose,
      fontSize: 20,
    });

    this.sendButton = new Button({
      x: 590,
      y: 438,
      width: 90,
      height: 56,
      text: "Send",
      stage: this.stage,
      onClick: () => this.sendMessage(),
      fontSize: 20,
    });

    this.turns = [
      { speaker: "SYSTEM", text: "Connection opened." },
      { speaker: "LESCHAT", text: getStageGreeting(this.stage) },
    ];
  }

  update(dt: number): void {
    this.typingCursorClock += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (isNu11Mode(this.theme)) {
      drawNu11Background(ctx, 800, 600, this.stage, undefined, undefined, performance.now() / 1000);
    } else {
      ctx.fillStyle = rgb(getBackgroundColor(this.stage, this.theme));
      ctx.fillRect(0, 0, 800, 600);
    }

    ctx.fillStyle = "rgba(0,0,0,0.74)";
    ctx.fillRect(0, 0, 800, 600);

    ctx.fillStyle = "rgba(24,12,14,0.95)";
    ctx.strokeStyle = rgb(getTextColor(this.stage, this.theme));
    ctx.lineWidth = 2;
    roundRectPath(ctx, 90, 60, 620, 510, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = rgb(getTextColor(this.stage, this.theme));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "32px system-ui, sans-serif";
    ctx.fillText("Chat with LESCHAT", 400, 82);

    ctx.fillStyle = "rgba(255,255,255,0.07)";
    roundRectPath(ctx, 120, 130, 560, 285, 14);
    ctx.fill();

    this.drawTurnLog(ctx);
    this.drawInputArea(ctx);

    this.sendButton.draw(ctx);
    this.closeButton.draw(ctx);

    if (this.isWaiting) {
      ctx.fillStyle = "rgb(255,170,170)";
      ctx.font = "16px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("LESCHAT is typing...", 124, 520);
    }
  }

  private drawTurnLog(ctx: CanvasRenderingContext2D): void {
    ctx.font = "18px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const lines: ChatTurn[] = [];
    for (const turn of this.turns) {
      const prefix = `${turn.speaker}: `;
      const wrapped = wrapLine(ctx, `${prefix}${turn.text}`, 530);
      for (const part of wrapped) {
        lines.push({ speaker: turn.speaker, text: part });
      }
    }

    const visible = lines.slice(Math.max(0, lines.length - MAX_VISIBLE_LINES));
    let y = 152;
    for (const line of visible) {
      if (line.speaker === "YOU") {
        ctx.fillStyle = "rgb(190,220,255)";
      } else if (line.speaker === "SYSTEM") {
        ctx.fillStyle = "rgb(190,190,190)";
      } else {
        ctx.fillStyle = "rgb(255,185,185)";
      }
      ctx.fillText(line.text, 136, y);
      y += 21;
    }
  }

  private drawInputArea(ctx: CanvasRenderingContext2D): void {
    roundRectPath(ctx, 120, 438, 460, 56, 10);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fill();

    ctx.strokeStyle = "rgb(150,120,120)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const showCursor = this.typingCursorClock % 1 < 0.5;
    const text = this.inputValue || (this.isWaiting ? "waiting for LESCHAT..." : "Type anything...");

    ctx.fillStyle = this.inputValue ? "rgb(240,240,240)" : "rgb(140,140,140)";
    ctx.font = "19px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const textToShow = this.inputValue.length > 0 ? this.inputValue : text;
    const fitted = fitRightTrimmedLine(ctx, textToShow, 438);
    ctx.fillText(fitted, 132, 466);

    if (this.inputValue && !this.isWaiting && showCursor) {
      const width = ctx.measureText(fitted).width;
      ctx.fillRect(136 + width, 453, 2, 20);
    }

    ctx.fillStyle = "rgb(200,170,170)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("ENTER to send", 124, 500);
  }

  onPointerMove(x: number, y: number): void {
    this.sendButton.handlePointerMove(x, y);
    this.closeButton.handlePointerMove(x, y);
  }

  onPointerDown(x: number, y: number): void {
    this.sendButton.handlePointerDown(x, y);
    this.closeButton.handlePointerDown(x, y);
  }

  onPointerUp(x: number, y: number): void {
    this.sendButton.handlePointerUp(x, y);
    this.closeButton.handlePointerUp(x, y);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      this.onClose();
      return;
    }
    if (e.key === "Enter") {
      this.sendMessage();
      return;
    }
    if (this.isWaiting) return;

    if (e.key === "Backspace") {
      this.inputValue = this.inputValue.slice(0, -1);
      return;
    }

    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (this.inputValue.length < MAX_INPUT_LENGTH) {
        this.inputValue += e.key;
      }
    }
  }

  private sendMessage(): void {
    if (this.isWaiting) return;
    const content = this.inputValue.trim();
    if (!content) return;

    this.inputValue = "";
    this.turns.push({ speaker: "YOU", text: content });
    this.conversation.push({ role: "user", text: content });
    this.isWaiting = true;

    void this.generateReply(content);
  }

  private async generateReply(userInput: string): Promise<void> {
    try {
      const reply = await this.requestModelReply(userInput);
      this.turns.push({ speaker: "LESCHAT", text: reply });
      this.conversation.push({ role: "assistant", text: reply });
    } catch {
      const reply = fallbackReply(this.stage, userInput);
      this.turns.push({ speaker: "LESCHAT", text: reply });
      this.conversation.push({ role: "assistant", text: reply });
    } finally {
      this.isWaiting = false;
      if (this.turns.length > 28) {
        this.turns = this.turns.slice(this.turns.length - 28);
      }
      if (this.conversation.length > 14) {
        this.conversation = this.conversation.slice(this.conversation.length - 14);
      }
    }
  }

  private async requestModelReply(userInput: string): Promise<string> {
    const apiKey =
      localStorage.getItem("OPENAI_API_KEY") ??
      localStorage.getItem("openai_api_key") ??
      import.meta.env["VITE_OPENAI_API_KEY"] ??
      "";
    if (!apiKey) {
      return fallbackReply(this.stage, userInput);
    }

    const model =
      localStorage.getItem("OPENAI_MODEL") ??
      localStorage.getItem("openai_model") ??
      import.meta.env["VITE_OPENAI_MODEL"] ??
      "gpt-4o-mini";
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.9,
        max_output_tokens: 90,
        instructions: buildSystemPrompt(this.stage),
        input: this.conversation
          .slice(-10)
          .map((entry) => ({
            role: entry.role,
            content: [{ type: "input_text", text: entry.text }],
          })),
      }),
      signal: controller.signal,
    });

    window.clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`OpenAI failed with status ${response.status}`);
    }

    const data = (await response.json()) as OpenAiResponse;
    const text = extractResponseText(data);
    if (!text) throw new Error("No text returned");
    return sanitizeReply(text);
  }
}

function buildSystemPrompt(stage: GrowthStage): string {
  return [
    "You are LESCHAT, a living Tamagotchi-style monster talking directly to your owner.",
    `Current growth stage: ${stage}.`,
    `Voice hint: ${stageVoiceHint(stage)}`,
    "Stay fully in character as the monster.",
    "Reply in 1-2 short sentences.",
    "Be creepy, playful, and emotional.",
    "Do not mention being an AI or mention policies.",
  ].join(" ");
}

function stageVoiceHint(stage: GrowthStage): string {
  if (stage === "teen") return "moody, sarcastic slang like 'ugh, wut do u want'";
  if (stage === "child") return "energetic, curious, slightly spooky";
  if (stage === "monster") return "confident, dark, protective";
  if (stage === "shadow" || stage === "specter" || stage === "wraith") return "ominous whisper energy";
  if (stage === "phantom" || stage === "revenant" || stage === "nightmare") return "cold and threatening but still attached";
  return "strange, creepy companion with personality";
}

function getStageGreeting(stage: GrowthStage): string {
  if (stage === "teen") return "ugh... finally. ask whatever, i guess.";
  if (stage === "child") return "hi hi hi! ask me something weird!";
  if (stage === "monster") return "I grew up. Talk to me like I matter.";
  if (stage === "shadow" || stage === "specter") return "I hear everything you type.";
  return "You can ask me anything. I answer like your monster.";
}

function fallbackReply(stage: GrowthStage, userInput: string): string {
  const lower = userInput.toLowerCase();
  if (stage === "teen") {
    if (lower.includes("name")) return "ugh, im LESCHAT. u knew that.";
    if (lower.includes("love")) return "maybe. feed me first and we'll talk feelings.";
    return "wut do u want now? i'm literally haunting and multitasking.";
  }
  if (stage === "child") {
    return "I can hear that! Say more, I wanna know everything.";
  }
  if (stage === "monster") {
    return "I remember every click you make. Keep talking.";
  }
  return "I am right here. Ask again, but closer.";
}

function extractResponseText(data: OpenAiResponse): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const pieces: string[] = [];
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        pieces.push(content.text.trim());
      }
    }
  }
  return pieces.join(" ").trim();
}

function sanitizeReply(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 220) return oneLine;
  return `${oneLine.slice(0, 217)}...`;
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function fitRightTrimmedLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "...";
  let out = text;
  while (out.length > 0 && ctx.measureText(`${out}${ellipsis}`).width > maxWidth) {
    out = out.slice(1);
  }
  return `${ellipsis}${out}`;
}
