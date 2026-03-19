const puntos = [
    { lat: 40.4167, lon: -3.7033, pista: "Donde el oso y el madroño descansan.", msj: "¡Bienvenido a la Puerta del Sol!" },
    { lat: 40.4131, lon: -3.6830, pista: "Un retiro verde en medio de la ciudad.", msj: "¡Estás en el Parque del Retiro!" },
    { lat: 40.4239, lon: -3.7121, pista: "Un templo egipcio que mira al atardecer.", msj: "¡Increíble, llegaste al Templo de Debod!" }
];

let indiceActual = 0;
let userCoords = null;
let targetHeading = 0;

const btnGPS = document.getElementById('btnGPS');
const btnCompass = document.getElementById('btnCompass');
const arrow = document.getElementById('arrow');

// --- PASO 1: GPS ---
btnGPS.addEventListener('click', () => {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(pos => {
            userCoords = pos.coords;
            actualizarJuego();
            btnCompass.disabled = false;
            btnGPS.innerText = "GPS Activo ✅";
        }, err => alert("Error GPS: " + err.message), { enableHighAccuracy: true });
    }
});

// --- PASO 2: Brújula (Orientación) ---
btnCompass.addEventListener('click', async () => {
    // iOS requiere permiso explícito
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') window.addEventListener('deviceorientationabsolute', handlerOrientation, true);
    } else {
        window.addEventListener('deviceorientation', handlerOrientation, true);
    }
    btnCompass.innerText = "Brújula Activa ✅";
});

function handlerOrientation(event) {
    // heading es hacia donde mira el móvil (0 = Norte)
    let heading = event.webkitCompassHeading || (360 - event.alpha);
    
    if (userCoords) {
        // Calculamos el ángulo hacia el destino
        const angleToTarget = calcularRumbo(userCoords.latitude, userCoords.longitude, puntos[indiceActual].lat, puntos[indiceActual].lon);
        // La flecha debe girar la diferencia entre hacia donde miro y donde está el punto
        const arrowRotation = angleToTarget - heading;
        arrow.style.transform = `rotate(${arrowRotation}deg)`;
    }
}

function actualizarJuego() {
    const p = puntos[indiceActual];
    document.getElementById('hint').innerText = `Pista: ${p.pista}`;
    
    const dist = calcularDistancia(userCoords.latitude, userCoords.longitude, p.lat, p.lon);
    document.getElementById('distance').innerText = `Distancia: ${Math.round(dist)} m`;

    if (dist < 20) { // Si está a menos de 20 metros
        alert(p.msj);
        indiceActual++;
        if (indiceActual >= puntos.length) {
            alert("¡Has terminado el juego!");
            indiceActual = 0;
        }
    }
}

// Fórmulas matemáticas (Haversine y Rumbo)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcularRumbo(lat1, lon1, lat2, lon2) {
    const y = Math.sin((lon2-lon1) * Math.PI/180) * Math.cos(lat2 * Math.PI/180);
    const x = Math.cos(lat1 * Math.PI/180) * Math.sin(lat2 * Math.PI/180) -
              Math.sin(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.cos((lon2-lon1) * Math.PI/180);
    return (Math.atan2(y, x) * 180/Math.PI + 360) % 360;
}