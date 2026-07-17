/**
 * Script de carga de tickets para ms-tickets.
 *
 * 1. Obtiene un token de admin del ms de usuarios.
 * 2. Lee espacios DISPONIBLES, vehiculos y personas reales del sistema.
 * 3. Emite tickets vía POST /tickets. Como cada ticket ocupa un espacio,
 *    la mayoría se cierran de inmediato (PATCH /tickets/:id/cerrar) con una
 *    salida aleatoria de 1-8 horas: eso libera el espacio para el siguiente
 *    ticket y genera valorRecaudo realista. Unos pocos quedan activos.
 *
 * Uso:  node scripts/seed-tickets.js --count=50
 *       node scripts/seed-tickets.js 50
 *       npm run seed:tickets -- --count=50
 * Requiere Node 18+ (fetch nativo) y el stack levantado (docker compose up -d).
 */

function leerCount() {
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--count=(\d+)$/);
    if (m) return Number(m[1]);
    if (/^\d+$/.test(arg)) return Number(arg);
  }
  return 20;
}

const TOTAL = leerCount();
const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const USERNAME = process.env.SEED_USER || 'admin';
const PASSWORD = process.env.SEED_PASSWORD || 'admin123';
const MAX_ACTIVOS = Number(process.env.SEED_ACTIVOS || 3);

async function pedir(ruta, opciones = {}) {
  const res = await fetch(`${BASE_URL}${ruta}`, opciones);
  const texto = await res.text();
  let data = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = texto;
  }
  return { ok: res.ok, status: res.status, data };
}

function conAuth(token, body) {
  return {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  };
}

function aleatorio(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

async function main() {
  console.log(`Obteniendo token como '${USERNAME}'...`);
  const login = await pedir('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!login.ok) throw new Error(`Login fallo (${login.status}): ${JSON.stringify(login.data)}`);
  const token = login.data.token;
  console.log('Token OK\n');

  const [espaciosRes, vehiculosRes, personasRes] = await Promise.all([
    pedir('/api/espacios'),
    pedir('/vehiculos', conAuth(token)),
    pedir('/api/personas', conAuth(token)),
  ]);
  if (!espaciosRes.ok) throw new Error(`GET espacios fallo (${espaciosRes.status})`);
  if (!vehiculosRes.ok) throw new Error(`GET vehiculos fallo (${vehiculosRes.status})`);
  if (!personasRes.ok) throw new Error(`GET personas fallo (${personasRes.status})`);

  const pool = espaciosRes.data.filter((e) => e.estado === 'DISPONIBLE').map((e) => e.id);
  const placas = vehiculosRes.data.map((v) => v.placa);
  const dnis = personasRes.data.map((p) => p.dni);

  console.log(`Espacios disponibles: ${pool.length} | Vehiculos: ${placas.length} | Personas: ${dnis.length}`);
  if (pool.length === 0) throw new Error('No hay espacios DISPONIBLES; crea o libera espacios primero');
  if (placas.length === 0) throw new Error('No hay vehiculos; corre primero seed-vehiculos.js');
  if (dnis.length === 0) throw new Error('No hay personas registradas');

  console.log(`\nEmitiendo ${TOTAL} tickets (max ${MAX_ACTIVOS} quedaran activos)...`);
  let creados = 0;
  let cerrados = 0;
  let activos = 0;
  let errores = 0;
  let recaudoTotal = 0;

  for (let i = 0; i < TOTAL; i++) {
    const idEspacio = pool.shift();
    const creacion = await pedir('/tickets', conAuth(token, {
      placa: aleatorio(placas),
      dni: aleatorio(dnis),
      idEspacio,
    }));

    if (!creacion.ok) {
      errores++;
      pool.push(idEspacio);
      console.log(`  [${i + 1}/${TOTAL}] ERROR (${creacion.status}): ${JSON.stringify(creacion.data).slice(0, 120)}`);
      continue;
    }
    creados++;

    // Se cierra el ticket salvo que aun haya cupo de activos y queden espacios libres
    const dejarActivo = activos < MAX_ACTIVOS && pool.length > 0;
    if (dejarActivo) {
      activos++;
    } else {
      const salida = new Date(Date.now() + (1 + Math.random() * 7) * 3600 * 1000).toISOString();
      const cierre = await pedir(`/tickets/${creacion.data.id}/cerrar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fechhaHoraSalida: salida }),
      });
      if (cierre.ok) {
        cerrados++;
        recaudoTotal += Number(cierre.data.valorRecaudo || 0);
        pool.push(idEspacio); // el espacio quedo libre otra vez
      } else {
        errores++;
        console.log(`  [${i + 1}/${TOTAL}] ticket creado pero no se pudo cerrar (${cierre.status})`);
      }
    }

    if ((i + 1) % 10 === 0 || i + 1 === TOTAL) {
      console.log(`  ${i + 1}/${TOTAL} procesados`);
    }
    if (pool.length === 0) {
      console.log('  No quedan espacios libres; deteniendo antes de tiempo');
      break;
    }
  }

  console.log('\nResumen:');
  console.log(`  Tickets creados : ${creados}`);
  console.log(`  Cerrados        : ${cerrados} (recaudo total $${recaudoTotal.toFixed(2)})`);
  console.log(`  Activos         : ${activos}`);
  console.log(`  Errores         : ${errores}`);
  console.log('\nVerifica en el front (http://localhost:5173/tickets) o con:');
  console.log(`  curl -H "Authorization: Bearer <token>" ${BASE_URL}/tickets`);
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
