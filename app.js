import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, runTransaction, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJX6g8dvSkfKZlR0o-Dcd7toCAqW5pYU",
  authDomain: "marynel-codigos.firebaseapp.com",
  projectId: "marynel-codigos",
  storageBucket: "marynel-codigos.firebasestorage.app",
  messagingSenderId: "694029007899",
  appId: "1:694029007899:web:45775312608c6f8e114cbe"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MASTER_CODE = "48271935";
const CODES = "marynel_codes";
const TARGET_AVAILABLE = 20;
let currentCode = null;
let currentDiscount = 0;
let adminMode = false;
let tries = 0;
let lockedUntil = 0;

const $ = id => document.getElementById(id);
const authGate = $("authGate");
const authCard = $("authCard");
const authCode = $("authCode");
const authMsg = $("authMsg");
const menuBtn = $("menuBtn");
const menuPanel = $("menuPanel");

function authMessage(text, type = "") {
  authMsg.textContent = text;
  authMsg.className = "auth-msg " + type;
}

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function randomCode() {
  let code = "";
  for (let i = 0; i < 8; i++) code += Math.floor(Math.random() * 10);
  return code;
}

function randomDiscount() {
  return Math.floor(Math.random() * 46) + 5;
}

async function consumeCode(code) {
  const ref = doc(db, CODES, code);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      return { ok: false, reason: "Código no registrado en Firebase." };
    }

    const data = snap.data();
    if (String(data.status || "").toLowerCase() !== "available") {
      return { ok: false, reason: "Este código ya fue utilizado." };
    }

    let replacement = randomCode();
    while (replacement === MASTER_CODE) replacement = randomCode();
    let replacementRef = doc(db, CODES, replacement);

    for (let i = 0; i < 12; i++) {
      const existing = await tx.get(replacementRef);
      if (!existing.exists()) break;
      replacement = randomCode();
      while (replacement === MASTER_CODE) replacement = randomCode();
      replacementRef = doc(db, CODES, replacement);
      if (i === 11) throw new Error("No se pudo generar un código único.");
    }

    const discount = Number(data.discount || 0);
    if (!Number.isFinite(discount) || discount < 1 || discount > 100) {
      return { ok: false, reason: "El código existe, pero su descuento no es válido." };
    }

    const replacementDiscount = randomDiscount();
    tx.update(ref, { status: "used", usedAt: serverTimestamp() });
    tx.set(replacementRef, {
      discount: replacementDiscount,
      status: "available",
      createdAt: serverTimestamp(),
      replacementOf: code
    });

    return { ok: true, discount, replacement, replacementDiscount };
  });
}

function addDiscountBadge(card, percent) {
  if (!card) return;
  let badge = card.querySelector(".marynel-discount-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "marynel-discount-badge";
    const head = card.querySelector(".product-head");
    if (head) head.insertAdjacentElement("afterend", badge);
    else card.prepend(badge);
  }
  badge.textContent = `DESCUENTO CON TU CÓDIGO: -${percent}%`;
  badge.hidden = false;
}

function applyDiscount(percent) {
  currentDiscount = percent;

  // 1) Cualquier precio preparado con data-price.
  document.querySelectorAll("[data-price]").forEach(el => {
    const original = Number(el.dataset.originalPrice || el.dataset.price);
    if (!Number.isFinite(original)) return;
    el.dataset.originalPrice = String(original);
    const final = original * (1 - percent / 100);
    el.innerHTML = `<span class="marynel-original-price">Q${original.toFixed(2)}</span> &nbsp; <strong>Q${final.toFixed(2)}</strong> <small class="marynel-discount-percent">-${percent}%</small>`;
  });

  // 2) Elementos con clase .price que ya tengan un precio numérico.
  document.querySelectorAll(".price").forEach(el => {
    if (el.dataset.price) return;
    const text = el.textContent.replace(/,/g, ".");
    const match = text.match(/(?:Q\s*)?(\d+(?:\.\d{1,2})?)/);
    if (!match) return;
    const original = Number(match[1]);
    if (!Number.isFinite(original)) return;
    el.dataset.price = String(original);
    el.dataset.originalPrice = String(original);
    const final = original * (1 - percent / 100);
    el.innerHTML = `<span class="marynel-original-price">Q${original.toFixed(2)}</span> &nbsp; <strong>Q${final.toFixed(2)}</strong> <small class="marynel-discount-percent">-${percent}%</small>`;
  });

  // 3) Todos los productos/categorías publicados reciben el porcentaje.
  document.querySelectorAll(".product").forEach(card => addDiscountBadge(card, percent));

  // 4) También marcamos cualquier bloque de catálogo que use otras estructuras.
  document.querySelectorAll("[data-product], .product-card, .catalog-product").forEach(el => {
    if (!el.classList.contains("product")) addDiscountBadge(el, percent);
  });

  toast(`¡Código aceptado! Tu descuento es ${percent}% para todos los productos`);
}

function openSite() {
  authGate.classList.add("site-hidden");
  if (window.anime) {
    anime({ targets: ".hero-copy>*", translateY: [28, 0], opacity: [0, 1], delay: anime.stagger(90), duration: 850, easing: "easeOutExpo" });
    anime({ targets: ".hero-art", scale: [.94, 1], opacity: [0, 1], duration: 1000, easing: "easeOutExpo", delay: 200 });
    anime({ targets: ".brand img", rotate: [-25, 0], scale: [.7, 1], duration: 900, easing: "easeOutElastic(1,.6)" });
  }
}

function logout() {
  menuPanel.classList.remove("open");
  authGate.classList.remove("site-hidden");
  $("admin").hidden = true;
  authCode.value = "";
  authMessage("");
  currentCode = null;
  currentDiscount = 0;
  adminMode = false;
  tries = 0;
  document.querySelectorAll(".marynel-discount-badge").forEach(el => el.remove());
  setTimeout(() => authCode.focus(), 100);
}

async function authenticate() {
  const now = Date.now();
  if (now < lockedUntil) {
    authMessage(`Acceso bloqueado. Espera ${Math.ceil((lockedUntil - now) / 1000)} s.`, "auth-error");
    return;
  }

  const code = authCode.value.trim();
  if (!/^\d{8}$/.test(code)) {
    authMessage("Introduce exactamente 8 dígitos.", "auth-error");
    authCard.classList.remove("shake-auth"); void authCard.offsetWidth; authCard.classList.add("shake-auth");
    return;
  }

  if (code === MASTER_CODE) {
    tries = 0;
    adminMode = true;
    currentCode = code;
    currentDiscount = 0;
    authMessage("Acceso autorizado.", "auth-ok");
    openSite();
    openAdmin();
    toast("Llave maestra: administración autorizada");
    return;
  }

  try {
    authMessage("Verificando código…");

    // IMPORTANTE: ya no se usa signInAnonymously().
    // Esa era la causa del mensaje “No se pudo iniciar la sesión de Firebase”
    // cuando Anonymous Authentication no estaba habilitado en el proyecto.
    const result = await consumeCode(code);

    if (!result.ok) {
      tries++;
      authMessage(`${result.reason}${tries >= 5 ? "" : ` · quedan ${5 - tries} intentos`}`, "auth-error");
      authCode.value = "";
      if (tries >= 5) {
        tries = 0;
        lockedUntil = Date.now() + 30000;
        authMessage("Demasiados intentos. Espera 30 segundos.", "auth-error");
      }
      return;
    }

    tries = 0;
    currentCode = code;
    openSite();
    applyDiscount(result.discount);

  } catch (err) {
    console.error("Error validando código:", err);
    const msg = String(err?.message || err || "");
    if (/permission|insufficient/i.test(msg)) {
      authMessage("Firebase está rechazando el acceso a Firestore. Revisa las reglas de la colección marynel_codes.", "auth-error");
    } else {
      authMessage("No se pudo validar el código en Firebase. Comprueba tu conexión e inténtalo de nuevo.", "auth-error");
    }
  }
}

async function loadCodes() {
  try {
    const available = await getDocs(query(collection(db, CODES), where("status", "==", "available")));
    const used = await getDocs(query(collection(db, CODES), where("status", "==", "used")));
    $("availableCount").textContent = available.size;
    $("usedCount").textContent = used.size;
    $("codeList").innerHTML = "";
    available.docs.slice(0, 100).forEach(s => {
      const d = s.data();
      const row = document.createElement("div");
      row.className = "code-item";
      row.innerHTML = `<strong>${s.id}</strong> <span>${d.discount || 0}%</span>`;
      $("codeList").appendChild(row);
    });
  } catch (err) {
    console.error(err);
    toast("No se pudo leer Firestore");
  }
}

async function generateCodes() {
  const requested = Math.min(20, Math.max(1, Number($("quantity").value) || 20));
  try {
    const availableSnap = await getDocs(query(collection(db, CODES), where("status", "==", "available")));
    const needed = Math.min(requested, Math.max(0, TARGET_AVAILABLE - availableSnap.size));

    if (!needed) {
      toast("Ya hay 20 códigos disponibles");
      await loadCodes();
      return;
    }

    const existing = new Set(availableSnap.docs.map(d => d.id));
    const selected = [];

    while (selected.length < needed) {
      const code = randomCode();
      if (code === MASTER_CODE || existing.has(code)) continue;
      const ref = doc(db, CODES, code);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        existing.add(code);
        continue;
      }
      existing.add(code);
      selected.push({ code, ref, discount: randomDiscount() });
    }

    const batch = writeBatch(db);
    selected.forEach(({ ref, discount }) => batch.set(ref, {
      discount,
      status: "available",
      createdAt: serverTimestamp()
    }));
    await batch.commit();

    const verified = [];
    for (const item of selected) {
      const check = await getDoc(item.ref);
      if (check.exists() && check.data().status === "available") verified.push(item.code);
    }

    toast(`Se generaron y verificaron ${verified.length}/${selected.length} códigos`);
    await loadCodes();
  } catch (err) {
    console.error("Error generando códigos:", err);
    authMessage("No se pudieron guardar los códigos en Firestore.", "auth-error");
    toast("Error generando códigos en Firebase");
  }
}

async function randomizeAvailableDiscounts() {
  try {
    const available = await getDocs(query(collection(db, CODES), where("status", "==", "available")));
    if (!available.size) { toast("No hay códigos disponibles"); return; }
    const updates = available.docs.map(s => setDoc(doc(db, CODES, s.id), { discount: randomDiscount() }, { merge: true }));
    await Promise.all(updates);
    toast(`Se actualizaron ${available.size} códigos con descuentos del 5% al 50%`);
    await loadCodes();
  } catch (err) {
    console.error(err);
    toast("Error actualizando descuentos");
  }
}

function openAdmin() {
  if (!adminMode) { toast("Solo la llave maestra puede administrar"); return; }
  $("admin").hidden = false;
  $("admin").scrollIntoView({ behavior: "smooth", block: "start" });
  loadCodes();
}

function closeMenu() {
  menuPanel.classList.remove("open");
  menuBtn.setAttribute("aria-expanded", "false");
}

menuBtn.addEventListener("click", e => {
  e.stopPropagation();
  const open = menuPanel.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", e => {
  if (menuPanel.classList.contains("open") && !menuPanel.contains(e.target) && e.target !== menuBtn) closeMenu();
});
document.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", () => {
  $(btn.dataset.go)?.scrollIntoView({ behavior: "smooth", block: "start" });
  closeMenu();
}));
$("menuAvatar").addEventListener("click", () => { $("overlay").classList.add("show"); closeMenu(); });
$("menuLogout").addEventListener("click", logout);
$("adminMenu").addEventListener("click", () => { openAdmin(); closeMenu(); });
$("authBtn").addEventListener("click", authenticate);
authCode.addEventListener("keydown", e => { if (e.key === "Enter") authenticate(); });
$("imageBtn")?.addEventListener("click", () => $("overlay").classList.add("show"));
$("close")?.addEventListener("click", () => $("overlay").classList.remove("show"));
$("overlay")?.addEventListener("click", e => { if (e.target.id === "overlay") e.currentTarget.classList.remove("show"); });
$("heroArt")?.addEventListener("click", () => $("overlay").classList.add("show"));
$("generateBtn").addEventListener("click", generateCodes);
$("randomizeDiscountsBtn")?.addEventListener("click", randomizeAvailableDiscounts);

document.querySelectorAll(".product").forEach(card => {
  const head = card.querySelector(".product-head");
  head?.addEventListener("click", () => {
    card.classList.toggle("open");
    if (window.anime) anime({ targets: card, scale: [1.015, 1], duration: 300, easing: "easeOutQuad" });
  });
});

if (window.anime) {
  for (let i = 0; i < 20; i++) {
    const p = document.createElement("i");
    p.className = "particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.top = Math.random() * 100 + "%";
    document.body.appendChild(p);
    anime({ targets: p, translateY: [0, -(80 + Math.random() * 180)], translateX: (Math.random() - .5) * 90, opacity: [0, .65, 0], duration: 5000 + Math.random() * 5000, delay: Math.random() * 2500, loop: true, easing: "easeInOutSine" });
  }
}

authCode.focus();
