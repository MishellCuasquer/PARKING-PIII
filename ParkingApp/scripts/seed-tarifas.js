/**
 * Seeder de configuracion por empresa (tarifa, moneda y horario).
 *
 * Es la demostracion del modelo SaaS multitenant: la misma infraestructura,
 * un precio distinto por empresa. Sin esto todas las empresas nacen con la
 * configuracion por defecto (1.00 USD/hora, 00:00-23:59) y el aislamiento de
 * configuracion no se aprecia en la demo.
 *
 * La plataforma opera en DOLARES: todas las tarifas son USD.
 *
 * El cobro es proporcional a la fraccion, con un minimo de 1 hora (ver
 * calcularHorasCobro en ms-tickets). Con la tarifa de 1.00 del parqueadero por
 * defecto: 10 min = 1.00 USD (minimo), 1 h 30 min = 1.50 USD, 3 h 20 min = 3.33 USD.
 * Una empresa creada sin configuracion nace con 1.00 USD/h y 00:00-23:59.
 *
 * Uso:  node scripts/seed-tarifas.js
 *       npm run seed:tarifas
 * Requiere Node 18+ (fetch nativo) y el stack levantado (docker compose up -d).
 * Solo el SUPER_ADMIN puede modificar empresas.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const USERNAME = process.env.SEED_USER || 'superadmin';
const PASSWORD = process.env.SEED_PASSWORD || 'superadmin123';

// Tarifas por codigo de empresa. Las empresas que no aparezcan aqui se quedan
// como esten: el script no pisa configuraciones que alguien haya puesto a mano.
const TARIFAS = {
  DEFAULT: { tarifaHora: 1.0, horaApertura: '00:00', horaCierre: '23:59' },
  NORTE: { tarifaHora: 1.5, horaApertura: '06:00', horaCierre: '22:00' },
  SUR: { tarifaHora: 2.0, horaApertura: '07:00', horaCierre: '21:00' },
  CENTRO: { tarifaHora: 2.5, horaApertura: '05:30', horaCierre: '23:00' },
  YO: { tarifaHora: 1.25, horaApertura: '08:00', horaCierre: '20:00' },
};

async function pedir(ruta, opciones = {}, token) {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.headers || {}),
    },
  });
  if (!respuesta.ok) {
    throw new Error(`${opciones.method || 'GET'} ${ruta} -> ${respuesta.status} ${await respuesta.text()}`);
  }
  return respuesta.status === 204 ? null : respuesta.json();
}

async function main() {
  const { token } = await pedir('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });

  const empresas = await pedir('/api/tenants', {}, token);
  let actualizadas = 0;

  for (const empresa of empresas) {
    const config = TARIFAS[empresa.codigo];
    if (!config) {
      console.log(`  · ${empresa.codigo.padEnd(10)} sin tarifa definida en el script, se deja como está`);
      continue;
    }
    await pedir(
      `/api/tenants/${empresa.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          nombre: empresa.nombre,
          codigo: empresa.codigo,
          activo: empresa.activo,
          moneda: 'USD',
          ...config,
        }),
      },
      token,
    );
    actualizadas += 1;
  }

  console.log(`\n  ${actualizadas} empresa(s) configurada(s)\n`);
  console.log(`  ${'EMPRESA'.padEnd(22)}${'CÓDIGO'.padEnd(10)}${'TARIFA/HORA'.padStart(13)}   HORARIO`);
  console.log(`  ${'-'.repeat(64)}`);
  for (const e of await pedir('/api/tenants', {}, token)) {
    const tarifa = `${Number(e.tarifaHora).toFixed(2)} USD`;
    console.log(
      `  ${e.nombre.slice(0, 21).padEnd(22)}${e.codigo.padEnd(10)}${tarifa.padStart(13)}   ${e.horaApertura}–${e.horaCierre}`,
    );
  }
  console.log(
    '\n  Comprobación: cierra un ticket en dos empresas distintas y compara\n' +
      '  valorRecaudo — mismas horas, importes distintos.\n',
  );
}

main().catch((error) => {
  console.error(`\n  Error: ${error.message}\n`);
  process.exit(1);
});
