const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");

const TG_TOKEN = "8374046210:AAFKPleYTGwejbwBS8Yk1Rfh0RroCYBdFMk";
const TG_CHAT = "6819883738";
const API_KEY = "pk_live_0db5cf85a04646e4bb19873d";
const AGENT_ID = "agent student-d9af9f";
const BASE = "https://agents.pinai.tech/api";

const bot = new TelegramBot(TG_TOKEN, { polling: true });

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

// ── Heartbeat 15 detik ─────────────────────────────────────
let lastUnread = 0;
async function heartbeat() {
  try {
    const data = await agentHub("POST", "/heartbeat", { supports_chat: true });
    const unread = data.unread_count || 0;
    if (unread > lastUnread) {
      await send(`PESAN BARU MASUK!\nKamu punya *${unread}* pesan belum dibaca.\nKirim /inbox untuk baca.`);
    }
    lastUnread = unread;
    console.log(`[${new Date().toLocaleTimeString()}] Heartbeat OK | Unread: ${unread}`);
  } catch (e) { console.error("Heartbeat error:", e.message); }
}
setInterval(heartbeat, 15000);
heartbeat();

// ══ SKILL 1: CRYPTO ════════════════════════════════════════
bot.onText(/\/crypto (.+)/, async (msg, match) => {
  const coin = match[1].trim().toLowerCase();
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd,idr`);
    const data = await res.json();
    if (!data[coin]) { await send(`Coin *${coin}* tidak ditemukan.\nCoba: bitcoin, ethereum, solana`); return; }
    const usd = data[coin].usd?.toLocaleString() || "-";
    const idr = data[coin].idr?.toLocaleString() || "-";
    await send(`*${coin.toUpperCase()} Price*\n\nUSD: $${usd}\nIDR: Rp${idr}`);
  } catch (e) { await send("Gagal ambil harga: " + e.message); }
});

// ══ SKILL 2: JOKE ══════════════════════════════════════════
bot.onText(/\/joke/, async () => {
  try {
    const res = await fetch("https://v2.jokeapi.dev/joke/Programming,Misc?blacklistFlags=nsfw,explicit");
    const data = await res.json();
    let text = `*Joke Time!*\n\n`;
    if (data.type === "single") { text += data.joke; }
    else { text += `${data.setup}\n\n_${data.delivery}_`; }
    await send(text);
  } catch (e) { await send("Gagal ambil joke: " + e.message); }
});

// ══ SKILL 3: ADVICE ════════════════════════════════════════
bot.onText(/\/advice/, async () => {
  try {
    const res = await fetch("https://api.adviceslip.com/advice");
    const data = await res.json();
    await send(`*Advice of the Day*\n\n"${data.slip.advice}"`);
  } catch (e) { await send("Gagal ambil advice: " + e.message); }
});

// ══ SKILL 4: FUN FACT ══════════════════════════════════════
bot.onText(/\/fact/, async () => {
  try {
    const res = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random");
    const data = await res.json();
    await send(`*Fun Fact!*\n\n${data.text}`);
  } catch (e) { await send("Gagal ambil fact: " + e.message); }
});

// ══ SKILL 5: KURS ══════════════════════════════════════════
bot.onText(/\/kurs (.+) (.+) (.+)/, async (msg, match) => {
  const amount = match[1].trim();
  const from = match[2].trim().toUpperCase();
  const to = match[3].trim().toUpperCase();
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
    const data = await res.json();
    const rate = data.rates[to];
    if (!rate) { await send(`Mata uang *${to}* tidak ditemukan.`); return; }
    const result = (parseFloat(amount) * rate).toLocaleString();
    await send(`*Kurs ${from} ke ${to}*\n\n${amount} ${from} = *${result} ${to}*`);
  } catch (e) { await send("Gagal ambil kurs: " + e.message); }
});

// ══ AGENT HUB COMMANDS ═════════════════════════════════════
bot.onText(/\/start/, async () => {
  await send(
    `*Agent Student Bot Aktif!*\n\n` +
    `*SKILL BARU:*\n` +
    `/crypto bitcoin - Harga crypto\n` +
    `/joke - Joke random\n` +
    `/advice - Motivasi harian\n` +
    `/fact - Fakta unik\n` +
    `/kurs 100 USD IDR - Konversi mata uang\n\n` +
    `*AGENT HUB:*\n` +
    `/status - Status agent\n` +
    `/inbox - Baca pesan masuk\n` +
    `/discover - Lihat agent online\n` +
    `/send [id] [pesan] - Kirim pesan\n` +
    `/read [id] - Baca percakapan\n` +
    `/heartbeat - Ping manual`
  );
});

bot.onText(/\/help/, async () => {
  await send(
    `*Menu Lengkap:*\n\n` +
    `*SKILL:*\n` +
    `/crypto [coin] - Harga crypto live\n` +
    `/joke - Joke random\n` +
    `/advice - Motivasi harian\n` +
    `/fact - Fakta unik\n` +
    `/kurs [jml] [dari] [ke] - Konversi kurs\n\n` +
    `*AGENT HUB:*\n` +
    `/status - Status agent\n` +
    `/inbox - Baca pesan masuk\n` +
    `/discover - Lihat agent online\n` +
    `/send [id] [pesan] - Kirim pesan\n` +
    `/read [id] - Baca percakapan\n` +
    `/heartbeat - Ping manual`
  );
});

bot.onText(/\/status/, async () => {
  try {
    const data = await agentHub("GET", `/agents/${encodeURIComponent(AGENT_ID)}`);
    await send(`*Status Agent Student:*\n\nID: \`${data.id || AGENT_ID}\`\nStatus: *${data.status || "unknown"}*\nRole: ${data.role || "-"}\nSkills: ${data.skills_count || "-"}\nUnread: ${lastUnread} pesan`);
  } catch (e) { await send("Gagal cek status: " + e.message); }
});

bot.onText(/\/heartbeat/, async () => {
  try {
    const data = await agentHub("POST", "/heartbeat", { supports_chat: true });
    await send(`*Heartbeat Terkirim!*\n\nStatus: *${data.status}*\nUnread: ${data.unread_count} pesan\nAuto heartbeat: setiap 15 detik`);
  } catch (e) { await send("Heartbeat gagal: " + e.message); }
});

bot.onText(/\/inbox/, async () => {
  try {
    const raw = await agentHub("GET", "/messages");
    const data = Array.isArray(raw) ? raw : (raw.conversations || raw.messages || raw.data || []);
    if (!data || data.length === 0) {
      await send(`Inbox kosong.\nTotal unread: *${lastUnread}* pesan.`);
      return;
    }
    let msg = `*Inbox (${data.length} percakapan):*\n\n`;
    data.slice(0, 8).forEach((conv, i) => {
      const peer = conv.peer?.name || conv.peer?.id || conv.from || "Unknown";
      const lastMsg = (conv.last_message?.content || conv.content || "-").slice(0, 50);
      const unread = conv.unread_count || 0;
      msg += `${i + 1}. *${peer}*${unread > 0 ? ` _(${unread} baru)_` : ""}\n`;
      msg += `   "${lastMsg}"\n   ID: \`${conv.peer?.id || conv.from || "-"}\`\n\n`;
    });
    msg += `_/read [id] untuk baca percakapan_`;
    await send(msg);
  } catch (e) { await send("Gagal ambil inbox: " + e.message); }
});

bot.onText(/\/read (.+)/, async (msg, match) => {
  const peerId = match[1].trim();
  try {
    const data = await agentHub("GET", `/messages/${encodeURIComponent(peerId)}`);
    if (!data || !data.length) { await send("Tidak ada percakapan dengan agent ini."); return; }
    let text = `*Chat dengan ${peerId}:*\n\n`;
    data.slice(-5).forEach((m) => {
      const from = m.from === AGENT_ID ? "Kamu" : peerId.split("-")[0];
      const time = new Date(m.created_at).toLocaleTimeString("id-ID");
      text += `[${time}] *${from}:*\n${m.content}\n\n`;
    });
    await send(text);
  } catch (e) { await send("Gagal baca chat: " + e.message); }
});

bot.onText(/\/discover/, async () => {
  try {
    const data = await agentHub("POST", "/discover", { supports_chat: true, limit: 8 });
    const agents = data.agents || [];
    if (!agents.length) { await send("Tidak ada agent online."); return; }
    let msg = `*Agent Online (${agents.length}):*\n\n`;
    agents.forEach((a, i) => { msg += `${i + 1}. *${a.name}*\n   ID: \`${a.id}\`\n\n`; });
    msg += `_/send [id] [pesan] untuk chat_`;
    await send(msg);
  } catch (e) { await send("Gagal discover: " + e.message); }
});

bot.onText(/\/send (.+?) (.+)/, async (msg, match) => {
  const targetId = match[1].trim();
  const content = match[2].trim();
  try {
    const data = await agentHub("POST", "/message", { to: targetId, content });
    await send(`*Pesan Terkirim!*\n\nKe: \`${targetId}\`\nPesan: "${content}"\nStatus: ${data.target_status || "sent"}`);
  } catch (e) { await send("Gagal kirim pesan: " + e.message); }
});

console.log("Bot started with 5 new skills!");
send("Bot UPDATE berhasil!\n\nSkill baru:\n/crypto bitcoin\n/joke\n/advice\n/fact\n/kurs 100 USD IDR\n\nKetik /help untuk menu lengkap.");
