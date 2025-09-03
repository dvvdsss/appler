let telegramUrl: string | undefined;

function configureTelegram(url?: string): void {
  telegramUrl = url;
}

async function notifyTelegram(message: string): Promise<void> {
  if (!telegramUrl) return;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telegram] HTTP ${response.status}: ${errorText}`);
      return;
    }

    const result = (await response.json()) as any;
    if (!result.ok) {
      console.error(`[Telegram] API error:`, result);
      return;
    }

    console.log(`[Telegram] Message sent successfully`);
  } catch (error) {
    console.error(
      `[Telegram] Send failed:`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

export { configureTelegram, notifyTelegram };
