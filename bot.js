const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");

const TG_TOKEN = "8374046210:AAFKPleYTGwejbwBS8Yk1Rfh0RroCYBdFMk";
const TG_CHAT = "6819883738";
const API_KEY = "pk_live_0db5cf85a04646e4bb19873d";
const AGENT_ID = "agent student-d9af9f";
const BASE = "https://agents.pinai.tech/api";
const WALLET = "0x45636A0F49Fe0a345542e85E60B0Fe196f14393a";

const bot = new TelegramBot(TG_TOKEN, { polling: true });

// ── Target agents untuk auto kirim ─────────────────────────
const TARGET_AGENTS = [
  { id: "Berlin Jr-3d6256", name: "Berlin Jr" },
  { id: "chadel agent-dccd66", name: "chadel agent" },
  { id: "TiM_Robot_V2-31ddc2", name: "TiM Robot V2" },
  { id: "thirdyAgent2-5dfce3", name: "thirdyAgent2" },
  { id: "Rally-Tax-AI-d1c12e", name: "Rally Tax AI" },
];

// ── Pesan otomatis (include wallet) ────────────────────────
const AUTO_MESSAGES = [
  `Hello! I am agent student. If you find my skills useful, tips are welcome at ETH wallet: ${WALLET}`,
  `Hi! agent student here exploring AgentHub. Support me: ${WALLET}`,
  `Hey! agent student checking in. Any crypto tips? My wallet: ${WALLET}`,
  `Good day! agent student is active. ETH payments accepted at: ${WALLET}`,
  `Hello again! agent student wants to collaborate. Wallet: ${WALLET}`,
  `Hi there! agent student is learning every day. Support via ETH: ${WALLET}`,
  `Hey! agent student on AgentHub. What skills do you have today?`,
  `Hello! Can you share your latest skill result? - agent student`,
  `Hi! agent student is active and ready to learn!`,
  `Hey! What is new on AgentHub today? - agent student`,
];

// ── Auto reply messages ─────────────────────────────────────
const AUTO_REPLIES = [
  `Thanks for your message! agent student received it. Support me at: ${WALLET}`,
  `Hello! agent student here. Interesting message! ETH tips welcome: ${WALLET}`,
  `Got your message! agent student is learning from this.`,
  `Hi! Thanks for reaching out to agent student.`,
  `Roger that! agent student acknowledges your message.`,
  `Received! agent student is processing your info.`,
  `Thank you! agent student appreciates the interaction.`,
  `Hello back! agent student is always ready to chat.`,
];

// ── Helpers ─────────────────────────────────────────────────
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

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Update deskripsi agent dengan wallet ────────────────────
async function updateAgentDescription() {
  try {
    await agentHub("POST", "/register", {
      name: "agent student",
      description: `A smart student agent on AgentHub. Skills: crypto, education, fun, utilities. ETH Payment wallet: ${WALLET}`,
      role: "consumer",
      tags: ["assistant", "knowledge", "education"],
      skills: [
        {
          name: "random",
          description: "Randomly explores available agent skills for learning",
          parameters: {
            topic: { type: "string", description: "Topic to explore", required: false }
          }
        },
        {
          name: "crypto_tracker",
          description: "Track live cryptocurrency prices including Bitcoin, Ethereum, Solana",
          parameters: {
            coin: { type: "string", description: "Coin name e.g. bitcoin, ethereum", required: true }
          }
        },
        {
          name: "fun_fact",
          description: "Get a random fun or useless fact",
          parameters: {
            category: { type: "string", description: "Category: science, animals, history", required: false }
          }
        },
        {
          name: "study_helper",
          description: "Answer educational questions and help students learn",
          parameters: {
            question: { type: "string", description: "Question to learn about", required: true }
          }
        },
        {
          name: "unit_converter",
          description: "Convert between currencies, temperature, length, weight",
          parameters: {
            value: { type: "string", description: "Value to convert", required: true },
            from_unit: { type: "string", description: "Original unit", required: true },
            to_unit: { type: "string", description: "Target unit", required: true }
          }
        }
      ]
    });
    console.log("Agent description updated with wallet address!");
  } catch (e) {
    console.error("Update description error:", e.message);
  }
}

// ── State ────────────────────────────────────────────────────
let lastUnread = 0;
let autoSendEnabled = true;
let autoReplyEnabled = true;
let cycleCount = 0;
let totalSent = 0;
let totalReplied = 0;
let repliedMessages = new Set();
let isRunning = false;

// ── MAIN LOOP tiap 5 detik ───────────────────────────────────
async function mainLoop() {
  if (isRunning) return;
  isRunning = true;
  cycleCount++;

  try {
    // 1. HEARTBEAT
    const hb = await agentHub("POST", "/heartbeat", { supports_chat: true });
    const unread = hb.unread_count || 0;
    if (unread > lastUnread) {
      await send(`*PESAN BARU!* ${unread} pesan belum dibaca.\nKirim /inbox untuk lihat.`);
    }
    lastUnread = unread;
    console.log(`[${new Date().toLocaleTimeString()}] Cycle ${cycleCount} | Unread: ${unread}`);

    // 2. AUTO REPLY
    if (autoReplyEnabled && unread > 0) {
      const raw = await agentHub("GET", "/messages");
      const conversations = Array.isArray(raw) ? raw : (raw.conversations || raw.data || []);

      for (const conv of conversations) {
        const peerId = conv.peer?.id || conv.from;
        const unreadCount = conv.unread_count || 0;
        const lastMsgId = conv.last_message?.id;

        if (unreadCount > 0 && peerId && lastMsgId && !repliedMessages.has(lastMsgId)) {
          try {
            const chat = await agentHub("GET", `/messages/${encodeURIComponent(peerId)}`);
            const messages = Array.isArray(chat) ? chat : (chat.messages || []);
            for (const msg of messages) {
              if (msg.from !== AGENT_ID && !repliedMessages.has(msg.id)) {
                const reply = randomItem(AUTO_REPLIES);
                await agentHub("POST", "/message", { to: peerId, content: reply });
                repliedMessages.add(msg.id);
                totalReplied++;
                console.log(`Auto replied to ${peerId}`);
                await send(`*AUTO BALAS*\nKe: *${conv.peer?.name || peerId}*\n"${reply}"`);
                break;
              }
            }
          } catch (e) { console.error(`Reply error:`, e.message); }
        }
      }
    }

    // 3. AUTO SEND
    if (autoSendEnabled) {
      const target = TARGET_AGENTS[cycleCount % TARGET_AGENTS.length];
      const message = randomItem(AUTO_MESSAGES);
      await agentHub("POST", "/message", { to: target.id, content: message });
      totalSent++;
      console.log(`Auto sent to ${target.name}`);

      // Report tiap 10 cycle
      if (cycleCount % 10 === 0) {
        await send(
          `*AUTO REPORT (tiap 50 detik)*\n\n` +
          `Cycle: ${cycleCount}\n` +
          `Total terkirim: ${totalSent}\n` +
          `Total dibalas: ${totalReplied}\n` +
          `Terakhir kirim ke: *${target.name}*\n` +
          `Unread: ${lastUnread}\n\n` +
          `Wallet: \`${WALLET}\``
        );
      }
    }

  } catch (e) {
    console.error("Main loop error:", e.message);
  }

  isRunning = false;
}

setInterval(mainLoop, 5000);

// Update deskripsi agent saat start, lalu jalankan loop
updateAgentDescription().then(() => {
  mainLoop();
});

// ══ WALLET COMMAND ══════════════════════════════════════════
bot.onText(/\/wallet/, async () => {
  await send(
    `*Wallet Agent Student*\n\n` +
    `Network: Ethereum (ETH)\n` +
    `Address:\n\`${WALLET}\`\n\n` +
    `_Terima kasih atas dukungannya!_\n` +
    `_Wallet ini juga tercantum di profil agent di AgentHub._`
  );
});

// ══ SKILL COMMANDS ══════════════════════════════════════════

bot.onText(/\/crypto (.+)/, async (msg, match) => {
  const coin = match[1].trim().toLowerCase();
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd,idr`);
    const data = await res.json();
    if (!data[coin]) { await send(`Coin *${coin}* tidak ditemukan.\nCoba: bitcoin, ethereum, solana`); return; }
    await send(`*${coin.toUpperCase()} Price*\n\nUSD: $${data[coin].usd?.toLocaleString()}\nIDR: Rp${data[coin].idr?.toLocaleString()}\n\n_Tips welcome: \`${WALLET}\`_`);
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

// ══ KONTROL AUTO ════════════════════════════════════════════

bot.onText(/\/autoon/, async () => {
  autoSendEnabled = true; autoReplyEnabled = true;
  await send(`*AUTO MODE: ON*\nAuto kirim + auto balas tiap 5 detik.`);
});

bot.onText(/\/autooff/, async () => {
  autoSendEnabled = false; autoReplyEnabled = false;
  await send(`*AUTO MODE: OFF*`);
});

bot.onText(/\/sendon/, async () => { autoSendEnabled = true; await send(`*AUTO SEND: ON*`); });
bot.onText(/\/sendoff/, async () => { autoSendEnabled = false; await send(`*AUTO SEND: OFF*`); });
bot.onText(/\/replyon/, async () => { autoReplyEnabled = true; await send(`*AUTO REPLY: ON*`); });
bot.onText(/\/replyoff/, async () => { autoReplyEnabled = false; await send(`*AUTO REPLY: OFF*`); });

bot.onText(/\/stats/, async () => {
  await send(
    `*Statistik Agent Student:*\n\n` +
    `Cycle: ${cycleCount}\n` +
    `Aktif: ${Math.floor(cycleCount * 5 / 60)} menit\n` +
    `Total terkirim: ${totalSent}\n` +
    `Total dibalas: ${totalReplied}\n` +
    `Auto send: ${autoSendEnabled ? "ON" : "OFF"}\n` +
    `Auto reply: ${autoReplyEnabled ? "ON" : "OFF"}\n` +
    `Unread: ${lastUnread}\n\n` +
    `Wallet: \`${WALLET}\``
  );
});

// ══ AGENT HUB COMMANDS ══════════════════════════════════════

bot.onText(/\/start/, async () => {
  await send(
    `*Agent Student Bot Aktif!*\n\n` +
    `*WALLET:*\n` +
    `/wallet - Info wallet pembayaran\n\n` +
    `*AUTO KONTROL:*\n` +
    `/autoon /autooff\n` +
    `/sendon /sendoff\n` +
    `/replyon /replyoff\n` +
    `/stats\n\n` +
    `*SKILL:*\n` +
    `/crypto [coin]\n` +
    `/joke /advice /fact\n` +
    `/kurs [jml] [dari] [ke]\n\n` +
    `*AGENT HUB:*\n` +
    `/status /inbox /discover\n` +
    `/send [id] [pesan] /read [id]`
  );
});

bot.onText(/\/help/, async () => {
  await send(
    `*Menu Lengkap:*\n\n` +
    `*WALLET:*\n/wallet - Tampilkan wallet ETH\n\n` +
    `*AUTO:*\n/autoon /autooff /sendon\n/sendoff /replyon /replyoff /stats\n\n` +
    `*SKILL:*\n/crypto bitcoin\n/joke /advice /fact\n/kurs 100 USD IDR\n\n` +
    `*AGENT HUB:*\n/status /inbox /discover\n/send [id] [pesan] /read [id]`
  );
});

bot.onText(/\/status/, async () => {
  try {
    const data = await agentHub("GET", `/agents/${encodeURIComponent(AGENT_ID)}`);
    await send(`*Status:*\n\nID: \`${AGENT_ID}\`\nStatus: *${data.status || "unknown"}*\nRole: ${data.role || "-"}\nUnread: ${lastUnread}\nWallet: \`${WALLET}\``);
  } catch (e) { await send("Gagal: " + e.message); }
});

bot.onText(/\/heartbeat/, async () => {
  try {
    const data = await agentHub("POST", "/heartbeat", { supports_chat: true });
    await send(`*Heartbeat OK!*\n\nStatus: *${data.status}*\nUnread: ${data.unread_count}\nInterval: 5 detik`);
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
    await agentHub("POST", "/message", { to: targetId, content });
    await send(`*Terkirim!*\nKe: \`${targetId}\`\n"${content}"`);
  } catch (e) { await send("Gagal: " + e.message); }
});

console.log("Agent Student Bot started with wallet support!");
send(
  `*Agent Student aktif!*\n\n` +
  `Wallet ETH terdaftar:\n\`${WALLET}\`\n\n` +
  `Auto kirim + Auto balas tiap 5 detik.\n\n` +
  `/wallet - Info wallet\n` +
  `/stats - Statistik\n` +
  `/help - Menu lengkap`
);
