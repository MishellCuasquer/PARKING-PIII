/**
 * Script de carga para probar el caché Redis de ms-vehiculos.
 *
 * 1. Obtiene un token del ms de usuarios (admin/admin123 por defecto).
 * 2. Inserta ~500 vehículos vía POST /vehiculos.
 * 3. Prueba el caché: consulta placas dos veces y compara tiempos
 *    (la 1ra va a Postgres, la 2da sale de Redis).
 *
 * Uso:  node scripts/seed-vehiculos.js [total]
 * Requiere Node 18+ (usa fetch nativo) y el stack levantado (docker compose up -d).
 */

// Acepta --count=N (estilo npm run seed:vehiculos -- --count=20) o un numero posicional
function leerTotal() {
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--count=(\d+)$/);
    if (m) return Number(m[1]);
    if (/^\d+$/.test(arg)) return Number(arg);
  }
  return 500;
}
const TOTAL = leerTotal();
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:8080/api/oauth/token';
const VEHICULOS_URL = process.env.VEHICULOS_URL || 'http://localhost:3000/vehiculos';
const USERNAME = process.env.SEED_USER || 'admin';
const PASSWORD = process.env.SEED_PASSWORD || 'admin123';
const BATCH = 20; // peticiones en paralelo

const MARCAS = ['Toyota', 'Chevrolet', 'Kia', 'Hyundai', 'Mazda', 'Nissan', 'Ford', 'Renault'];
const MODELOS = ['Corolla', 'Sail', 'Rio', 'Accent', 'Tres', 'Sentra', 'Fiesta', 'Logan'];
const COLORES = ['Rojo', 'Azul', 'Negro', 'Blanco', 'Gris', 'Verde'];
const CLASIFICACIONES = ['Diesel', 'Gasolina', 'Eléctrico', 'Híbrido'];

function placaDe(i) {
  const l2 = String.fromCharCode(65 + (Math.floor(i / 26) % 26));
  const l3 = String.fromCharCode(65 + (i % 26));
  return `V${l2}${l3}-${1000 + i}`;
}

function vehiculoDe(i) {
  return {
    tipo: 'auto',
    datos: {
      placa: placaDe(i),
      marca: MARCAS[i % MARCAS.length],
      modelo: MODELOS[i % MODELOS.length],
      color: COLORES[i % COLORES.length],
      anio: 2000 + (i % 26),
      clasificacion: CLASIFICACIONES[i % CLASIFICACIONES.length],
      numeroPuertas: 2 + (i % 4),
      CapacidadMaletero: 100 + (i % 900),
    },
  };
}

async function obtenerToken() {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'password', username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`No se pudo obtener token (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function crearVehiculo(token, i) {
  const res = await fetch(VEHICULOS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(vehiculoDe(i)),
  });
  if (res.status === 201 || res.status === 200) return 'creado';
  if (res.status === 409) return 'existia';
  const detalle = await res.text();
  throw new Error(`POST vehiculo ${placaDe(i)} fallo (${res.status}): ${detalle}`);
}

async function consultarPlaca(token, placa) {
  const inicio = process.hrtime.bigint();
  const res = await fetch(`${VEHICULOS_URL}/placa/${encodeURIComponent(placa)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await res.json();
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
  if (!res.ok) throw new Error(`GET placa ${placa} fallo (${res.status})`);
  return ms;
}

async function main() {
  console.log(`Obteniendo token como '${USERNAME}'...`);
  const token = await obtenerToken();
  console.log('Token OK\n');

  console.log(`Insertando ${TOTAL} vehiculos en lotes de ${BATCH}...`);
  let creados = 0;
  let existian = 0;
  for (let inicio = 0; inicio < TOTAL; inicio += BATCH) {
    const lote = [];
    for (let i = inicio; i < Math.min(inicio + BATCH, TOTAL); i++) {
      lote.push(crearVehiculo(token, i));
    }
    const resultados = await Promise.all(lote);
    creados += resultados.filter((r) => r === 'creado').length;
    existian += resultados.filter((r) => r === 'existia').length;
    if ((inicio + BATCH) % 100 === 0 || inicio + BATCH >= TOTAL) {
      console.log(`  ${Math.min(inicio + BATCH, TOTAL)}/${TOTAL} procesados`);
    }
  }
  console.log(`\nResultado: ${creados} creados, ${existian} ya existian\n`);

  console.log('Probando el cache (50 placas, 1ra vez = Postgres, 2da vez = Redis)...');
  const muestra = Array.from({ length: 50 }, (_, k) => placaDe(k * Math.floor(TOTAL / 50)));

  let totalSinCache = 0;
  for (const placa of muestra) totalSinCache += await consultarPlaca(token, placa);

  let totalConCache = 0;
  for (const placa of muestra) totalConCache += await consultarPlaca(token, placa);

  console.log(`  Sin cache (1ra consulta): ${(totalSinCache / muestra.length).toFixed(2)} ms promedio`);
  console.log(`  Con cache (2da consulta): ${(totalConCache / muestra.length).toFixed(2)} ms promedio`);
  console.log('\nListo. Verifica las claves en Redis con:');
  console.log('  docker exec parking-redis redis-cli KEYS "vehiculo:*"');
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
