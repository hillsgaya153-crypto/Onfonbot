const SUPABASE_URL = "https://jhjohslihkqmihaanyat.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoam9oc2xpaGtxbWloYWFueWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTI4NDYsImV4cCI6MjEwMDIyODg0Nn0.1nb0QqOWoKPCj9Y1WJjpvFTKplv9h_Wm1PYzqe7VRmU";

async function callFn(name, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

// ---------- IT RELEASE QUEUE ----------
// Backed by the `release_requests` table via the get-release-queue /
// mark-released Edge Functions instead of an in-memory array.
async function renderQueue() {
  const listEl = document.getElementById("queueList");
  const result = await callFn("get-release-queue");
  if (!result.ok) {
    listEl.innerHTML = '<div class="qempty">Couldn\'t load the queue. Check your Supabase config.</div>';
    return;
  }
  const queue = result.queue || [];
  listEl.innerHTML = "";
  if (queue.length === 0) {
    listEl.innerHTML = '<div class="qempty">No release requests yet. Ask a cleared customer to request one in Customer View.</div>';
    return;
  }
  queue.forEach(req => {
    const item = document.createElement("div");
    item.className = "queue-item";
    const requestedAt = new Date(req.requested_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
    item.innerHTML = `
      <div class="qinfo">
        <div class="qname">${escapeHtml(String(req.customer_name))} — ${escapeHtml(String(req.device_name))}</div>
        <div class="qmeta">Requested ${requestedAt}</div>
      </div>
      <div class="qrow-right">
        <span class="qstatus ${req.status === "released" ? "released" : "pending"}">${req.status === "released" ? "Released" : "Pending"}</span>
      </div>
    `;
    if (req.status === "pending") {
      const btn = document.createElement("button");
      btn.className = "qaction";
      btn.textContent = "Mark Released";
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = "Releasing...";
        await callFn("mark-released", { request_id: req.id });
        renderQueue();
      };
      item.querySelector(".qrow-right").appendChild(btn);
    }
    listEl.appendChild(item);
  });
}

// ---------- SESSION STATE MACHINE ----------
// In production this session object lives in a `wa_sessions` row keyed by
// phone number, not in a browser variable. Structure is identical.
let session = {
  step: "greeting",
  customer: null,
  loginAttempts: 0
};

const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addBubble(text, from) {
  const row = document.createElement("div");
  row.className = "row " + from;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const ticksHtml = from === "user" ? `<span class="ticks sent">${tickSVG(false)}</span>` : "";
  bubble.innerHTML = escapeHtml(text) + `<span class="time">${nowTime()}${ticksHtml}</span>`;
  row.appendChild(bubble);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;

  if (from === "user") {
    const tickEl = bubble.querySelector(".ticks");
    setTimeout(() => { if (tickEl) tickEl.innerHTML = tickSVG(true); }, 350);
    setTimeout(() => { if (tickEl) tickEl.classList.add("read"); }, 950);
  }
}

function addDaySeparator(label) {
  const sep = document.createElement("div");
  sep.className = "daysep";
  sep.textContent = label;
  chatEl.appendChild(sep);
}

function escapeHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
}

function addOptions(options, onPick) {
  const row = document.createElement("div");
  row.className = "row bot";
  const wrap = document.createElement("div");
  wrap.className = "options";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt.label;
    btn.onclick = () => {
      Array.from(wrap.children).forEach(b => b.disabled = true);
      addBubble(opt.label, "user");
      onPick(opt.value);
    };
    wrap.appendChild(btn);
  });
  row.appendChild(wrap);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setInputMode(mode) {
  // mode: 'id', 'password', 'hidden'
  if (mode === "hidden") {
    inputEl.style.display = "none";
    sendBtn.style.display = "none";
  } else {
    inputEl.style.display = "";
    sendBtn.style.display = "";
    inputEl.type = mode === "password" ? "password" : "text";
    inputEl.placeholder = mode === "id"
      ? "Enter your ID or phone number..."
      : "Enter your password...";
    inputEl.value = "";
    inputEl.focus();
  }
}

function fmtMoney(n) {
  const num = Number(n);
  if (isNaN(num)) return "KES 0";
  return "KES " + Math.round(num).toLocaleString();
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt) ? "" : dt.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

// Kenyan phone (07XXXXXXXX / 01XXXXXXXX) or a 6-10 digit national ID
function isValidIdentifier(value) {
  const v = value.trim();
  return /^0[17]\d{8}$/.test(v) || /^\d{6,10}$/.test(v);
}

function tickSVG(double) {
  return double
    ? '<svg viewBox="0 0 20 12"><path d="M1 6.5L5 10.5L15 1" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6.5L10 10.5L20 1" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg viewBox="0 0 16 12"><path d="M1 6.5L5 10.5L15 1" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "typing-row";
  row.id = "typingRow";
  row.innerHTML = '<div class="typing-bubble"><span></span><span></span><span></span></div>';
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function hideTyping() {
  const row = document.getElementById("typingRow");
  if (row) row.remove();
}

// ---------- FLOW ----------
function startFlow() {
  addDaySeparator("TODAY");
  addBubble("Hi 👋 Welcome to Onfon Loan Assist.\nTo get started, please enter your registered ID number or phone number.", "bot");
  session.step = "awaiting_id";
  setInputMode("id");
}

async function handleTextInput(value) {
  if (!value.trim()) return;

  if (session.step === "awaiting_id") {
    addBubble(value, "user");
    if (!isValidIdentifier(value)) {
      addBubble("That doesn't look like a valid ID or phone number. Please enter your ID number or a phone number in the format 07XXXXXXXX.", "bot");
      setInputMode("id");
      return;
    }
    session.pendingIdentifier = value.trim();
    session.step = "awaiting_password";
    addBubble(`Thanks. Please enter the password for your Onfon account.`, "bot");
    setInputMode("password");
    return;
  }

  if (session.step === "awaiting_password") {
    addBubble("••••••••", "user");
    setInputMode("hidden");
    showTyping();
    const result = await callFn("login", { identifier: session.pendingIdentifier, password: value });
    hideTyping();

    if (!result.ok) {
      session.loginAttempts++;
      if (result.reason === "not_found") {
        addBubble("We couldn't find an account matching that ID/phone number.", "bot");
      } else if (result.reason === "bad_password") {
        addBubble("That password doesn't match our records.", "bot");
      } else {
        addBubble("Something went wrong reaching the server.", "bot");
      }
      if (session.loginAttempts >= 5) {
        addBubble("Too many failed attempts. Please try again later or contact an Onfon agent.", "bot");
        return;
      }
      session.step = "awaiting_id";
      addBubble("Please enter your ID or phone number again.", "bot");
      setInputMode("id");
      return;
    }

    session.customer = result.customer; // { id, full_name }
    session.step = "main_menu";
    addBubble(`Welcome back, ${result.customer.full_name.split(" ")[0]}. You're verified ✅`, "bot");
    showMainMenu();
    return;
  }

  if (session.step === "awaiting_agent_issue") {
    addBubble(value, "user");
    setInputMode("hidden");
    showTyping();
    let logged = false;
    try {
      const r = await callFn("support", {
        customer_id: session.customer.id,
        issue_description: value.trim()
      });
      logged = !!r.ok;
    } catch (e) { logged = false; }
    hideTyping();
    session.step = "main_menu";
    if (logged) {
      addBubble("Thanks, I've noted that. Connecting you to the next available Onfon agent. Average wait time: 3 minutes.", "bot");
    } else {
      addBubble("I couldn't save your message just now, but an Onfon agent will still pick up your chat. Please describe the issue to them when they join.", "bot");
    }
    return;
  }
}

function showMainMenu() {
  setInputMode("hidden");
  addBubble("What would you like to do?", "bot");
  addOptions([
    { label: "1️⃣  Check loan balance", value: "balance" },
    { label: "2️⃣  View payment plan options", value: "plans" },
    { label: "3️⃣  Request device release", value: "release" },
    { label: "4️⃣  Report wrong M-Pesa transaction", value: "mpesa_issue" },
    { label: "5️⃣  Request a mini loan", value: "miniloan" },
    { label: "6️⃣  Request a grace period", value: "grace" },
    { label: "7️⃣  Talk to a human agent", value: "agent" },
    { label: "0️⃣  Exit", value: "exit" }
  ], handleMenuChoice);
}

async function handleMenuChoice(choice) {
  const cust = session.customer;

  if (choice === "balance") {
    showTyping();
    const result = await callFn("get-loan", { customer_id: cust.id });
    hideTyping();
    if (!result.ok || !result.loan) {
      addBubble("Couldn't load your loan details right now. Please try again shortly.", "bot");
      backToMenuPrompt();
      return;
    }
    const l = result.loan;
    addBubble(
      `📱 ${l.device_name}\n` +
      `Original amount: ${fmtMoney(l.principal_amount)}\n` +
      `Amount paid so far: ${fmtMoney(l.amount_paid)}\n` +
      `Balance remaining: ${fmtMoney(l.balance_remaining)}\n` +
      `Current plan: ${l.repayment_months} month${l.repayment_months === 1 ? "" : "s"}` +
      (l.is_active === false && Number(l.balance_remaining) <= 0
        ? `\n✅ This loan is fully paid.`
        : l.next_repayment_date
          ? `\nNext payment: ${fmtMoney(l.pay_now_amount)} due ${fmtDate(l.next_repayment_date)}`
          : ""),
      "bot"
    );
    backToMenuPrompt();
  } else if (choice === "plans") {
    showTyping();
    const plansResult = await callFn("get-plans", { customer_id: cust.id });
    hideTyping();
    if (!plansResult.ok) {
      addBubble("Couldn't load payment plans right now. Please try again shortly.", "bot");
      backToMenuPrompt();
      return;
    }
    let msg = "Available payment plans for your device:\n\n";
    plansResult.plans.forEach(p => {
      const current = p.is_current ? "  (your current plan)" : "";
      msg += `• ${p.repayment_months} month${p.repayment_months === 1 ? "" : "s"}: ${fmtMoney(p.daily_installment)}/day${current}\n`;
    });
    msg += "\nTo switch plans, an Onfon agent needs to confirm the change with you.";
    addBubble(msg.trim(), "bot");
    backToMenuPrompt();
  } else if (choice === "release") {
    showTyping();
    const result = await callFn("request-release", { customer_id: cust.id });
    hideTyping();
    if (!result.ok) {
      if (result.reason === "balance_not_cleared") {
        addBubble(
          `Your device can't be released yet — you still have ${fmtMoney(result.balance_remaining)} remaining on this loan.\n` +
          `Clear your balance and you can request release here anytime.`,
          "bot"
        );
      } else if (result.reason === "blacklisted") {
        addBubble("Your account has a restriction on it, so release can't be requested here. Please contact an Onfon agent.", "bot");
      } else if (result.reason === "device_lost") {
        addBubble("This device is flagged as lost, so it can't be released through this channel. Please contact an Onfon agent.", "bot");
      } else if (result.reason === "loan_inactive") {
        addBubble("This loan isn't currently active, so release can't be requested. Please contact an Onfon agent.", "bot");
      } else if (result.reason === "already_pending") {
        addBubble("Your release request is already with our IT team. You'll be notified once it's actioned — usually within a few hours.", "bot");
      } else if (result.reason === "already_released") {
        addBubble("Good news — this device has already been released. No further action needed.", "bot");
      } else {
        addBubble("Couldn't submit your request right now. Please try again shortly.", "bot");
      }
      backToMenuPrompt();
      return;
    }
    addBubble(
      `✅ Confirmed — your balance is fully cleared.\n` +
      `A release request has been sent to our IT team. You'll get a confirmation once it's done.`,
      "bot"
    );
    backToMenuPrompt();
  } else if (choice === "mpesa_issue") {
    addBubble(
      `To resolve a wrong M-Pesa transaction:\n\n` +
      `Send an SMS to 21484 containing:\n` +
      `• Your M-Pesa transaction ID\n` +
      `• Your registered phone number\n\n` +
      `Our reconciliation team will follow up once received.`,
      "bot"
    );
    backToMenuPrompt();
  } else if (choice === "miniloan") {
    showTyping();
    const loanResult = await callFn("get-loan", { customer_id: cust.id });
    hideTyping();
    const l = loanResult.loan;
    if (!l) {
      addBubble("Couldn't check your eligibility right now. Please try again shortly.", "bot");
      backToMenuPrompt();
      return;
    }
    if (l.balance_remaining > 0) {
      addBubble(
        `Mini loans are only available once your current loan is fully cleared.\n` +
        `You still have ${fmtMoney(l.balance_remaining)} remaining.`,
        "bot"
      );
    } else {
      addBubble(
        `✅ You're eligible for a mini loan.\n\n` +
        `To apply:\n` +
        `Dial *797# → Option 4 (Miniloan) → choose your amount.\n` +
        `Funds are sent instantly to your M-Pesa.\n` +
        `The limit is also indicated on the page.`,
        "bot"
      );
    }
    backToMenuPrompt();
  } else if (choice === "grace") {
    addBubble(
      `To request a grace period on your loan:\n\n` +
      `Dial *797# → Option 2 (Pay for my loan) → Option 5 (Offline PIN).\n` +
      `Follow the prompts to complete your request.`,
      "bot"
    );
    backToMenuPrompt();
  } else if (choice === "agent") {
    addBubble("Sure. Before I connect you, could you briefly describe the issue you're facing?", "bot");
    session.step = "awaiting_agent_issue";
    setInputMode("id");
    inputEl.placeholder = "Describe your issue...";
  } else if (choice === "exit") {
    addBubble("Thanks for using Onfon Loan Assist. Chat again anytime 👋", "bot");
    setInputMode("hidden");
  }
}

function backToMenuPrompt() {
  addOptions([
    { label: "⬅️  Back to main menu", value: "menu" }
  ], () => showMainMenu());
}

// ---------- WIRE UP ----------
sendBtn.onclick = () => {
  const val = inputEl.value;
  inputEl.value = "";
  handleTextInput(val);
};
inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter") sendBtn.onclick();
});

const tabCustomer = document.getElementById("tabCustomer");
const tabIT = document.getElementById("tabIT");
const customerFrame = document.getElementById("customerFrame");
const itFrame = document.getElementById("itFrame");

tabCustomer.onclick = () => {
  tabCustomer.classList.add("active");
  tabIT.classList.remove("active");
  customerFrame.style.display = "flex";
  itFrame.classList.remove("active");
};
tabIT.onclick = () => {
  tabIT.classList.add("active");
  tabCustomer.classList.remove("active");
  customerFrame.style.display = "none";
  itFrame.classList.add("active");
  renderQueue();
};

startFlow();