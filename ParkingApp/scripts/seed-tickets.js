/**
 * Seeder de tickets con la cadena completa de dependencias.
 *
 * Un ticket exige placa registrada + persona con cedula + espacio DISPONIBLE,
 * asi que este script crea todo en orden:
 *   1. Token de admin (ms usuarios).
 *   2. N personas nuevas (POST /api/personas).
 *   3. N vehiculos nuevos (POST /vehiculos).
 *   4. Una zona demo con N espacios creados automaticamente (POST /api/zonas).
 *   5. N tickets, uno por vehiculo/persona/espacio (POST /tickets).
 *   6. Cierra una parte (PATCH /tickets/:id/cerrar) para generar valorRecaudo;
 *      el resto queda activo ocupando su espacio.
 *
 * Uso:  node scripts/seed-tickets.js --count=20
 *       npm run seed:tickets -- --count=20
 * Requiere Node 18+ (fetch nativo) y el stack levantado (docker compose up -d).
 *
 * Multitenant: todos los datos quedan en el tenant del usuario con el que se
 * hace login (claim tenantId del JWT). Para sembrar otra empresa basta con
 * usar el admin de esa empresa:
 *   SEED_USER=adminNorte SEED_PASSWORD=claveNorte npm run seed:tickets
 * El admin semilla (admin/admin123) pertenece al tenant "Parqueadero Default".
 */

function leerCount() {
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--count=(\d+)$/);
    if (m) return Number(m[1]);
    if (/^\d+$/.test(arg)) return Number(arg);
  }
  return 20;
}

const TOTAL = Math.min(leerCount(), 1000); // capacidad maxima de una zona
const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const USERNAME = process.env.SEED_USER || 'admin';
const PASSWORD = process.env.SEED_PASSWORD || 'admin123';
const PORCENTAJE_CERRADOS = Number(process.env.SEED_CERRADOS || 0.6);

const NOMBRES = ['Ana', 'Luis', 'Maria', 'Jose', 'Carla', 'Pedro', 'Lucia', 'Diego', 'Sofia', 'Andres'];
const APELLIDOS = ['Paz', 'Vera', 'Soto', 'Rios', 'Mora', 'Lara', 'Cruz', 'Leon', 'Vega', 'Nunez'];
const MARCAS = ['Toyota', 'Chevrolet', 'Kia', 'Hyundai', 'Mazda', 'Nissan', 'Ford', 'Renault'];
const MODELOS = ['Corolla', 'Sail', 'Rio', 'Accent', 'Tres', 'Sentra', 'Fiesta', 'Logan'];
const COLORES = ['Rojo', 'Azul', 'Negro', 'Blanco', 'Gris', 'Verde'];
const CLASIFICACIONES = ['Diesel', 'Gasolina', 'Eléctrico', 'Híbrido'];

// Sufijo por corrida para que dni/placa/email no choquen entre ejecuciones
const LOTE = String(Date.now()).slice(-6);

async function pedir(ruta, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${ruta}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let data = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = texto;
  }
  return { ok: res.ok, status: res.status, data };
}

function detalle(respuesta) {
  return JSON.stringify(respuesta.data).slice(0, 140);
}

function personaDe(i) {
  const dni = `9${LOTE}${String(i).padStart(3, '0')}`; // 10 digitos, unico por corrida
  return {
    dni,
    firstName: NOMBRES[i % NOMBRES.length],
    lastName: APELLIDOS[i % APELLIDOS.length],
    email: `seed.${dni}@parking.local`,
    phone: `09${LOTE}${String(i).padStart(2, '0')}`,
    nationality: 'EC',
  };
}

function placaDe(i) {
  const l1 = String.fromCharCode(65 + (i % 26));
  const l2 = String.fromCharCode(65 + (Math.floor(i / 26) % 26));
  return `S${l1}${l2}-${1000 + (Number(LOTE.slice(-3)) + i) % 9000}`;
}

function vehiculoDe(i) {
  return {
    tipo: 'auto',
    datos: {
      placa: placaDe(i),
      marca: MARCAS[i % MARCAS.length],
      modelo: MODELOS[i % MODELOS.length],
      color: COLORES[i % COLORES.length],
      anio: 2005 + (i % 20),
      clasificacion: CLASIFICACIONES[i % CLASIFICACIONES.length],
      numeroPuertas: 2 + (i % 4),
      CapacidadMaletero: 150 + (i % 800),
    },
  };
}

async function main() {
  console.log(`Seed de tickets con cadena completa — count=${TOTAL}\n`);

  console.log(`Obteniendo token como '${USERNAME}'...`);
  const login = await pedir('/api/auth/login', {
    method: 'POST',
    body: { username: USERNAME, password: PASSWORD },
  });
  if (!login.ok) throw new Error(`Login fallo (${login.status}): ${detalle(login)}`);
  const token = login.data.token;
  console.log('Token OK\n');

  // 1. Personas
  console.log(`Creando ${TOTAL} personas...`);
  const personas = [];
  for (let i = 0; i < TOTAL; i++) {
    const p = personaDe(i);
    const res = await pedir('/api/personas', { method: 'POST', token, body: p });
    if (res.ok) personas.push(p.dni);
    else console.log(`  persona ${p.dni} fallo (${res.status}): ${detalle(res)}`);
    if ((i + 1) % 10 === 0 || i + 1 === TOTAL) console.log(`  personas: ${i + 1}/${TOTAL}`);
  }
  console.log(`  personas listas: ${personas.length}/${TOTAL}\n`);

  // 2. Vehiculos
  console.log(`Creando ${TOTAL} vehiculos...`);
  const placas = [];
  for (let i = 0; i < TOTAL; i++) {
    const v = vehiculoDe(i);
    const res = await pedir('/vehiculos', { method: 'POST', token, body: v });
    if (res.ok || res.status === 409) placas.push(v.datos.placa);
    else console.log(`  vehiculo ${v.datos.placa} fallo (${res.status}): ${detalle(res)}`);
    if ((i + 1) % 10 === 0 || i + 1 === TOTAL) console.log(`  vehiculos: ${i + 1}/${TOTAL}`);
  }
  console.log(`  vehiculos listos: ${placas.length}/${TOTAL}\n`);

  // 3. Zona demo con espacios automaticos
  const nombreZona = `Zona Seed ${LOTE}`;
  console.log(`Creando zona demo "${nombreZona}" con ${TOTAL} espacios...`);
  const zonaRes = await pedir('/api/zonas', {
    method: 'POST',
    token,
    body: {
      nombre: nombreZona,
      descripcion: 'Zona generada por seed-tickets',
      capacidad: TOTAL,
      tipo: 'GENERAL',
      crearEspaciosAutomaticamente: true,
    },
  });
  if (!zonaRes.ok) throw new Error(`Crear zona fallo (${zonaRes.status}): ${detalle(zonaRes)}`);
  const zona = zonaRes.data;
  console.log(`  zona creada: ${zona.nombre} (${zona.codigo}, id ${zona.id})`);

  const espaciosRes = await pedir(`/api/espacios/zona/${zona.id}/estado/DISPONIBLE`, { token });
  if (!espaciosRes.ok) throw new Error(`GET espacios de la zona fallo (${espaciosRes.status})`);
  const espacios = espaciosRes.data.map((e) => e.id);
  console.log(`  espacios disponibles: ${espacios.length}\n`);

  // 4. Tickets: un vehiculo + una persona + un espacio por ticket
  const n = Math.min(personas.length, placas.length, espacios.length);
  console.log(`Emitiendo ${n} tickets...`);
  let creados = 0;
  let cerrados = 0;
  let errores = 0;
  let recaudoTotal = 0;
  const paraCerrar = Math.round(n * PORCENTAJE_CERRADOS);

  for (let i = 0; i < n; i++) {
    const res = await pedir('/tickets', {
      method: 'POST',
      token,
      body: { placa: placas[i], dni: personas[i], idEspacio: espacios[i] },
    });
    if (!res.ok) {
      errores++;
      console.log(`  ticket #${i} fallo (${res.status}): ${detalle(res)}`);
      continue;
    }
    creados++;

    if (i < paraCerrar) {
      const salida = new Date(Date.now() + (1 + Math.random() * 7) * 3600 * 1000).toISOString();
      const cierre = await pedir(`/tickets/${res.data.id}/cerrar`, {
        method: 'PATCH',
        token,
        body: { fechhaHoraSalida: salida },
      });
      if (cierre.ok) {
        cerrados++;
        recaudoTotal += Number(cierre.data.valorRecaudo || 0);
      }
    }
    if ((i + 1) % 10 === 0 || i + 1 === n) console.log(`  tickets: ${i + 1}/${n}`);
  }

  console.log('\nResumen:');
  console.log(`  Personas creadas : ${personas.length}`);
  console.log(`  Vehiculos creados: ${placas.length}`);
  console.log(`  Zona demo        : ${zona.nombre} (${espacios.length} espacios)`);
  console.log(`  Tickets creados  : ${creados}`);
  console.log(`  Cerrados         : ${cerrados} (recaudo total $${recaudoTotal.toFixed(2)})`);
  console.log(`  Activos          : ${creados - cerrados}`);
  console.log(`  Errores          : ${errores}`);
  console.log('\nVerifica:');
  console.log('  - Front:   http://localhost:5173/tickets');
  console.log('  - DBeaver: postgres@localhost:5432, BD tickets_db, tabla "Tickets"');
  console.log('  - Redis:   docker exec parking-redis redis-cli KEYS "*"');
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
