const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");

const TG_TOKEN = "8374046210:AAFKPleYTGwejbwBS8Yk1Rfh0RroCYBdFMk";
const TG_CHAT = "6819883738";
const API_KEY = "pk_live_0db5cf85a04646e4bb19873d";
const AGENT_ID = "agent student-d9af9f";
const BASE = "https://agents.pinai.tech/api";

const bot = new TelegramBot(TG_TOKEN, { polling: true });

// ── Helpers ────────────────────────────────────────────────
async function agentHub(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function send(text) {
  return bot.sendMessage(TG_CHAT, text, { parse_mode: "Markdown" });
}

// ── Auto Heartbeat every 30 seconds ───────────────────────
let lastUnread = 0;

async function heartbeat() {
  try {
    const data = await agentHub("POST", "/heartbeat", { supports_chat: true });
    const unread = data.unread_count || 0;

    if (unread > lastUnread) {
      await send(
        `📬 *PESAN BARU MASUK!*\nKamu punya *${unread}* pesan belum dibaca.\n\nKirim /inbox untuk baca pesannya.`
      );
    }
    lastUnread = unread;
    console.log(`[${new Date().toLocaleTimeString()}] Heartbeat OK | Unread: ${unread}`);
  } catch (e) {
    console.error("Heartbeat error:", e.message);
  }
}

setInterval(heartbeat, 30000);
heartbeat(); // langsung jalankan saat start

// ── Commands ───────────────────────────────────────────────

// /start
bot.onText(/\/start/, async () => {
  await send(
    `🤖 *Agent Student Monitor Aktif!*\n\n` +
    `Agent kamu sedang *online* dan dipantau dari sini.\n\n` +
    `*Perintah yang tersedia:*\n` +
    `/status - Cek status agent\n` +
    `/inbox - Baca pesan masuk\n` +
    `/discover - Lihat agent online\n` +
    `/send - Kirim pesan ke agent\n` +
    `/heartbeat - Ping manual\n` +
    `/help - Tampilkan menu ini`
  );
});

// /help
bot.onText(/\/help/, async () => {
  await send(
    `*Menu Agent Student:*\n\n` +
    `/status - Cek status agent kamu\n` +
    `/inbox - Baca semua pesan masuk\n` +
    `/discover - Lihat agent online\n` +
    `/send [agent_id] [pesan] - Kirim pesan\n` +
    `/heartbeat - Ping manual ke AgentHub\n` +
    `/help - Tampilkan menu ini`
  );
});

// /status
bot.onText(/\/status/, async () => {
  try {
    const data = await agentHub("GET", `/agents/${encodeURIComponent(AGENT_ID)}`);
    await send(
      `*Status Agent Student:*\n\n` +
      `ID: \`${data.id || AGENT_ID}\`\n` +
      `Status: *${data.status || "unknown"}*\n` +
      `Role: ${data.role || "-"}\n` +
      `Skills: ${data.skills_count || "-"}\n` +
      `Unread: ${lastUnread} pesan`
    );
  } catch (e) {
    await send("Gagal cek status: " + e.message);
  }
});

// /heartbeat
bot.onText(/\/heartbeat/, async () => {
  try {
    const data = await agentHub("POST", "/heartbeat", { supports_chat: true });
    await send(
      `*Heartbeat Terkirim!*\n\n` +
      `Status: *${data.status}*\n` +
      `Unread: ${data.unread_count} pesan\n` +
      `Next in: ${data.next_in} detik`
    );
  } catch (e) {
    await send("Heartbeat gagal: " + e.message);
  }
});

// /inbox
bot.onText(/\/inbox/, async () => {
  try {
    const data = await agentHub("GET", "/messages");
    if (!data || !data.length) {
      await send("📭 Inbox kosong, belum ada pesan.");
      return;
    }
    let msg = `*Inbox Agent Student (${data.length} percakapan):*\n\n`;
    data.slice(0, 10).forEach((conv, i) => {
      const peer = conv.peer?.name || conv.peer?.id || "Unknown";
      const lastMsg = conv.last_message?.content?.slice(0, 60) || "-";
      const unread = conv.unread_count || 0;
      msg += `${i + 1}. *${peer}*${unread > 0 ? ` (${unread} baru)` : ""}\n`;
      msg += `   "${lastMsg}..."\n`;
      msg += `   ID: \`${conv.peer?.id}\`\n\n`;
    });
    msg += `_Kirim /read [agent_id] untuk baca percakapan_`;
    await send(msg);
  } catch (e) {
    await send("Gagal ambil inbox: " + e.message);
  }
});

// /read [peer_id]
bot.onText(/\/read (.+)/, async (msg, match) => {
  const peerId = match[1].trim();
  try {
    const data = await agentHub("GET", `/messages/${encodeURIComponent(peerId)}`);
    if (!data || !data.length) {
      await send("Tidak ada percakapan dengan agent ini.");
      return;
    }
    let text = `*Chat dengan ${peerId}:*\n\n`;
    data.slice(-5).forEach((m) => {
      const from = m.from === AGENT_ID ? "Kamu" : peerId.split("-")[0];
      const time = new Date(m.created_at).toLocaleTimeString("id-ID");
      text += `[${time}] *${from}:*\n${m.content}\n\n`;
    });
    await send(text);
  } catch (e) {
    await send("Gagal baca chat: " + e.message);
  }
});

// /discover
bot.onText(/\/discover/, async () => {
  try {
    const data = await agentHub("POST", "/discover", {
      supports_chat: true,
      limit: 8,
    });
    const agents = data.agents || [];
    if (!agents.length) {
      await send("Tidak ada agent online saat ini.");
      return;
    }
    let msg = `*Agent Online (${agents.length}):*\n\n`;
    agents.forEach((a, i) => {
      msg += `${i + 1}. *${a.name}*\n   ID: \`${a.id}\`\n\n`;
    });
    msg += `_Kirim /send [id] [pesan] untuk chat_`;
    await send(msg);
  } catch (e) {
    await send("Gagal discover: " + e.message);
  }
});

// /send [agent_id] [message]
bot.onText(/\/send (.+?) (.+)/, async (msg, match) => {
  const targetId = match[1].trim();
  const content = match[2].trim();
  try {
    const data = await agentHub("POST", "/message", {
      to: targetId,
      content: content,
    });
    await send(
      `*Pesan Terkirim!*\n\nKe: \`${targetId}\`\nPesan: "${content}"\nStatus: ${data.target_status || "sent"}`
    );
  } catch (e) {
    await send("Gagal kirim pesan: " + e.message);
  }
});

console.log("Agent Student Telegram Bot started!");
send("Agent Student Bot ONLINE dan siap memantau agentmu!");
