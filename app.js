// =========================
// CONFIGURACIÓN DE LA RAID
// =========================
// Cambia estas coordenadas por las tuyas.
// radio: metros necesarios para considerar que el usuario ha llegado.

const RAID_POINTS = [
  {
    id: 1,
    name: "Lugar 1",
    lat: 40.416775,
    lng: -3.703790,
    radius: 20,
    instruction: "Dirígete al Lugar 1. Cuando estés dentro del radio, se mostrará el mensaje.",
    messageTitle: "Has llegado al Lugar 1",
    messageBody: "Primer punto completado. Busca la siguiente pista y continúa hacia el Lugar 2."
  },
  {
    id: 2,
    name: "Lugar 2",
    lat: 40.417900,
    lng: -3.702500,
    radius: 20,
    instruction: "Ahora ve al Lugar 2. Mantente en movimiento hasta entrar en la zona.",
    messageTitle: "Has llegado al Lugar 2",
    messageBody: "Segundo punto completado. Ya solo te queda alcanzar el Lugar 3."
  },
  {
    id: 3,
    name: "Lugar 3",
    lat: 40.418700,
    lng: -3.704900,
    radius: 20,
    instruction: "Último punto. Acércate al Lugar 3 para completar la raid.",
    messageTitle: "Has llegado al Lugar 3",
    messageBody: "Enhorabuena. Has completado todos los lugares de la raid."
  }
];

// =========================
// ESTADO
// =========================

let watchId = null;
let currentIndex = 0;
let completedIds = new Set();
let lastPosition = null;
let deferredPrompt = null;
let gameActive = false;

// =========================
// ELEMENTOS UI
// =========================

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");
const continueBtn = document.getElementById("continueBtn");
const installBtn = document.getElementById("installBtn");

const currentPlaceName = document.getElementById("currentPlaceName");
const currentInstruction = document.getElementById("currentInstruction");
const distanceText = document.getElementById("distanceText");
const accuracyText = document.getElementById("accuracyText");
const statusEl = document.getElementById("status");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const placesList = document.getElementById("placesList");
const messageCard = document.getElementById("messageCard");
const messageTitle = document.getElementById("messageTitle");
const messageBody = document.getElementById("messageBody");
const finalCard = document.getElementById("finalCard");
const radarDot = document.getElementById("radarDot");
const raidStateBadge = document.getElementById("raidStateBadge");

// =========================
// INICIO
// =========================

document.addEventListener("DOMContentLoaded", init);

function init() {
  renderPlaces();
  updateUI();
  registerServiceWorker();
  setupInstallPrompt();

  startBtn.addEventListener("click", startGame);
  stopBtn.addEventListener("click", stopTracking);
  resetBtn.addEventListener("click", resetGame);
  continueBtn.addEventListener("click", handleContinue);
  installBtn.addEventListener("click", installApp);
}

// =========================
// PWA
// =========================

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.error("Error registrando Service Worker:", error);
    }
  }
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.classList.remove("hidden");
  });

  window.addEventListener("appinstalled", () => {
    installBtn.classList.add("hidden");
    deferredPrompt = null;
  });
}

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add("hidden");
}

// =========================
// JUEGO
// =========================

function startGame() {
  if (!("geolocation" in navigator)) {
    setStatus("Este dispositivo o navegador no soporta geolocalización.");
    return;
  }

  if (currentIndex >= RAID_POINTS.length) {
    setStatus("La raid ya está completada. Pulsa Reiniciar para empezar otra vez.");
    return;
  }

  gameActive = true;
  raidStateBadge.textContent = "En curso";
  setStatus("Solicitando permiso de ubicación...");

  watchId = navigator.geolocation.watchPosition(
    onPositionSuccess,
    onPositionError,
    {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000
    }
  );
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  gameActive = false;
  if (currentIndex < RAID_POINTS.length) {
    raidStateBadge.textContent = "Pausada";
  }
  setStatus("Seguimiento detenido.");
}

function resetGame() {
  stopTracking();
  currentIndex = 0;
  completedIds = new Set();
  lastPosition = null;
  gameActive = false;

  messageCard.classList.add("hidden");
  finalCard.classList.add("hidden");
  raidStateBadge.textContent = "Pendiente";

  renderPlaces();
  updateUI();
  setStatus("Raid reiniciada. Pulsa Empezar para comenzar.");
}

function handleContinue() {
  messageCard.classList.add("hidden");

  if (currentIndex >= RAID_POINTS.length) {
    finalCard.classList.remove("hidden");
    raidStateBadge.textContent = "Completada";
    setStatus("Has completado todos los lugares.");
    stopTracking();
    return;
  }

  updateUI();

  if (!gameActive) {
    startGame();
  }
}

// =========================
// GEOLOCALIZACIÓN
// =========================

function onPositionSuccess(position) {
  lastPosition = position;

  const { latitude, longitude, accuracy } = position.coords;
  accuracyText.textContent = `${Math.round(accuracy)} m`;

  if (currentIndex >= RAID_POINTS.length) {
    distanceText.textContent = "0 m";
    finalCard.classList.remove("hidden");
    raidStateBadge.textContent = "Completada";
    setStatus("Raid completada.");
    stopTracking();
    return;
  }

  const target = RAID_POINTS[currentIndex];
  const distance = haversineDistance(latitude, longitude, target.lat, target.lng);

  distanceText.textContent = formatDistance(distance);
  moveRadarDot(distance, target.radius);

  setStatus(
    `Ubicación detectada. Estás a ${Math.round(distance)} m de ${target.name}.`
  );

  if (distance <= target.radius) {
    unlockCurrentPoint();
  } else {
    updateUI(distance);
  }
}

function onPositionError(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      setStatus("Has denegado el permiso de ubicación. Sin ese permiso el juego no puede funcionar.");
      break;
    case error.POSITION_UNAVAILABLE:
      setStatus("No se pudo obtener la ubicación actual del dispositivo.");
      break;
    case error.TIMEOUT:
      setStatus("Se agotó el tiempo esperando la ubicación. Prueba de nuevo.");
      break;
    default:
      setStatus("Se produjo un error desconocido al leer la ubicación.");
      break;
  }
}

function unlockCurrentPoint() {
  const target = RAID_POINTS[currentIndex];

  if (!target || completedIds.has(target.id)) return;

  completedIds.add(target.id);
  currentIndex += 1;

  renderPlaces();
  updateProgress();
  showUnlockedMessage(target);
}

function showUnlockedMessage(point) {
  messageTitle.textContent = point.messageTitle;
  messageBody.textContent = point.messageBody;
  messageCard.classList.remove("hidden");

  if (currentIndex >= RAID_POINTS.length) {
    continueBtn.textContent = "Finalizar";
    setStatus(`Has completado ${point.name}. Raid terminada.`);
  } else {
    continueBtn.textContent = "Continuar";
    setStatus(`Has completado ${point.name}. Pulsa continuar para ir al siguiente.`);
  }
}

function updateUI(currentDistance = null) {
  updateProgress();

  if (currentIndex >= RAID_POINTS.length) {
    currentPlaceName.textContent = "Raid completada";
    currentInstruction.textContent = "Ya has desbloqueado todos los lugares.";
    distanceText.textContent = "0 m";
    finalCard.classList.remove("hidden");
    raidStateBadge.textContent = "Completada";
    return;
  }

  const target = RAID_POINTS[currentIndex];
  currentPlaceName.textContent = target.name;
  currentInstruction.textContent = target.instruction;

  if (typeof currentDistance === "number") {
    distanceText.textContent = formatDistance(currentDistance);
  } else {
    distanceText.textContent = "-- m";
  }
}

function updateProgress() {
  const total = RAID_POINTS.length;
  const completed = completedIds.size;
  const percent = (completed / total) * 100;

  progressText.textContent = `${completed} / ${total}`;
  progressFill.style.width = `${percent}%`;
}

function renderPlaces() {
  placesList.innerHTML = "";

  RAID_POINTS.forEach((point, index) => {
    const li = document.createElement("li");
    li.className = "place-item";

    if (completedIds.has(point.id)) {
      li.classList.add("done");
    }

    let stateText = "Pendiente";
    if (completedIds.has(point.id)) {
      stateText = "Completado";
    } else if (index === currentIndex) {
      stateText = "Actual";
    }

    li.innerHTML = `
      <div class="place-title">${point.name}</div>
      <div class="place-meta">
        Radio: ${point.radius} m · Estado: ${stateText}
      </div>
    `;

    placesList.appendChild(li);
  });
}

// =========================
// UTILIDADES
// =========================

function setStatus(text) {
  statusEl.textContent = text;
}

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

// Distancia entre dos coordenadas en metros
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Mueve el punto del radar: cuanto más lejos, más alejado del centro
function moveRadarDot(distance, radius) {
  const radarSize = 240;
  const center = radarSize / 2;
  const maxVisualDistance = 300; // metros a partir de los cuales se queda en el borde
  const clamped = Math.min(distance, maxVisualDistance);

  // 0 = centro, 1 = borde
  const ratio = clamped / maxVisualDistance;
  const maxOffset = 92;
  const offset = ratio * maxOffset;

  // Para simplificar, el punto se mueve verticalmente hacia el centro
  radarDot.style.left = `${center}px`;
  radarDot.style.top = `${center - offset}px`;

  // Si ya está dentro del radio, que se vea totalmente centrado
  if (distance <= radius) {
    radarDot.style.left = `${center}px`;
    radarDot.style.top = `${center}px`;
  }
}