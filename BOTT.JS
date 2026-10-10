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
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

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
        <div class="qname">${escapeHtml(req.customer_name)} — ${escapeHtml(req.device_name)}</div>
        <div class="qmeta">Requested ${requestedAt}</div>
      </div>
      <div class="qrow-right">
        <span class="qstatus ${req.status}">${req.status === "released" ? "Released" : "Pending"}</span>
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
  const ticksHtml = from === "user"? `<span class="ticks sent">${tickSVG(false)}</span>` : "";
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

function setInputMode(mode, placeholder) {
  if (mode === "hidden") {
    inputEl.style.display = "none";
    sendBtn.style.display = "none";
    return;
  }
  inputEl.style.display = "";
  sendBtn.style.display = "";
  inputEl.type = mode === "password"? "password" : "text";
  inputEl.placeholder = placeholder || (mode === "id"
   ? "Enter your ID or phone number"
    : "Write message here....");
  inputEl.value = "";
  inputEl.focus();
}

function fmtMoney(n) {
  const num = Number(n);
  return "KES " + (isNaN(num)? "0" : num.toLocaleString());
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

function startFlow() {
  addDaySeparator("TODAY");
  addBubble("Hi there welcome to Onfon Mobile I'm your virtual assistant. To proceed, please enter your registered National ID number or phone number.", "bot");
  session.step = "awaiting_id";
  setInputMode("id");
}

function isValidIdentifier(value) {
  const v = value.trim();
  const phonePattern = /^0[17]\d{8}$/;
  const idPattern = /^\d{6,10}$/;
  return phonePattern.test(v) || idPattern.test(v);
}

async function handleTextInput(value) {
  if (!value.trim()) return;

  if (session.step === "awaiting_id") {
    addBubble(value, "user");

    if (!isValidIdentifier(value)) {
      addBubble(
        "The information provided appears to be invalid. Kindly enter a valid National ID number or phone number in the format 07XXXXXXXX.",
        "bot"
      );
      setInputMode("id");
      return;
    }

    session.pendingIdentifier = value.trim();
    session.step = "awaiting_password";
    addBubble(`Thank you. Please enter your Onfon account password to continue.`, "bot");
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
        addBubble("We were unable to locate an account associated with the provided ID or phone number. Please verify and try again.", "bot");
      } else if (result.reason === "bad_password") {
        addBubble("The password entered is incorrect. Please try again.", "bot");
      } else {
        addBubble("We are currently experiencing a technical difficulty. Please try again shortly.", "bot");
      }
      if (session.loginAttempts >= 5) {
        addBubble("You have exceeded the maximum login attempts. For security reasons, please try again later or contact our support team for assistance.", "bot");
        return;
      }
      session.step = "awaiting_id";
      addBubble("Kindly re-enter your ID number or phone number.", "bot");
      setInputMode("id");
      return;
    }

    session.customer = result.customer;
    session.step = "main_menu";
    addBubble(`Welcome back, ${result.customer.full_name.split(" ")[0]}. Your account has been successfully verified.`, "bot");
    showMainMenu();
    return;
  }

  if (session.step === "awaiting_agent_issue") {
    addBubble(value, "user");
    setInputMode("hidden");
    showTyping();
    const result = await callFn("support", {
      customer_id: session.customer.id,
      issue_description: value.trim()
    });
    hideTyping();
    if (result && result.ok) {
      addBubble("Thank you. Your concern has been logged successfully. A member of our support team will contact you shortly.", "bot");
    } else {
      addBubble("We were unable to submit your request at this time. Please try again shortly.", "bot");
    }
    backToMenuPrompt();
    return;
  }
}

function showMainMenu() {
  setInputMode("hidden");
  addBubble("How may we assist you today? Please select an option below.", "bot");
  addOptions([
    { label: "1️⃣ Check loan balance", value: "balance" },
    { label: "2️⃣ View payment plan options", value: "plans" },
    { label: "3️⃣ Request device release", value: "release" },
    { label: "4️⃣ Report wrong M-Pesa transaction", value: "mpesa_issue" },
    { label: "5️⃣ Request a mini loan", value: "miniloan" },
    { label: "6️⃣ Request a grace period", value: "grace" },
    { label: "7️⃣ Talk to a human agent", value: "agent" },
    { label: "8️⃣ Unlocking device", value: "Unlock" },
    { label: "0️⃣ Exit", value: "exit" }
  ], handleMenuChoice);
}

function backToMenuPrompt() {
  addOptions([
    { label: "⬅️ Back to main menu", value: "menu" }
  ], () => showMainMenu());
}

async function handleBalance(cust) {
  showTyping();
  const result = await callFn("get-loan", { customer_id: cust.id });
  hideTyping();
  if (!result.ok ||!result.loan) {
    addBubble("We are unable to retrieve your loan details at the moment. Please try again shortly.", "bot");
    backToMenuPrompt();
    return;
  }
  const l = result.loan;
  addBubble(
    `Here are your current loan details:\n` +
    `Device: ${l.device_name}\n` +
    `Principal Amount: ${fmtMoney(l.principal_amount)}\n` +
    `Total Paid: ${fmtMoney(l.amount_paid)}\n` +
    `Outstanding Balance: ${fmtMoney(l.balance_remaining)}\n` +
    `Repayment Plan: ${l.repayment_months} month${l.repayment_months === 1? "" : "s"}`,
    "bot"
  );
  backToMenuPrompt();
}

async function handlePlans(cust) {
  showTyping();
  const plansResult = await callFn("get-plans", { customer_id: cust.id });
  hideTyping();
  if (!plansResult.ok) {
    addBubble("We are unable to load available payment plans at the moment. Please try again shortly.", "bot");
    backToMenuPrompt();
    return;
  }
  let msg = "Below are the available payment plans for your device:\n\n";
  plansResult.plans.forEach(p => {
    const current = p.is_current? " (Your current plan)" : "";
    msg += `• ${p.repayment_months} month${p.repayment_months === 1? "" : "s"} — ${fmtMoney(p.daily_installment)}/day${current}\n`;
  });
  msg += "\nTo change your payment plan, please dial *797#, select Option 2 (Pay for my loan), and follow the prompts to change your plan. Please note that you may change your plan up to three times.";
  addBubble(msg.trim(), "bot");
  backToMenuPrompt();
}

async function handleRelease(cust) {
  showTyping();
  const result = await callFn("request-release", { customer_id: cust.id });
  hideTyping();
  if (!result.ok) {
    if (result.reason === "balance_not_cleared") {
      addBubble(
        `Your device release request cannot be processed at this time. You have an outstanding balance of ${fmtMoney(result.balance_remaining)}.\n` +
        `Once your balance is fully cleared, you may request for device release.`,
        "bot"
      );
    } else if (result.reason === "already_pending") {
      addBubble("Your device release request is currently being processed by our technical team. You will be notified once it has been completed, typically within a few hours.", "bot");
    } else if (result.reason === "already_released") {
      addBubble("Your device has already been released. No further action is required.", "bot");
    } else {
      addBubble("We were unable to submit your request at this time. Please try again shortly.", "bot");
    }
    backToMenuPrompt();
    return;
  }
  addBubble(
    `Your loan balance has been fully cleared.\n` +
    `A device release request has been submitted to our technical team. You will receive a confirmation upon completion.`,
    "bot"
  );
  backToMenuPrompt();
}

async function handleMpesaIssue() {
  addBubble(
    `To report an incorrect M-Pesa transaction, please send an SMS to 21484 with the following details:\n\n` +
    `• M-Pesa transaction code\n` +
    `• Registered phone number\n\n` +
    `Format: UFTHORNWS#CorrectAccountNumber\nExample: UFTHORNWS#123456677`,
    "bot"
  );
  backToMenuPrompt();
}

async function handleMiniLoan(cust) {
  showTyping();
  const loanResult = await callFn("get-loan", { customer_id: cust.id });
  hideTyping();
  const l = loanResult.loan;
  if (!l) {
    addBubble("We are unable to verify your eligibility at the moment. Please try again shortly.", "bot");
    backToMenuPrompt();
    return;
  }
  if (l.balance_remaining > 0) {
    addBubble(
      `Mini loan eligibility requires full clearance of your current loan.\n` +
      `Your outstanding balance is ${fmtMoney(l.balance_remaining)}.`,
      "bot"
    );
  } else {
    addBubble(
      `You are eligible for a mini loan.\n\n` +
      `To apply, please dial *797#, select Option 4 (Mini loan), and choose your preferred amount.\n` +
      `Funds will be disbursed instantly to your M-Pesa account.\n` +
      `Your loan limit will be displayed on the application page.`,
      "bot"
    );
  }
  backToMenuPrompt();
}

async function handleGrace() {
  addBubble(
    `To request a grace period, please dial *797#, select Option 2 (Pay for my loan), then select Option 4 (Grace Period) and follow the prompts to complete your request.`,
    "bot"
  );
  backToMenuPrompt();
}

async function handleAgent() {
  addBubble("You are being connected to our customer support team. Kindly provide a brief description of your issue to enable us to assist you effectively.", "bot");
  session.step = "awaiting_agent_issue";
  setInputMode("text", "Please describe your issue...");
}

async function handleExit() {
  addBubble("Thank you for contacting Onfon Loan Assist. We are here to assist you anytime.", "bot");
  setInputMode("hidden");
}

async function handleUnlock() {
  addBubble("Please ensure your device is connected to a stable internet connection and restart it. If the device remains locked, you may generate an offline unlock PIN by dialing *797#, selecting Option 2 (Pay for my loan), then Option 5 (Offline PIN).", "bot");
  backToMenuPrompt();
}

const MENU_HANDLERS = {
  balance: handleBalance,
  plans: handlePlans,
  release: handleRelease,
  mpesa_issue: handleMpesaIssue,
  miniloan: handleMiniLoan,
  grace: handleGrace,
  agent: handleAgent,
  exit: handleExit,
  Unlock: handleUnlock
};

async function handleMenuChoice(choice) {
  const handler = MENU_HANDLERS[choice];
  if (!handler) return;
  await handler(session.customer);
}

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