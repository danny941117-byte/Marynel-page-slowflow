import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
const auth = getAuth(app);
const firebaseAuthReady = signInAnonymously(auth).catch(err => {
  console.error("Error de autenticación anónima:", err);
  return null;
});

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
  toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function randomCode() {
  let code = "";
  for (let i = 0; i < 8; i++) code += Math.floor(Math.random() * 10);
  return code;
}

// Descuentos variables: cualquier valor entero entre 5% y 50%.
function randomDiscount() {
  return Math.floor(Math.random() * 46) + 5;
}

async function consumeCode(code) {
  const ref = doc(db, CODES, code);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      return {
        ok: false,
        reason: "Código no registrado en Firebase. Genera el código desde el panel y verifica que aparezca en la lista."
      };
    }
    const data = snap.data();
    if (data.status !== "available") return { ok: false, reason: "Este código ya fue utilizado." };

    let replacement = randomCode();
    while (replacement === MASTER_CODE) replacement = randomCode();
    let replacementRef = doc(db, CODES, replacement);
    for (let i = 0; i < 8; i++) {
      const existing = await tx.get(replacementRef);
      if (!existing.exists()) break;
      replacement = randomCode();
      while (replacement === MASTER_CODE) replacement = randomCode();
      replacementRef = doc(db, CODES, replacement);
      if (i === 7) throw new Error("No se pudo generar un código único.");
    }

    const discount = Number(data.discount || 0);
    const replacementDiscount = randomDiscount();
    tx.update(ref, { status: "used", usedAt: serverTimestamp() });
    tx.set(replacementRef, { discount: replacementDiscount, status: "available", createdAt: serverTimestamp(), replacementOf: code });
    return { ok: true, discount, replacement, replacementDiscount };
  });
}

function applyDiscount(percent) {
  document.querySelectorAll(".price[data-price]").forEach(el => {
    const original = Number(el.dataset.price);
    const final = original * (1 - percent / 100);
    el.innerHTML = `<span style="text-decoration:line-through;color:#71829b;font-size:13px">Q${original.toFixed(2)}</span> &nbsp; Q${final.toFixed(2)} <small style="color:#63eca0">-${percent}%</small>`;
  });
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
    const session = await firebaseAuthReady;
    if (!session) {
      authMessage("No se pudo iniciar la sesión de Firebase.", "auth-error");
      return;
    }
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
    currentDiscount = result.discount;
    openSite();
    applyDiscount(result.discount);
    toast(`¡Código aceptado! Tu descuento es ${result.discount}%`);
  } catch (err) {
    console.error(err);
    authMessage("No se pudo conectar con Firestore.", "auth-error");
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
    // Solo se cuentan códigos realmente disponibles.
    const availableSnap = await getDocs(
      query(collection(db, CODES), where("status", "==", "available"))
    );

    const needed = Math.min(
      requested,
      Math.max(0, TARGET_AVAILABLE - availableSnap.size)
    );

    if (!needed) {
      toast("Ya hay 20 códigos disponibles");
      await loadCodes();
      return;
    }

    // Evita reutilizar cualquier ID que ya exista (disponible o usado).
    const existing = new Set(availableSnap.docs.map(d => d.id));
    const selected = [];

    while (selected.length < needed) {
      const code = randomCode();
      if (existing.has(code)) continue;

      const ref = doc(db, CODES, code);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        existing.add(code);
        continue;
      }

      existing.add(code);
      selected.push({ code, ref, discount: randomDiscount() });
    }

    // Escritura en lote: los códigos se crean todos juntos.
    const batch = writeBatch(db);
    selected.forEach(({ ref, discount }) => {
      batch.set(ref, {
        discount,
        status: "available",
        createdAt: serverTimestamp()
      });
    });

    await batch.commit();

    // Verificación real: no mostramos "generado" hasta confirmar que
    // Firestore puede leer los códigos que acabamos de crear.
    const verified = [];
    for (const item of selected) {
      const check = await getDoc(item.ref);
      if (check.exists() && check.data().status === "available") {
        verified.push(item.code);
      }
    }

    if (verified.length !== selected.length) {
      console.error("Verificación incompleta:", { selected, verified });
      toast(`Advertencia: ${verified.length}/${selected.length} códigos confirmados`);
    } else {
      toast(`Se generaron y verificaron ${verified.length} códigos`);
    }

    await loadCodes();
  } catch (err) {
    console.error("Error generando códigos:", err);
    authMessage?.("No se pudieron guardar los códigos en Firestore.", "auth-error");
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

// Partículas decorativas: se crean una sola vez.
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
