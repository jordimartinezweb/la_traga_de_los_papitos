// ===== BOTONES =====
const btnStart = document.getElementById("btnStart");
const btnStop  = document.getElementById("btnStop");

// ===== TEXTO INTENTOS =====
const triesLabel = document.getElementById("triesLabel");

// ===== OVERLAY =====
const overlay = document.getElementById("overlay");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalBtn = document.getElementById("modalBtn");

// ===== RODILLOS =====
const reels = [
  document.querySelector('.reel[data-reel="0"]'),
  document.querySelector('.reel[data-reel="1"]'),
  document.querySelector('.reel[data-reel="2"]')
];

const slots = reels.map(reel => [...reel.querySelectorAll(".slot")]);

let spinning = false;
let stopIndex = 0;
let timers = [null, null, null];
let stopping = false;

let board = [[], [], []];

const MAX_TIRADAS = 5;
let tiradasRestantes = MAX_TIRADAS;

function renderTries(){
  triesLabel.textContent = `Intentos disponibles: ${tiradasRestantes}`;
}

// ===== CARAS =====
const faces = [
  "carlos", "fito", "juan", "bayona", "aaron", "abel", "alberto",
  "alex", "belen", "chanza", "eric", "juanma", "manel", "marti",
  "martinn", "morente", "omar", "oriol", "osel", "sergi", "sergio", "tamo"
];

function rand(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

// ===== SÍMBOLOS =====
const SYMBOLS = [
  { code: "CIRC_VERDE",        w: 30 },
  { code: "CIRC_AZUL",         w: 30 },
  { code: "ROMBO_MORADO",      w: 24 },
  { code: "HEX_AMARILLO",      w: 24 },
  { code: "ROMBO_AZUL",        w: 20 },
  { code: "ESTRELLA_AMARILLA", w: 20 },
  { code: "TRIANGULO",         w: 16 },
  { code: "CORAZON",           w: 16 },
  { code: "ESCUDO",            w: 7  },
];

function pickWeightedSymbol() {
  const total = SYMBOLS.reduce((sum, s) => sum + s.w, 0);
  let r = Math.random() * total;
  for (const s of SYMBOLS) {
    r -= s.w;
    if (r <= 0) return s.code;
  }
  return SYMBOLS[SYMBOLS.length - 1].code;
}

// ===== PAYTABLE =====
const PAYTABLE = {
  CIRC_VERDE:        { text: "🥃 1 CHUPITO" },
  CIRC_AZUL:         { text: "🥃 1 CHUPITO" },
  ROMBO_MORADO:      { text: "🥃🥃 2 CHUPITOS" },
  HEX_AMARILLO:      { text: "🥃🥃 2 CHUPITOS" },
  ROMBO_AZUL:        { text: "🥤 1 CERVEZA" },
  ESTRELLA_AMARILLA: { text: "🥤 1 CERVEZA" },
  TRIANGULO:         { text: "🥤🥤 2 CERVEZAS" },
  CORAZON:           { text: "🥤🥤 2 CERVEZAS" },
  ESCUDO:            { text: "👑 CUBATA 👑" }
};

// ===== MODAL =====
function showModal(title, body, btnText = "Continuar"){
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalBtn.textContent = btnText;
  overlay.classList.remove("hidden");
}

function hideModal(){
  overlay.classList.add("hidden");
}

modalBtn.addEventListener("click", () => {
  hideModal();
  if (tiradasRestantes <= 0 && !spinning){
    resetGame(true);
  }
});

// ===== HIGHLIGHT =====
function clearWinHighlight(){
  slots.flat().forEach(s => s.classList.remove("win"));
}

function highlightSlots(coords){
  coords.forEach(([col,row]) => {
    const el = slots[col]?.[row];
    if (el) el.classList.add("win");
  });
}

// ===== PINTAR SLOT =====
function paintSlot(slotEl, symbolCode, faceCode){
  let symbolImg = slotEl.querySelector("img.symbol");
  let faceImg   = slotEl.querySelector("img.face");

  if(!symbolImg){
    symbolImg = document.createElement("img");
    symbolImg.className = "symbol";
    slotEl.appendChild(symbolImg);
  }

  if(!faceImg){
    faceImg = document.createElement("img");
    faceImg.className = "face";
    slotEl.appendChild(faceImg);
  }

  symbolImg.src = `img/symbols/${symbolCode}.png`;
  faceImg.src = `img/faces/${faceCode}.png`;
}

// ===== GIRO =====
function startFakeSpin(reelIndex){
  if (timers[reelIndex]) clearInterval(timers[reelIndex]);

  timers[reelIndex] = setInterval(() => {
    slots[reelIndex].forEach(slot => {
      paintSlot(slot, pickWeightedSymbol(), rand(faces));
    });
  }, 40);
}

function stopFakeSpin(reelIndex){
  if (timers[reelIndex]){
    clearInterval(timers[reelIndex]);
    timers[reelIndex] = null;
  }
}

function stopAllSpins(){
  for (let i = 0; i < 3; i++) stopFakeSpin(i);
}

function generateFinalColumn(){
  return [
    { symbol: pickWeightedSymbol(), face: rand(faces) },
    { symbol: pickWeightedSymbol(), face: rand(faces) },
    { symbol: pickWeightedSymbol(), face: rand(faces) },
  ];
}

function sleep(ms){
  return new Promise(res => setTimeout(res, ms));
}

async function slowStop(reelIndex){
  stopFakeSpin(reelIndex);

  const finalCol = generateFinalColumn();
  board[reelIndex] = finalCol;

  const steps = [60, 80, 110, 150, 170, 200, 220, 250, 270, 300,];

  for (const ms of steps){
    slots[reelIndex].forEach(slot => {
      paintSlot(slot, pickWeightedSymbol(), rand(faces));
    });
    await sleep(ms);
  }

  for (let r = 0; r < 3; r++){
    paintSlot(slots[reelIndex][r], finalCol[r].symbol, finalCol[r].face);
  }
}

// ===== PARADA AUTOMÁTICA SECUENCIAL =====
async function autoStopSequence() {
  if (!spinning || stopping) return;

  stopping = true;
  btnStop.disabled = true;

  await slowStop(0);
  await sleep(120);

  await slowStop(1);
  await sleep(120);

  await slowStop(2);

  stopIndex = 3;
  stopping = false;
  spinning = false;

  btnStart.disabled = false;
  btnStop.disabled = true;

  stopAllSpins();

  const result = evaluateBoard();
  finishSpin(result);
}

// ===== EVALUACIÓN =====
function getLinesWithCoords(){
  return [
    { coords: [[0,0],[1,0],[2,0]], cells: [board[0][0], board[1][0], board[2][0]] },
    { coords: [[0,1],[1,1],[2,1]], cells: [board[0][1], board[1][1], board[2][1]] },
    { coords: [[0,2],[1,2],[2,2]], cells: [board[0][2], board[1][2], board[2][2]] },
    { coords: [[0,0],[1,1],[2,2]], cells: [board[0][0], board[1][1], board[2][2]] },
    { coords: [[0,2],[1,1],[2,0]], cells: [board[0][2], board[1][1], board[2][0]] },
  ];
}

function evaluateBoard(){
  const lines = getLinesWithCoords();

  for (let i = 0; i < lines.length; i++){
    const { coords, cells } = lines[i];

    if (
      cells[0] && cells[1] && cells[2] &&
      cells[0].symbol === cells[1].symbol &&
      cells[1].symbol === cells[2].symbol
    ){
      return { win: true, best: cells[0].symbol, coords };
    }
  }

  return { win: false, best: null, coords: null };
}

// ===== START =====
btnStart.addEventListener("click", () => {
  if (spinning || stopping) return;

  if (tiradasRestantes <= 0){
    showModal("🎮 Fin del juego", "No quedan intentos. Pulsa CONTINUAR para reiniciar.", "CONTINUAR");
    return;
  }

  hideModal();
  clearWinHighlight();

  spinning = true;
  stopIndex = 0;
  board = [[], [], []];

  btnStart.disabled = true;
  btnStop.disabled = false;

  for (let i = 0; i < 3; i++){
    startFakeSpin(i);
  }
});

// ===== STOP (UNA SOLA PULSACIÓN) =====
btnStop.addEventListener("click", async () => {
  if (!spinning || stopping) return;
  await autoStopSequence();
});

// ===== FIN =====
function finishSpin(result){
  tiradasRestantes--;
  renderTries();

  if (!result.win){
    clearWinHighlight();

    if (tiradasRestantes <= 0){
      showModal("🎮 Fin del juego", "No quedan intentos.", "CONTINUAR");
    }
    return;
  }

  highlightSlots(result.coords);

  const premio = PAYTABLE[result.best]?.text || "🎉 PREMIO";
  showModal("🎉 ¡PREMIO!", premio, "SEGUIR");
}

// ===== RESET =====
function resetGame(resetHard = false){
  stopAllSpins();

  spinning = false;
  stopping = false;
  stopIndex = 0;
  board = [[], [], []];

  if (resetHard){
    tiradasRestantes = MAX_TIRADAS;
  }

  btnStart.disabled = false;
  btnStop.disabled = true;

  hideModal();
  clearWinHighlight();
  renderTries();
}

renderTries();