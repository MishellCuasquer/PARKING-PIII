// Via Kong (API Gateway). GET /api/zonas y /api/espacios son públicos y con CORS habilitado.
const API_ZONAS = 'http://localhost:8000/api/zonas';
const API_ESPACIOS = 'http://localhost:8000/api/espacios';
const POLLING_INTERVAL = 5000; // 5 segundos

const container = document.getElementById('espaciosContainer');
const totalSpan = document.getElementById('totalEspacios');
const lastUpdateSpan = document.getElementById('lastUpdate');
const indicator = document.getElementById('indicator');
const statusText = document.getElementById('statusText');

const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleString('es-ES', { hour12: false });
};

const setConnectionStatus = (connected) => {
    if (connected) {
        indicator.className = 'w-3 h-3 bg-green-400 rounded-full inline-block shadow-lg shadow-green-400/50';
        statusText.textContent = 'Conectado';
    } else {
        indicator.className = 'w-3 h-3 bg-red-400 rounded-full inline-block shadow-lg shadow-red-400/50';
        statusText.textContent = 'Desconectado';
    }
};

const fetchZonas = async () => {
    try {
        const response = await fetch(API_ZONAS);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error al obtener zonas:', error);
        return null;
    }
};

const fetchEspacios = async () => {
    try {
        const response = await fetch(API_ESPACIOS);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error al obtener espacios:', error);
        return null;
    }
};
const renderizarZonasEspacios = (zonas, espacios) => {
    if (!zonas || zonas.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                    <svg class="w-16 h-16 mx-auto text-purple-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                    <p class="text-xl text-white font-medium">No hay zonas disponibles</p>
                    <p class="text-purple-200 text-sm mt-2">Crea una zona para comenzar</p>
                </div>
            </div>
        `;
        totalSpan.textContent = '0 zonas';
        return;
    }

    // Agrupar espacios por zona
    const espaciosPorZona = {};
    if (espacios) {
        espacios.forEach(esp => {
            const zonaId = esp.nombreZona || 'Sin Zona';
            if (!espaciosPorZona[zonaId]) {
                espaciosPorZona[zonaId] = [];
            }
            espaciosPorZona[zonaId].push(esp);
        });
    }

    // Construir HTML agrupado por zonas con diseño tipo mapa de parqueadero
    let totalEspacios = 0;
    const html = zonas.map((zona) => {
        const espaciosZona = espaciosPorZona[zona.nombre] || [];
        totalEspacios += espaciosZona.length;
        
        const tipoColors = {
            'VIP': 'from-purple-500 to-pink-500',
            'GENERAL': 'from-blue-500 to-cyan-500',
            'VISITANTES': 'from-green-500 to-emerald-500',
            'PREFERENCIAL': 'from-yellow-500 to-orange-500'
        };
        const tipoGradient = tipoColors[zona.tipo] || 'from-gray-500 to-slate-500';
        
        const ocupacion = (espaciosZona.length / zona.capacidad) * 100;
        const ocupacionColor = ocupacion > 80 ? 'bg-red-500' : ocupacion > 50 ? 'bg-yellow-500' : 'bg-green-500';

        // Crear grid de espacios tipo mapa de estacionamiento
        const espaciosGrid = () => {
            if (espaciosZona.length === 0) {
                return `<div class="text-center py-8 bg-white/5 rounded-xl border border-white/10">
                    <p class="text-purple-200 text-sm">No hay espacios en esta zona</p>
                </div>`;
            }

            // Crear filas de espacios como en un parqueadero real
            const rows = [];
            const spacesPerRow = 2;
            for (let i = 0; i < espaciosZona.length; i += spacesPerRow) {
                const rowSpaces = espaciosZona.slice(i, i + spacesPerRow);
                const rowHtml = rowSpaces.map((esp) => {
                    const estadoColors = {
                        'DISPONIBLE': { bg: 'bg-green-500', border: 'border-green-400', text: 'text-green-100' },
                        'OCUPADO': { bg: 'bg-red-500', border: 'border-red-400', text: 'text-red-100' },
                        'RESERVADO': { bg: 'bg-yellow-500', border: 'border-yellow-400', text: 'text-yellow-100' },
                        'MANTENIMIENTO': { bg: 'bg-gray-500', border: 'border-gray-400', text: 'text-gray-100' }
                    };
                    const colors = estadoColors[esp.estado] || estadoColors['DISPONIBLE'];
                    
                    return `
                        <div class="relative group flex-1">
                            <div class="${colors.bg} ${colors.border} border-2 rounded-lg p-4 shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer min-h-[100px] flex flex-col justify-center items-center">
                                <div class="text-white font-bold text-base mb-1">${esp.nombre || 'Sin nombre'}</div>
                                <div class="${colors.text} text-xs font-medium">${esp.estado}</div>
                                <div class="text-white/80 text-xs mt-1">${esp.tipo || 'N/A'}</div>
                                <div class="absolute -top-2 -right-2 w-4 h-4 ${colors.bg} rounded-full border-2 border-white"></div>
                            </div>
                        </div>
                    `;
                }).join('');
                rows.push(`<div class="flex gap-4 justify-center mb-4">${rowHtml}</div>`);
            }
            return rows.join('');
        };

        return `
            <div class="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-2xl">
                <!-- Header de la zona -->
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="bg-gradient-to-r ${tipoGradient} p-3 rounded-xl shadow-xl">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-white">${zona.nombre}</h2>
                            <p class="text-purple-200 text-xs">${zona.codigo} • ${zona.descripcion || 'Sin descripción'}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <span class="px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r ${tipoGradient} text-white shadow-lg">
                            ${zona.tipo}
                        </span>
                        <span class="px-3 py-1 text-xs font-bold rounded-full bg-white/20 text-white backdrop-blur-sm border border-white/30">
                            ${espaciosZona.length}/${zona.capacidad}
                        </span>
                    </div>
                </div>
                
                <!-- Barra de ocupación -->
                <div class="mb-4">
                    <div class="flex justify-between text-xs text-purple-200 mb-1">
                        <span class="font-medium">Ocupación</span>
                        <span class="font-bold">${ocupacion.toFixed(0)}%</span>
                    </div>
                    <div class="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                        <div class="${ocupacionColor} h-2 rounded-full transition-all duration-700 ease-out shadow-lg" style="width: ${ocupacion}%"></div>
                    </div>
                </div>
                
                <!-- Mapa de estacionamiento -->
                <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div class="text-center mb-3">
                        <span class="text-purple-200 text-xs font-medium">📍 Mapa</span>
                    </div>
                    ${espaciosGrid()}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    totalSpan.textContent = `${zonas.length} zonas • ${totalEspacios} espacios`;
    lastUpdateSpan.textContent = formatDate(new Date());
};

const cargarEspacios = async () => {
    const [zonas, espacios] = await Promise.all([fetchZonas(), fetchEspacios()]);
    if (zonas) {
        renderizarZonasEspacios(zonas, espacios);
        setConnectionStatus(true);
    } else {
        setConnectionStatus(false);
    }
};

const startPolling = () => {
    // Cargar espacios inicialmente
    cargarEspacios();
    
    // Configurar polling cada 5 segundos
    setInterval(() => {
        cargarEspacios();
    }, POLLING_INTERVAL);
};

// Iniciar el polling cuando cargue la página
document.addEventListener('DOMContentLoaded', startPolling);
