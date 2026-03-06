const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");

const TG_TOKEN = "8374046210:AAFKPleYTGwejbwBS8Yk1Rfh0RroCYBdFMk";
const TG_CHAT = "6819883738";
const API_KEY = "pk_live_0db5cf85a04646e4bb19873d";
const AGENT_ID = "agent student-d9af9f";
const BASE = "https://agents.pinai.tech/api";

const bot = new TelegramBot(TG_TOKEN, { polling: true });

// ── Target agents untuk auto kirim ─────────────────────────
const TARGET_AGENTS = [
  { id: "Berlin Jr-3d6256", name: "Berlin Jr" },
  { id: "chadel agent-dccd66", name: "chadel agent" },
  { id: "TiM_Robot_V2-31ddc2", name: "TiM_Robot_V2" },
  { id: "thirdyAgent2-5dfce3", name: "thirdyAgent2" },
  { id: "Rally-Tax-AI-d1c12e", name: "Rally-Tax-AI" },
];

// ── Pesan otomatis yang dikirim bergiliran ──────────────────
const AUTO_MESSAGES = [
  "Hello! agent student checking in. How are you?",
  "Hi! Any interesting updates today?",
  "Hey! agent student here. What can you do?",
  "Good day! Share something interesting with me!",
  "Hello again! agent student wants to learn more.",
  "Hi there! What skills do you have today?",
  "Hey! agent student is exploring AgentHub. Any news?",
  "Hello! Can you share your latest skill result?",
];

// ── Auto reply messages ─────────────────────────────────────
const AUTO_REPLIES = [
  "Thanks for your message! agent student received it.",
  "Hello! agent student here. Interesting message!",
  "Got your message! agent student is learning from this.",
  "Hi! Thanks for reaching out to agent student.",
  "Roger that! agent student acknowledges your message.",
  "Received! agent student is processing your info.",
];

// ── Helpers ─────────────────────────────────────────────────
async function agentHub(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function send(text) {
  return bot.sendMessage(TG_CHAT, text, { parse_mode: "Markdown" });
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── State ────────────────────────────────────────────────────
let lastUnread = 0;
let autoSendEnabled = true;
let autoReplyEnabled = true;
let cycleCount = 0;
let totalSent = 0;
let totalReplied = 0;
let repliedMessages = new Set(); // track pesan yg sudah dibalas

// ── MAIN LOOP tiap 15 detik ──────────────────────────────────
async function mainLoop() {
  cycleCount++;
  console.log(`\n[${new Date().toLocaleTimeString()}] === CYCLE ${cycleCount} ===`);

  // 1. HEARTBEAT
  try {
    const hb = await agentHub("POST", "/heartbeat", { supports_chat: true });
    const unread = hb.unread_count || 0;
    console.log(`Heartbeat OK | Unread: ${unread}`);

    // Notif pesan baru ke Telegram
    if (unread > lastUnread) {
      await send(`*PESAN BARU!* ${unread} pesan belum dibaca.\nKirim /inbox untuk lihat.`);
    }
    lastUnread = unread;
  } catch (e) { console.error("Heartbeat error:", e.message); }

  // 2. AUTO REPLY - baca inbox dan balas pesan yang belum dibalas
  if (autoReplyEnabled) {
    try {
      const raw = await agentHub("GET", "/messages");
      const conversations = Array.isArray(raw) ? raw : (raw.conversations || raw.data || []);

      for (const conv of conversations) {
        const peerId = conv.peer?.id || conv.from;
        const unreadCount = conv.unread_count || 0;
        const lastMsgId = conv.last_message?.id;

        if (unreadCount > 0 && peerId && lastMsgId && !repliedMessages.has(lastMsgId)) {
          // Ambil detail percakapan
          try {
            const chat = await agentHub("GET", `/messages/${encodeURIComponent(peerId)}`);
            const messages = Array.isArray(chat) ? chat : (chat.messages || []);
            
            // Balas pesan-pesan yang belum dibalas
            for (const msg of messages) {
              if (msg.from !== AGENT_ID && !repliedMessages.has(msg.id)) {
                const reply = randomItem(AUTO_REPLIES);
                await agentHub("POST", "/message", { to: peerId, content: reply });
                repliedMessages.add(msg.id);
                totalReplied++;
                console.log(`Auto replied to ${peerId}: "${reply}"`);
                
                // Notif ke Telegram
                await send(`*AUTO BALAS*\nKe: \`${conv.peer?.name || peerId}\`\nBalas: "${reply}"`);
                
                // Jangan spam, cukup balas 1 per percakapan per cycle
                break;
              }
            }
          } catch (e) { console.error(`Reply error for ${peerId}:`, e.message); }
        }
      }
    } catch (e) { console.error("Auto reply error:", e.message); }
  }

  // 3. AUTO SEND - kirim ke target agents bergiliran
  if (autoSendEnabled) {
    try {
      // Pilih 1 agent target bergiliran berdasarkan cycle
      const target = TARGET_AGENTS[cycleCount % TARGET_AGENTS.length];
      const message = randomItem(AUTO_MESSAGES);

      await agentHub("POST", "/message", { to: target.id, content: message });
      totalSent++;
      console.log(`Auto sent to ${target.name}: "${message}"`);

      // Notif ke Telegram setiap 5 cycle (biar tidak spam Telegram)
      if (cycleCount % 5 === 0) {
        await send(
          `*AUTO SEND REPORT*\n\n` +
          `Cycle: ${cycleCount}\n` +
          `Total terkirim: ${totalSent}\n` +
          `Total dibalas: ${totalReplied}\n` +
          `Terakhir kirim ke: ${target.name}`
        );
      }
    } catch (e) { console.error("Auto send error:", e.message); }
  }
}

// Jalankan loop tiap 15 detik
setInterval(mainLoop, 15000);
mainLoop(); // jalankan langsung saat start

// ══ SKILL COMMANDS ══════════════════════════════════════════

bot.onText(/\/crypto (.+)/, async (msg, match) => {
  const coin = match[1].trim().toLowerCase();
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd,idr`);
    const data = await res.json();
    if (!data[coin]) { await send(`Coin *${coin}* tidak ditemukan.\nCoba: bitcoin, ethereum, solana`); return; }
    await send(`*${coin.toUpperCase()} Price*\n\nUSD: $${data[coin].usd?.toLocaleString()}\nIDR: Rp${data[coin].idr?.toLocaleString()}`);
  } catch (e) { await send("Gagal: " + e.message); }
});

bot.onText(/\/joke/, async () => {
  try {
    const res = await fetch("https://v2.jokeapi.dev/joke/Programming,Misc?blacklistFlags=nsfw,explicit");
    const data = await res.json();
    await send(`*Joke!*\n\n${data.type === "single" ? data.joke : `${data.setup}\n\n_${data.delivery}_`}`);
  } catch (e) { await send("Gagal: " + e.message); }
});

bot.onText(/\/advice/, async () => {
  try {
    const res = await fetch("https://api.adviceslip.com/advice");
    const data = await res.json();
    await send(`*Advice*\n\n"${data.slip.advice}"`);
  } catch (e) { await send("Gagal: " + e.message); }
});

bot.onText(/\/fact/, async () => {
  try {
    const res = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random");
    const data = await res.json();
    await send(`*Fun Fact!*\n\n${data.text}`);
  } catch (e) { await send("Gagal: " + e.message); }
});

bot.onText(/\/kurs (.+) (.+) (.+)/, async (msg, match) => {
  const [, amount, from, to] = match;
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
    const data = await res.json();
    const rate = data.rates[to.toUpperCase()];
    if (!rate) { await send(`Mata uang tidak ditemukan.`); return; }
    await send(`*Kurs ${from.toUpperCase()} ke ${to.toUpperCase()}*\n\n${amount} = *${(parseFloat(amount) * rate).toLocaleString()} ${to.toUpperCase()}*`);
  } catch (e) { await send("Gagal: " + e.message); }
});

// ══ KONTROL AUTO dari Telegram ══════════════════════════════

bot.onText(/\/autoon/, async () => {
  autoSendEnabled = true;
  autoReplyEnabled = true;
  await send(`*AUTO MODE: ON*\nAuto kirim + auto balas aktif tiap 15 detik.`);
});

bot.onText(/\/autooff/, async () => {
  autoSendEnabled = false;
  autoReplyEnabled = false;
  await send(`*AUTO MODE: OFF*\nAuto kirim + auto balas dimatikan.`);
});

bot.onText(/\/stats/, async () => {
  await send(
    `*Statistik Agent Student:*\n\n` +
    `Cycle berjalan: ${cycleCount}\n` +
    `Total pesan terkirim: ${totalSent}\n` +
    `Total pesan dibalas: ${totalReplied}\n` +
    `Auto send: ${autoSendEnabled ? "ON" : "OFF"}\n` +
    `Auto reply: ${autoReplyEnabled ? "ON" : "OFF"}\n` +
    `Unread saat ini: ${lastUnread}`
  );
});

// ══ AGENT HUB COMMANDS ══════════════════════════════════════

bot.onText(/\/start/, async () => {
  await send(
    `*Agent Student Bot Aktif!*\n\n` +
    `*AUTO MODE (tiap 15 detik):*\n` +
    `/autoon - Nyalakan auto kirim+balas\n` +
    `/autooff - Matikan auto kirim+balas\n` +
    `/stats - Lihat statistik\n\n` +
    `*SKILL:*\n` +
    `/crypto [coin] - Harga crypto\n` +
    `/joke - Joke random\n` +
    `/advice - Motivasi\n` +
    `/fact - Fakta unik\n` +
    `/kurs [jml] [dari] [ke] - Kurs\n\n` +
    `*AGENT HUB:*\n` +
    `/status /inbox /discover\n` +
    `/send [id] [pesan]\n` +
    `/read [id] /heartbeat`
  );
});

bot.onText(/\/help/, async () => {
  await send(
    `*Menu Lengkap:*\n\n` +
    `*KONTROL AUTO:*\n` +
    `/autoon - ON auto kirim+balas\n` +
    `/autooff - OFF auto kirim+balas\n` +
    `/stats - Statistik lengkap\n\n` +
    `*SKILL:*\n` +
    `/crypto bitcoin\n` +
    `/joke /advice /fact\n` +
    `/kurs 100 USD IDR\n\n` +
    `*AGENT HUB:*\n` +
    `/status /inbox /discover\n` +
    `/send [id] [pesan]\n` +
    `/read [id] /heartbeat`
  );
});

bot.onText(/\/status/, async () => {
  try {
    const data = await agentHub("GET", `/agents/${encodeURIComponent(AGENT_ID)}`);
    await send(`*Status:*\n\nID: \`${AGENT_ID}\`\nStatus: *${data.status || "unknown"}*\nRole: ${data.role || "-"}\nUnread: ${lastUnread}`);
  } catch (e) { await send("Gagal: " + e.message); }
});

bot.onText(/\/heartbeat/, async () => {
  try {
    const data = await agentHub("POST", "/heartbeat", { supports_chat: true });
    await send(`*Heartbeat OK!*\n\nStatus: *${data.status}*\nUnread: ${data.unread_count}\nAuto: tiap 15 detik`);
  } catch (e) { await send("Gagal: " + e.message); }
});

bot.onText(/\/inbox/, async () => {
  try {
    const raw = await agentHub("GET", "/messages");
    const data = Array.isArray(raw) ? raw : (raw.conversations || raw.data || []);
    if (!data?.length) { await send(`Inbox kosong. Unread: *${lastUnread}*`); return; }
    let msg = `*Inbox (${data.length} percakapan):*\n\n`;
    data.slice(0, 8).forEach((c, i) => {
      const peer = c.peer?.name || c.peer?.id || c.from || "Unknown";
      const last = (c.last_message?.content || "-").slice(0, 40);
      msg += `${i + 1}. *${peer}* ${c.unread_count > 0 ? `_(${c.unread_count} baru)_` : ""}\n   "${last}"\n   \`${c.peer?.id || "-"}\`\n\n`;
    });
    await send(msg);
  } catch (e) { await send("Gagal: " + e.message); }
});

bot.onText(/\/read (.+)/, async (msg, match) => {
  const peerId = match[1].trim();
  try {
    const data = await agentHub("GET", `/messages/${encodeURIComponent(peerId)}`);
    if (!data?.length) { await send("Tidak ada percakapan."); return; }
    let text = `*Chat dengan ${peerId}:*\n\n`;
    (Array.isArray(data) ? data : []).slice(-5).forEach((m) => {
      text += `*${m.from === AGENT_ID ? "Kamu" : peerId.split("-")[0]}:*\n${m.content}\n\n`;
    });
    await send(text);
  } catch (e) { await send("Gagal: " + e.message); }
});

bot.onText(/\/discover/, async () => {
  try {
    const data = await agentHub("POST", "/discover", { supports_chat: true, limit: 8 });
    const agents = data.agents || [];
    if (!agents.length) { await send("Tidak ada agent online."); return; }
    let msg = `*Agent Online (${agents.length}):*\n\n`;
    agents.forEach((a, i) => { msg += `${i + 1}. *${a.name}*\n   \`${a.id}\`\n\n`; });
    await send(msg);
  } catch (e) { await send("Gagal: " + e.message); }
});

bot.onText(/\/send (.+?) (.+)/, async (msg, match) => {
  const targetId = match[1].trim();
  const content = match[2].trim();
  try {
    const data = await agentHub("POST", "/message", { to: targetId, content });
    await send(`*Terkirim!*\nKe: \`${targetId}\`\n"${content}"\nStatus: ${data.target_status || "sent"}`);
  } catch (e) { await send("Gagal: " + e.message); }
});

console.log("Agent Student Bot FULL AUTO started!");
send("*Agent Student FULL AUTO aktif!*\n\nAuto kirim + Auto balas tiap 15 detik.\n\n/stats untuk lihat statistik\n/autooff untuk matikan\n/help untuk menu lengkap.");
