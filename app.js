/*
  MARYNEL - Autenticación local de prueba
  ---------------------------------------
  Código de prueba: 48271935

  El código NO aparece escrito completo.
  Regla: cada fragmento contiene una letra "l" seguida
  por el dígito correspondiente. Se reconstruye en orden.
  Esto es OFUSCACIÓN, no seguridad criptográfica.
*/
const partes = [
  "l4x","al8","ml2q","l7z","pl1","l9k","l3r","l5"
];

function reconstruirCodigo(){
  return partes.map(p=>{
    const i=p.indexOf("l");
    return p.charAt(i+1);
  }).join("");
}

const codigoCorrecto = reconstruirCodigo();
let intentos=0;
const MAX_INTENTOS=5;
let bloqueadoHasta=0;

const input=document.getElementById("codeInput");
const btn=document.getElementById("loginBtn");
const msg=document.getElementById("message");
const login=document.getElementById("loginCard");
const welcome=document.getElementById("welcomeCard");
const box=document.getElementById("codeBox");

function mensaje(texto,tipo=""){
  msg.textContent=texto;
  msg.className="message "+tipo;
}

function verificar(){
  const ahora=Date.now();
  if(ahora<bloqueadoHasta){
    const s=Math.ceil((bloqueadoHasta-ahora)/1000);
    mensaje(`Espera ${s} segundos para volver a intentar.`,"error");
    return;
  }

  const codigo=input.value.trim();
  if(!/^\d{8}$/.test(codigo)){
    mensaje("Introduce exactamente 8 dígitos.","error");
    box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
    return;
  }

  if(codigo===codigoCorrecto){
    mensaje("");
    login.classList.add("hidden");
    welcome.classList.remove("hidden");
    return;
  }

  intentos++;
  input.value="";
  box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");

  if(intentos>=MAX_INTENTOS){
    bloqueadoHasta=Date.now()+30000;
    intentos=0;
    mensaje("Demasiados intentos. Bloqueado 30 segundos.","error");
  }else{
    mensaje(`Código incorrecto · quedan ${MAX_INTENTOS-intentos} intentos.`,"error");
  }
  input.focus();
}

btn.addEventListener("click",verificar);
input.addEventListener("keydown",e=>{if(e.key==="Enter")verificar();});

document.getElementById("logoutBtn").addEventListener("click",()=>{
  welcome.classList.add("hidden");
  login.classList.remove("hidden");
  input.value="";
  mensaje("");
  input.focus();
});

document.getElementById("colorBtn").addEventListener("click",()=>{
  document.body.classList.toggle("alt");
});

document.getElementById("bounceBtn").addEventListener("click",()=>{
  welcome.classList.remove("bounce");
  void welcome.offsetWidth;
  welcome.classList.add("bounce");
});

document.getElementById("brandMark").addEventListener("click",e=>{
  e.currentTarget.style.transform="rotate(360deg) scale(1.12)";
  setTimeout(()=>e.currentTarget.style.transform="",450);
});

// Partículas ligeras, sin librerías externas.
const particles=document.getElementById("particles");
for(let i=0;i<22;i++){
  const p=document.createElement("span");
  p.className="particle";
  p.style.left=Math.random()*100+"%";
  p.style.animationDuration=(5+Math.random()*8)+"s";
  p.style.animationDelay=(-Math.random()*10)+"s";
  p.style.opacity=(.25+Math.random()*.5);
  particles.appendChild(p);
}
input.focus();
