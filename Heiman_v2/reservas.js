// ═══════════════════════════════════════════
// SISTEMA DE RESERVAS — Casas Campestres 2026
// Con: hora de entrada, pago simulado, reseñas, usuarios
// ═══════════════════════════════════════════

const PRECIO_CASA  = typeof PRECIO_NOCHE !== 'undefined' ? PRECIO_NOCHE : 300000;
const NOMBRE_CASA  = typeof CASA_NOMBRE  !== 'undefined' ? CASA_NOMBRE  : 'Casa Campestre';
const CASA_ID_KEY  = typeof CASA_ID      !== 'undefined' ? CASA_ID      : 'casa1';
const MAX_DIAS     = 45;
const MINS_ASEO    = 40; // minutos de limpieza después de checkout (24h)

// ── helpers localStorage ──
function getData(k, def) { try { return JSON.parse(localStorage.getItem('heiman_' + k)) || def; } catch { return def; } }
function setData(k, v)   { localStorage.setItem('heiman_' + k, JSON.stringify(v)); }

// ── estado del calendario ──
let fechaInicioSel = null;
let fechaFinSel    = null;
let horaEntrada    = '14:00';
let mesActual      = new Date();
mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);

// ─────────────────────────────────────────────
// ABRIR / CERRAR MODAL RESERVA
// ─────────────────────────────────────────────
function abrirModalReserva() {
    // Verificar si hay usuario logueado para prellenar
    const usuario = getUsuarioActual();
    if (usuario) {
        const el = document.getElementById('rNombre');
        const et = document.getElementById('rTelefono');
        if (el) el.value = usuario.nombre;
        if (et) et.value = usuario.telefono;
    }
    document.getElementById('modalReserva').classList.add('active');
    document.body.style.overflow = 'hidden';
    mostrarPasoReserva(1);
    renderCalendario();
    actualizarResumen();
}

function cerrarModalReserva() {
    document.getElementById('modalReserva').classList.remove('active');
    document.body.style.overflow = '';
    // Resetear
    document.getElementById('formularioReserva').style.display = '';
    document.getElementById('reservaExito').classList.remove('active');
    document.getElementById('pagoStep').style.display = 'none';
}

function mostrarPasoReserva(paso) {
    document.getElementById('pasoIndicadores').querySelectorAll('.paso-dot').forEach((d, i) => {
        d.classList.toggle('activo', i < paso);
    });
}

// ─────────────────────────────────────────────
// CALENDARIO
// ─────────────────────────────────────────────
function getFechasOcupadas() {
    const reservas  = getData('reservas', []).filter(r => (r.casaId === CASA_ID_KEY) && r.estado !== 'cancelada');
    const bloqueos  = getData('bloqueos', []).filter(b => b.casaId === CASA_ID_KEY);
    const ocupadas  = new Set();

    reservas.forEach(r => {
        const ini = new Date(r.llegada);
        // Fecha checkout = llegada + noches; + 40min aseo bloquea ese mismo día
        const noches = r.noches || Math.round((new Date(r.salida) - ini) / 86400000);
        const checkout = new Date(ini);
        checkout.setDate(checkout.getDate() + noches);
        // Bloquear desde día de llegada hasta checkout (inclusive por limpieza los 40 min)
        for (let d = new Date(ini); d <= checkout; d.setDate(d.getDate() + 1)) {
            ocupadas.add(d.toISOString().split('T')[0]);
        }
    });

    bloqueos.forEach(b => {
        const ini = new Date(b.inicio);
        const fin = new Date(b.fin);
        for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
            ocupadas.add(d.toISOString().split('T')[0]);
        }
    });

    return ocupadas;
}

function renderCalendario() {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const maxFecha = new Date(hoy); maxFecha.setDate(maxFecha.getDate() + MAX_DIAS);
    const ocupadas = getFechasOcupadas();

    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    document.getElementById('calMesAnio').textContent =
        meses[mesActual.getMonth()] + ' ' + mesActual.getFullYear();

    const grid = document.getElementById('calGrid');
    const dias = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
    let html = dias.map(d => `<div class="cal-dia-nombre">${d}</div>`).join('');

    const primerDia = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);
    const ultimoDia = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0);

    for (let i = 0; i < primerDia.getDay(); i++)
        html += `<div class="cal-dia cal-vacio"></div>`;

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
        const fecha = new Date(mesActual.getFullYear(), mesActual.getMonth(), d);
        fecha.setHours(0,0,0,0);
        const ts    = fecha.getTime();
        const key   = fecha.toISOString().split('T')[0];
        const esHoy = ts === hoy.getTime();

        let clases = 'cal-dia';

        if (fecha < hoy || fecha > maxFecha) {
            clases += ' cal-pasado';
        } else if (ocupadas.has(key)) {
            clases += ' cal-ocupado';
        } else {
            if (fechaInicioSel && ts === fechaInicioSel.getTime()) clases += ' cal-seleccionado-inicio';
            else if (fechaFinSel && ts === fechaFinSel.getTime()) clases += ' cal-seleccionado-fin';
            else if (fechaInicioSel && fechaFinSel && fecha > fechaInicioSel && fecha < fechaFinSel) clases += ' cal-rango';
        }
        if (esHoy && !ocupadas.has(key) && fecha >= hoy) clases += ' cal-hoy';

        const clickable = !clases.includes('cal-pasado') && !clases.includes('cal-ocupado');
        html += `<div class="${clases}" ${clickable ? `onclick="seleccionarDia(${d})"` : ''} title="${esHoy ? 'Hoy' : ''}">${d}</div>`;
    }

    grid.innerHTML = html;

    const btnPrev = document.getElementById('calPrev');
    if (btnPrev)
        btnPrev.disabled = (mesActual.getFullYear() === hoy.getFullYear() && mesActual.getMonth() <= hoy.getMonth());
}

function cambiarMes(delta) {
    mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() + delta, 1);
    renderCalendario();
}

function seleccionarDia(dia) {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const maxFecha = new Date(hoy); maxFecha.setDate(maxFecha.getDate() + MAX_DIAS);
    const fecha = new Date(mesActual.getFullYear(), mesActual.getMonth(), dia);
    fecha.setHours(0,0,0,0);
    const ocupadas = getFechasOcupadas();

    if (fecha < hoy || fecha > maxFecha) return;
    if (ocupadas.has(fecha.toISOString().split('T')[0])) return;

    if (!fechaInicioSel || (fechaInicioSel && fechaFinSel)) {
        fechaInicioSel = fecha;
        fechaFinSel = null;
    } else {
        if (fecha <= fechaInicioSel) {
            fechaInicioSel = fecha;
            fechaFinSel = null;
        } else {
            const diffDias = Math.round((fecha - fechaInicioSel) / 86400000);
            if (diffDias > MAX_DIAS) {
                const av = document.getElementById('avisoMaxDias');
                if (av) av.textContent = `Máximo ${MAX_DIAS} días permitidos.`;
                return;
            }
            // Verificar que el rango no pise días ocupados
            const ocupadas2 = getFechasOcupadas();
            let hayConflicto = false;
            for (let d = new Date(fechaInicioSel); d <= fecha; d.setDate(d.getDate() + 1)) {
                if (ocupadas2.has(d.toISOString().split('T')[0])) { hayConflicto = true; break; }
            }
            if (hayConflicto) {
                const av = document.getElementById('avisoMaxDias');
                if (av) av.textContent = '⚠ Hay fechas no disponibles en el rango seleccionado.';
                return;
            }
            fechaFinSel = fecha;
            const av = document.getElementById('avisoMaxDias');
            if (av) av.textContent = '';
        }
    }

    renderCalendario();
    actualizarResumen();
}

function actualizarHora() {
    const sel = document.getElementById('selHoraEntrada');
    if (sel) horaEntrada = sel.value;
    actualizarResumen();
}

function formatFecha(fecha) {
    if (!fecha) return '---';
    const d = fecha.getDate().toString().padStart(2,'0');
    const m = (fecha.getMonth()+1).toString().padStart(2,'0');
    const a = fecha.getFullYear();
    return `${d}/${m}/${a}`;
}

function calcCheckout() {
    if (!fechaInicioSel || !fechaFinSel) return null;
    const noches = Math.round((fechaFinSel - fechaInicioSel) / 86400000);
    // La salida es llegada + noches noches a las (horaEntrada + 24h)
    // Para mostrar: si entras el día X a las 14:00, saldrías el día X+noches a las 14:00
    return { noches, fechaSalida: fechaFinSel };
}

function actualizarResumen() {
    const elInicio  = document.getElementById('resInicio');
    const elFin     = document.getElementById('resFin');
    const elNoches  = document.getElementById('resNoches');
    const elTotal   = document.getElementById('resTotal');
    const elHora    = document.getElementById('resHora');
    const btnConf   = document.getElementById('btnConfirmarReserva');

    if (!fechaInicioSel) {
        if (elInicio) elInicio.textContent = 'Selecciona fecha de llegada';
        if (elFin)    elFin.textContent    = '---';
        if (elNoches) elNoches.textContent = '0 noches';
        if (elTotal)  elTotal.textContent  = '$ 0';
        if (elHora)   elHora.textContent   = horaEntrada;
        if (btnConf)  btnConf.disabled = true;
        return;
    }

    if (elInicio) elInicio.textContent = `${formatFecha(fechaInicioSel)} a las ${horaEntrada}`;

    if (!fechaFinSel) {
        if (elFin)   elFin.textContent   = 'Selecciona fecha de salida';
        if (elNoches) elNoches.textContent = '0 noches';
        if (elTotal)  elTotal.textContent  = '$ 0';
        if (btnConf)  btnConf.disabled = true;
        return;
    }

    const noches = Math.round((fechaFinSel - fechaInicioSel) / 86400000);

    // Calcular hora de salida: misma hora + 24h por noche
    const [hh, mm] = horaEntrada.split(':').map(Number);
    const fechaSalidaReal = new Date(fechaInicioSel);
    fechaSalidaReal.setDate(fechaSalidaReal.getDate() + noches);
    const salidaStr = `${formatFecha(fechaSalidaReal)} a las ${horaEntrada}`;
    const aseoStr   = `(+40 min aseo: casa disponible ${horaEntrada} + 40 min)`;

    if (elFin)   elFin.textContent   = salidaStr;
    if (elHora)  elHora.textContent  = horaEntrada;
    if (elNoches) elNoches.textContent = `${noches} ${noches === 1 ? 'noche' : 'noches'}`;

    // Descuento por usuario frecuente
    const usuario = getUsuarioActual();
    let descuento = 0;
    if (usuario) {
        const reservasUsuario = getData('reservas', []).filter(r => r.usuarioId === usuario.id && r.estado === 'confirmada').length;
        if (reservasUsuario >= 5) descuento = 15;
        else if (reservasUsuario >= 3) descuento = 10;
        else if (reservasUsuario >= 1) descuento = 5;
    }

    const subtotal = noches * PRECIO_CASA;
    const totalFinal = descuento > 0 ? Math.round(subtotal * (1 - descuento/100)) : subtotal;

    if (elTotal) {
        elTotal.innerHTML = descuento > 0
            ? `<del style="color:#aaa;font-size:0.9em">$${subtotal.toLocaleString('es-CO')}</del> 
               <span style="color:#e65100"> $${totalFinal.toLocaleString('es-CO')}</span>
               <span style="background:#e65100;color:#fff;font-size:0.72rem;padding:2px 7px;border-radius:10px;margin-left:4px">-${descuento}% frecuente</span>`
            : `$${totalFinal.toLocaleString('es-CO')}`;
    }

    const elInfoAseo = document.getElementById('infoAseo');
    if (elInfoAseo) elInfoAseo.textContent = `⏱ Tras el check-out, 40 min de aseo. La casa vuelve a estar disponible después.`;

    if (btnConf) btnConf.disabled = false;
}

// ─────────────────────────────────────────────
// CONFIRMAR RESERVA → PAGO SIMULADO
// ─────────────────────────────────────────────
function confirmarReserva() {
    const nombre   = document.getElementById('rNombre').value.trim();
    const telefono = document.getElementById('rTelefono').value.trim();
    const personas = document.getElementById('rPersonas').value.trim();
    const notas    = document.getElementById('rNotas').value.trim();

    if (!nombre || !telefono) { alert('Por favor completa tu nombre y teléfono.'); return; }
    if (!fechaInicioSel || !fechaFinSel) { alert('Por favor selecciona las fechas.'); return; }

    const noches   = Math.round((fechaFinSel - fechaInicioSel) / 86400000);
    const usuario  = getUsuarioActual();
    let descuento  = 0;
    if (usuario) {
        const reservasUsuario = getData('reservas', []).filter(r => r.usuarioId === usuario.id && r.estado === 'confirmada').length;
        if (reservasUsuario >= 5) descuento = 15;
        else if (reservasUsuario >= 3) descuento = 10;
        else if (reservasUsuario >= 1) descuento = 5;
    }
    const subtotal   = noches * PRECIO_CASA;
    const totalFinal = descuento > 0 ? Math.round(subtotal * (1 - descuento/100)) : subtotal;

    // Guardar datos temporales del pago
    window._reservaTemporal = {
        nombre, telefono, personas, notas, noches, totalFinal, descuento,
        llegada : fechaInicioSel.toISOString().split('T')[0],
        salida  : fechaFinSel.toISOString().split('T')[0],
        hora    : horaEntrada,
        casaId  : CASA_ID_KEY,
        casaNombre: NOMBRE_CASA,
        precio  : PRECIO_CASA,
        usuarioId: usuario ? usuario.id : null
    };

    // Mostrar pantalla de pago simulado
    document.getElementById('formularioReserva').style.display = 'none';
    document.getElementById('pagoStep').style.display = 'block';
    document.getElementById('pagoResumen').innerHTML =
        `<b>${NOMBRE_CASA}</b><br>
         📅 ${formatFecha(fechaInicioSel)} <b>${horaEntrada}</b> → ${formatFecha(fechaFinSel)} <b>${horaEntrada}</b><br>
         🌙 ${noches} ${noches===1?'noche':'noches'} · 
         💰 <b>$${totalFinal.toLocaleString('es-CO')}</b>
         ${descuento > 0 ? `<span style="color:#e65100"> (-${descuento}%)</span>` : ''}`;

    mostrarPasoReserva(2);
}

function procesarPago() {
    const metodoPago = document.querySelector('input[name="metodoPago"]:checked');
    if (!metodoPago) { alert('Selecciona un método de pago'); return; }

    const btnPagar = document.getElementById('btnPagarAhora');
    btnPagar.disabled = true;
    btnPagar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    setTimeout(() => {
        const r = window._reservaTemporal;
        if (!r) return;

        const reservas = getData('reservas', []);
        reservas.push({
            id        : 'R' + Date.now(),
            casaId    : r.casaId,
            casaNombre: r.casaNombre,
            nombre    : r.nombre,
            telefono  : r.telefono,
            personas  : r.personas,
            llegada   : r.llegada,
            salida    : r.salida,
            hora      : r.hora,
            noches    : r.noches,
            total     : r.totalFinal,
            descuento : r.descuento,
            precio    : r.precio,
            notas     : r.notas,
            estado    : 'confirmada',
            metodoPago: metodoPago.value,
            fecha     : new Date().toISOString(),
            usuarioId : r.usuarioId
        });
        setData('reservas', reservas);

        // Mostrar pantalla éxito
        document.getElementById('pagoStep').style.display = 'none';
        document.getElementById('reservaExito').classList.add('active');
        const ef = document.getElementById('exitoFechas');
        if (ef) ef.textContent = `${formatFecha(fechaInicioSel)} ${r.hora} → ${formatFecha(fechaFinSel)} ${r.hora}`;
        const em = document.getElementById('exitoMetodo');
        if (em) em.textContent = `Pago con: ${metodoPago.value}`;

        mostrarPasoReserva(3);
        btnPagar.disabled = false;
        btnPagar.innerHTML = '<i class="fas fa-lock"></i> Pagar ahora';

        // Limpiar
        fechaInicioSel = null;
        fechaFinSel    = null;
    }, 2000);
}

// ─────────────────────────────────────────────
// USUARIOS
// ─────────────────────────────────────────────
function getUsuarioActual() {
    const id = localStorage.getItem('heiman_usuario_activo');
    if (!id) return null;
    const usuarios = getData('usuarios', []);
    return usuarios.find(u => u.id === id) || null;
}

function registrarUsuario(nombre, email, telefono, pass) {
    const usuarios = getData('usuarios', []);
    if (usuarios.find(u => u.email === email)) return { ok: false, msg: 'Este correo ya está registrado.' };
    const nuevo = {
        id: 'U' + Date.now(),
        nombre, email, telefono,
        pass: btoa(pass), // ofuscado básico
        reservas: 0,
        fechaRegistro: new Date().toISOString()
    };
    usuarios.push(nuevo);
    setData('usuarios', usuarios);
    return { ok: true, usuario: nuevo };
}

function loginUsuario(email, pass) {
    const usuarios = getData('usuarios', []);
    const u = usuarios.find(u => u.email === email && u.pass === btoa(pass));
    if (!u) return { ok: false, msg: 'Correo o contraseña incorrectos.' };
    localStorage.setItem('heiman_usuario_activo', u.id);
    return { ok: true, usuario: u };
}

function logoutUsuario() {
    localStorage.removeItem('heiman_usuario_activo');
    actualizarUIUsuario();
}

function actualizarUIUsuario() {
    const usuario = getUsuarioActual();
    const btnArea = document.getElementById('usuarioBtnArea');
    if (!btnArea) return;

    if (usuario) {
        const reservasTotal = getData('reservas', []).filter(r => r.usuarioId === usuario.id).length;
        let nivel = 'Nuevo';
        if (reservasTotal >= 5) nivel = '⭐ VIP';
        else if (reservasTotal >= 3) nivel = '🌟 Frecuente';
        else if (reservasTotal >= 1) nivel = '✅ Activo';

        btnArea.innerHTML = `
            <div class="usuario-info-mini">
                <span class="usuario-nombre"><i class="fas fa-user-circle"></i> ${usuario.nombre}</span>
                <span class="usuario-nivel">${nivel}</span>
                <button onclick="logoutUsuario()" class="btn-logout-mini">Salir</button>
            </div>`;
    } else {
        btnArea.innerHTML = `
            <button class="btn-usuario" onclick="abrirModalUsuario('login')">
                <i class="fas fa-user"></i> Inicia sesión
            </button>
            <button class="btn-usuario btn-registrar" onclick="abrirModalUsuario('registro')">
                Regístrate
            </button>`;
    }
}

function abrirModalUsuario(tab) {
    document.getElementById('modalUsuario').classList.add('active');
    document.body.style.overflow = 'hidden';
    cambiarTabUsuario(tab);
}
function cerrarModalUsuario() {
    document.getElementById('modalUsuario').classList.remove('active');
    document.body.style.overflow = '';
}
function cambiarTabUsuario(tab) {
    document.getElementById('tabLogin').classList.toggle('activo', tab === 'login');
    document.getElementById('tabRegistro').classList.toggle('activo', tab === 'registro');
    document.getElementById('panelLogin').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('panelRegistro').style.display = tab === 'registro' ? 'block' : 'none';
    document.getElementById('msgUsuario').textContent = '';
}

function intentarLogin() {
    const email = document.getElementById('uEmail').value.trim();
    const pass  = document.getElementById('uPass').value;
    const res   = loginUsuario(email, pass);
    const msg   = document.getElementById('msgUsuario');
    if (res.ok) {
        msg.style.color = '#2e7d32';
        msg.textContent = `¡Bienvenido, ${res.usuario.nombre}!`;
        setTimeout(() => { cerrarModalUsuario(); actualizarUIUsuario(); actualizarResumen(); }, 900);
    } else {
        msg.style.color = '#c62828';
        msg.textContent = res.msg;
    }
}

function intentarRegistro() {
    const nombre   = document.getElementById('uNombreReg').value.trim();
    const email    = document.getElementById('uEmailReg').value.trim();
    const telefono = document.getElementById('uTelReg').value.trim();
    const pass     = document.getElementById('uPassReg').value;
    const msg      = document.getElementById('msgUsuario');

    if (!nombre || !email || !pass) { msg.style.color='#c62828'; msg.textContent='Completa todos los campos.'; return; }
    const res = registrarUsuario(nombre, email, telefono, pass);
    if (res.ok) {
        localStorage.setItem('heiman_usuario_activo', res.usuario.id);
        msg.style.color = '#2e7d32';
        msg.textContent = '¡Registro exitoso! Ya iniciaste sesión.';
        setTimeout(() => { cerrarModalUsuario(); actualizarUIUsuario(); actualizarResumen(); }, 1000);
    } else {
        msg.style.color = '#c62828';
        msg.textContent = res.msg;
    }
}

// ─────────────────────────────────────────────
// RESEÑAS
// ─────────────────────────────────────────────
function renderResenas() {
    const cont = document.getElementById('resenasGrid');
    if (!cont) return;

    const resenasGuardadas = getData('resenas_' + CASA_ID_KEY, []);
    const usuario = getUsuarioActual();

    // Reseñas estáticas de ejemplo + las guardadas
    const resenasEstaticas = [
        { nombre:'María González', foto:'https://randomuser.me/api/portraits/women/44.jpg', estrellas:5, texto:'Increíble experiencia, la casa es hermosa y la vista espectacular. El jacuzzi es perfecto para relajarse.', fecha:'2026-05-10' },
        { nombre:'Carlos Rodríguez', foto:'https://randomuser.me/api/portraits/men/32.jpg', estrellas:4, texto:'Excelente lugar para desconectarse. Muy limpio y acogedor. Volveremos sin dudar.', fecha:'2026-04-22' }
    ];

    const todas = [...resenasEstaticas, ...resenasGuardadas].reverse();

    const promedio = todas.length
        ? (todas.reduce((s, r) => s + r.estrellas, 0) / todas.length).toFixed(1)
        : '—';

    // Encabezado de reseñas
    const encabezado = document.getElementById('resenasEncabezado');
    if (encabezado) {
        encabezado.innerHTML = `
            <h2>Reseñas de huéspedes <span style="font-size:1rem;color:#888;">(${todas.length})</span></h2>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                ${'<i class="fas fa-star" style="color:#f59e0b"></i>'.repeat(Math.round(promedio))}
                <span style="font-size:1.1rem;font-weight:700;">${promedio}</span>
                <span style="color:#888;font-size:0.9rem;">/ 5</span>
            </div>`;
    }

    cont.innerHTML = todas.map(r => `
        <div class="resena-card">
            <div class="resena-header">
                <img src="${r.foto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(r.nombre) + '&background=2e7d32&color=fff'}" alt="${r.nombre}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(r.nombre)}&background=2e7d32&color=fff'">
                <div>
                    <h4>${r.nombre}</h4>
                    <div class="resena-stars">
                        ${[1,2,3,4,5].map(n => `<i class="fas fa-star${n <= r.estrellas ? '' : '-o'}" style="color:${n <= r.estrellas ? '#f59e0b' : '#ccc'}"></i>`).join('')}
                    </div>
                    <small style="color:#aaa">${r.fecha ? r.fecha.split('-').reverse().join('/') : ''}</small>
                </div>
            </div>
            <p>"${r.texto}"</p>
        </div>`).join('');

    // Formulario de nueva reseña
    const formResena = document.getElementById('formNuevaResena');
    if (formResena) {
        if (usuario) {
            formResena.style.display = 'block';
            document.getElementById('resenaUsuarioNombre').textContent = usuario.nombre;
        } else {
            formResena.style.display = 'none';
        }
    }
}

function publicarResena() {
    const usuario = getUsuarioActual();
    if (!usuario) { alert('Debes iniciar sesión para dejar una reseña.'); return; }

    const texto    = document.getElementById('resenaTexto').value.trim();
    const estrellas = parseInt(document.querySelector('input[name="resenaNota"]:checked')?.value || 0);

    if (!texto || !estrellas) { alert('Escribe tu opinión y selecciona una calificación.'); return; }

    const resenas = getData('resenas_' + CASA_ID_KEY, []);
    resenas.push({
        nombre  : usuario.nombre,
        foto    : null,
        estrellas,
        texto,
        fecha   : new Date().toISOString().split('T')[0],
        usuarioId: usuario.id
    });
    setData('resenas_' + CASA_ID_KEY, resenas);
    document.getElementById('resenaTexto').value = '';
    const checked = document.querySelector('input[name="resenaNota"]:checked');
    if (checked) checked.checked = false;
    renderResenas();
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    actualizarUIUsuario();
    renderResenas();

    // Cerrar modales al clic fuera
    ['modalReserva','modalUsuario'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', e => { if (e.target === el) { el.classList.remove('active'); document.body.style.overflow=''; } });
    });
});
