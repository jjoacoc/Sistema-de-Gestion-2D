import Konva from "konva";
import axios from "axios";
import {
    cargarImagen,
    tokenCsrf,
    crearGlobo,
    mostrarGlobo,
    ocultarGlobo,
    textoFicha,
    coincideConFiltro,
} from "./compartido.js";

// ------------------------------------------------------------
// Medidas (en píxeles) y colores
// ------------------------------------------------------------
const ALTO_ESCENARIO = 560;
const TAMANO_MINIATURA = 40; // Miniaturas dentro de los estantes
const TAMANO_MINIATURA_ZONA = 56; // Miniaturas en la zona "Sin ubicar"
const SEPARACION = 8;
const COLOR_SELECCION = "#2563eb";
const COLOR_COINCIDENCIA = "#f59e0b"; // NUEVO (paso 7): naranja para lo que coincide con la búsqueda
const RELLENO_ZONA = "#fff7ed";

const contenedor = document.getElementById("mapa-almacen");

// ------------------------------------------------------------
// Estado del mapa
// ------------------------------------------------------------
let escenario;
let capaFondo, capaEstantes, capaMiniaturas, capaGlobo;
let globo;

let datos = { estantes: [], sin_ubicar: [] }; // Lo último que respondió el servidor
let idSeleccionado = null; // Estante elegido con click
let marcos = new Map(); // id de estante -> su rectángulo
let rectanguloZonaSinUbicar = null;
let versionDibujo = 0; // Evita que dos dibujos se pisen entre sí
let filtro = { texto: "", categoria: "" }; // NUEVO (paso 7): la búsqueda actual
let modoEdicion = false; // NUEVO (paso 9): ¿está activo el modo edición?

if (contenedor) {
    iniciarMapa();
}

// ------------------------------------------------------------
// Arranque: crea el escenario y sus 4 capas
// ------------------------------------------------------------
async function iniciarMapa() {
    escenario = new Konva.Stage({
        container: contenedor,
        width: contenedor.clientWidth,
        height: ALTO_ESCENARIO,
    });

    // El orden de creación es el orden de dibujo: la última capa queda arriba
    capaFondo = new Konva.Layer({ listening: false });
    capaEstantes = new Konva.Layer();
    capaMiniaturas = new Konva.Layer();
    capaGlobo = new Konva.Layer({ listening: false });

    escenario.add(capaFondo);
    escenario.add(capaEstantes);
    escenario.add(capaMiniaturas);
    escenario.add(capaGlobo);

    dibujarGrilla(capaFondo, 1600, ALTO_ESCENARIO);

    globo = crearGlobo();
    capaGlobo.add(globo);

    await cargarDatos();

    // Cuando se ubica una prenda desde el estante ampliado, se actualiza el mapa
    window.addEventListener("prenda-ubicada", cargarDatos);

    // Cuando se elige un estante (aquí o desde una miniatura), se pinta su borde azul
    window.addEventListener("estante-seleccionado", (evento) => {
        idSeleccionado = evento.detail.id;
        pintarSeleccion();
    });

    // NUEVO (paso 7): cuando la página cambia la búsqueda, guardamos el filtro y redibujamos
    window.addEventListener("filtro-cambiado", (evento) => {
        filtro = evento.detail;
        dibujar();
    });

    // Si cambia el tamaño de la ventana, ajustamos el escenario y redibujamos
    window.addEventListener("resize", () => {
        escenario.width(contenedor.clientWidth);
        dibujar();
    });

    // NUEVO (paso 8): si cambia el inventario (producto creado, stock modificado), se actualiza el mapa
    window.addEventListener("inventario-actualizado", cargarDatos);

    // NUEVO (paso 9): se activa o desactiva el modo edición
    window.addEventListener("modo-edicion", (evento) => {
        modoEdicion = evento.detail.activo;
        dibujar();
    });

    // NUEVO (paso 9): también se actualiza el mapa cuando se crea, edita o elimina un estante
    // (ya escucha 'inventario-actualizado' desde el paso 8, así que no hace falta otro aviso)
}

// ------------------------------------------------------------
// Pide los datos al servidor y redibuja todo
// ------------------------------------------------------------
async function cargarDatos() {
    const respuesta = await axios.get(contenedor.dataset.url);
    datos = respuesta.data;

    // NUEVO (paso 7): la lista de categorías para el selector del filtro, sin repetir y ordenada
    const categorias = [
        ...new Set([
            ...datos.estantes.flatMap((estante) =>
                estante.productos.map((producto) => producto.categoria),
            ),
            ...datos.sin_ubicar.map((producto) => producto.categoria),
        ]),
    ].sort((a, b) => a.localeCompare(b, "es"));

    window.dispatchEvent(
        new CustomEvent("categorias-cargadas", { detail: categorias }),
    );

    await dibujar();

    // Si hay un estante seleccionado, el panel lateral recibe sus datos actualizados
    const seleccionado = datos.estantes.find(
        (estante) => estante.id === idSeleccionado,
    );

    if (seleccionado) {
        window.dispatchEvent(
            new CustomEvent("estante-seleccionado", { detail: seleccionado }),
        );
    } else {
        idSeleccionado = null; // NUEVO (paso 9): el estante elegido ya no existe (fue eliminado)
    }
}

// ------------------------------------------------------------
// NUEVO (paso 7): ¿hay una búsqueda en marcha?
// ------------------------------------------------------------
function filtroActivo() {
    return filtro.texto.trim() !== "" || filtro.categoria !== "";
}

// NUEVO (paso 7): cuenta las coincidencias y se las avisa a la página
function avisarResultado() {
    let coincidencias = 0;
    let estantesConCoincidencia = 0;

    datos.estantes.forEach((estante) => {
        const cantidad = estante.productos.filter((producto) =>
            coincideConFiltro(producto, filtro),
        ).length;
        coincidencias += cantidad;
        if (cantidad > 0) {
            estantesConCoincidencia++;
        }
    });

    const enSinUbicar = datos.sin_ubicar.filter((producto) =>
        coincideConFiltro(producto, filtro),
    ).length;
    coincidencias += enSinUbicar;

    window.dispatchEvent(
        new CustomEvent("filtro-resultado", {
            detail: {
                activo: filtroActivo(),
                coincidencias: coincidencias,
                estantes: estantesConCoincidencia,
                sinUbicar: enSinUbicar,
            },
        }),
    );
}

// NUEVO (paso 7): si hay búsqueda, las prendas que coinciden pasan al principio de la lista
function ordenarPorCoincidencia(productos) {
    if (!filtroActivo()) {
        return productos;
    }

    return [
        ...productos.filter((producto) => coincideConFiltro(producto, filtro)),
        ...productos.filter((producto) => !coincideConFiltro(producto, filtro)),
    ];
}

// ------------------------------------------------------------
// Dibuja estantes, zona "Sin ubicar" y miniaturas a partir de "datos"
// ------------------------------------------------------------
async function dibujar() {
    // Cada dibujo tiene un número. Si empieza otro mientras éste espera imágenes, éste se descarta
    const miVersion = ++versionDibujo;

    capaEstantes.destroyChildren();
    capaMiniaturas.destroyChildren();
    marcos = new Map();
    ocultarGlobo(globo);

    datos.estantes.forEach((estante) =>
        capaEstantes.add(crearEstante(estante)),
    );

    // En modo edición se ocultan la zona "Sin ubicar" y las miniaturas, para ver solo los estantes
    if (!modoEdicion) {
        dibujarZonaSinUbicar();
    }

    pintarSeleccion();
    avisarResultado();

    // Las miniaturas esperan a que carguen sus imágenes; se agregan todas juntas
    const miniaturas = modoEdicion ? [] : await crearTodasLasMiniaturas();
    if (miVersion !== versionDibujo) return;

    miniaturas.forEach((miniatura) => capaMiniaturas.add(miniatura));

    escenario.container().style.cursor = "default";
    capaEstantes.batchDraw();
    capaMiniaturas.batchDraw();
}

// ------------------------------------------------------------
// Fondo: líneas cada 40 píxeles para dar sensación de piso
// ------------------------------------------------------------
function dibujarGrilla(capa, ancho, alto) {
    const separacion = 40;

    for (let x = 0; x <= ancho; x += separacion) {
        capa.add(
            new Konva.Line({
                points: [x, 0, x, alto],
                stroke: "#f1f5f9",
                strokeWidth: 1,
            }),
        );
    }
    for (let y = 0; y <= alto; y += separacion) {
        capa.add(
            new Konva.Line({
                points: [0, y, ancho, y],
                stroke: "#f1f5f9",
                strokeWidth: 1,
            }),
        );
    }
}

// ------------------------------------------------------------
// Color del estante según qué tan lleno está
// ------------------------------------------------------------
function colorSegunOcupacion(ocupados, capacidad) {
    if (ocupados === 0) {
        return { relleno: "#e5e7eb", borde: "#9ca3af" }; // Gris: vacío
    }

    const porcentaje = ocupados / capacidad;

    if (porcentaje >= 1) {
        return { relleno: "#fecaca", borde: "#dc2626" }; // Rojo: lleno
    }
    if (porcentaje >= 0.75) {
        return { relleno: "#fef08a", borde: "#ca8a04" }; // Amarillo: casi lleno
    }
    return { relleno: "#bbf7d0", borde: "#16a34a" }; // Verde: con espacio
}

// ------------------------------------------------------------
// Dibuja un estante (sin sus miniaturas, que van en otra capa)
// ------------------------------------------------------------
function crearEstante(estante) {
    const colores = colorSegunOcupacion(estante.ocupados, estante.capacidad);
    const porcentaje =
        estante.capacidad > 0 ? estante.ocupados / estante.capacidad : 0;

    // NUEVO (paso 7): con búsqueda activa, el estante brilla si tiene coincidencias y se atenúa si no
    const hayFiltro = filtroActivo();
    const tieneCoincidencias = estante.productos.some((producto) =>
        coincideConFiltro(producto, filtro),
    );
    const resaltado = hayFiltro && tieneCoincidencias;

    const grupo = new Konva.Group({
        x: estante.posicion_x,
        y: estante.posicion_y,
    });
    grupo.opacity(hayFiltro && !tieneCoincidencias ? 0.35 : 1);

    const marco = new Konva.Rect({
        width: estante.ancho,
        height: estante.alto,
        fill: colores.relleno,
        stroke: colores.borde,
        strokeWidth: 3,
        cornerRadius: 8,
        dash: modoEdicion ? [10, 6] : [], // NUEVO (paso 9): borde punteado en modo edición
        shadowColor: resaltado ? COLOR_COINCIDENCIA : "black",
        shadowBlur: resaltado ? 18 : 6,
        shadowOpacity: resaltado ? 0.9 : 0.2,
        shadowOffset: resaltado ? { x: 0, y: 0 } : { x: 2, y: 2 },
    });

    // Guardamos los colores originales para poder restaurarlos después
    marco.setAttr("rellenoNormal", colores.relleno);
    marco.setAttr("bordeNormal", colores.borde);
    marcos.set(estante.id, marco);

    const titulo = new Konva.Text({
        text: estante.nombre,
        y: 8,
        width: estante.ancho,
        align: "center",
        fontSize: 16,
        fontStyle: "bold",
        fill: "#1f2937",
    });

    const detalle = new Konva.Text({
        text: `${estante.ocupados} / ${estante.capacidad} productos`,
        y: 28,
        width: estante.ancho,
        align: "center",
        fontSize: 12,
        fill: "#374151",
    });

    // Barra de ocupación
    const anchoBarra = estante.ancho - 40;

    const fondoBarra = new Konva.Rect({
        x: 20,
        y: estante.alto - 16,
        width: anchoBarra,
        height: 8,
        fill: "#ffffff",
        cornerRadius: 4,
    });

    const relleno = new Konva.Rect({
        x: 20,
        y: estante.alto - 16,
        width: anchoBarra * Math.min(porcentaje, 1),
        height: 8,
        fill: colores.borde,
        cornerRadius: 4,
    });

    grupo.add(marco, titulo, detalle, fondoBarra, relleno);

    // --- Interacción ---

    grupo.on("mouseenter", () => {
        escenario.container().style.cursor = "pointer";
        marco.strokeWidth(6);
        capaEstantes.batchDraw();
    });

    grupo.on("mouseleave", () => {
        escenario.container().style.cursor = "default";
        marco.strokeWidth(estante.id === idSeleccionado ? 5 : 3);
        capaEstantes.batchDraw();
    });

    grupo.on("click tap", () => seleccionarEstante(estante.id));

    return grupo;
}

// Avisa a la página (panel lateral) qué estante se eligió
function seleccionarEstante(id) {
    const estante = datos.estantes.find((e) => e.id === id);
    if (estante) {
        window.dispatchEvent(
            new CustomEvent("estante-seleccionado", { detail: estante }),
        );
    }
}

// Pinta de azul el borde del estante seleccionado
function pintarSeleccion() {
    marcos.forEach((marco, id) => {
        const esElegido = id === idSeleccionado;
        marco.stroke(
            esElegido ? COLOR_SELECCION : marco.getAttr("bordeNormal"),
        );
        marco.strokeWidth(esElegido ? 5 : 3);
    });
    capaEstantes.batchDraw();
}

// ------------------------------------------------------------
// Zona "Sin ubicar": un rectángulo fijo en la parte baja del mapa
// ------------------------------------------------------------
function rectanguloZona() {
    return {
        x: 20,
        y: ALTO_ESCENARIO - 130,
        ancho: escenario.width() - 40,
        alto: 110,
    };
}

function dibujarZonaSinUbicar() {
    const zona = rectanguloZona();

    rectanguloZonaSinUbicar = new Konva.Rect({
        x: zona.x,
        y: zona.y,
        width: zona.ancho,
        height: zona.alto,
        fill: RELLENO_ZONA,
        stroke: "#fb923c",
        strokeWidth: 2,
        dash: [8, 6],
        cornerRadius: 8,
        listening: false,
    });

    const titulo = new Konva.Text({
        text: `Sin ubicar (${datos.sin_ubicar.length})  ·  arrastra una prenda hacia un estante`,
        x: zona.x + 12,
        y: zona.y + 10,
        fontSize: 13,
        fontStyle: "bold",
        fill: "#9a3412",
        listening: false,
    });

    capaEstantes.add(rectanguloZonaSinUbicar, titulo);

    if (datos.sin_ubicar.length === 0) {
        capaEstantes.add(
            new Konva.Text({
                text: "Todas las prendas están ubicadas",
                x: zona.x + 12,
                y: zona.y + 55,
                fontSize: 13,
                fill: "#9a3412",
                listening: false,
            }),
        );
    }
}

// ------------------------------------------------------------
// Miniaturas
// ------------------------------------------------------------

// Cuántas miniaturas se dibujan si no entran todas: se deja un lugar para el "+N"
function calcularVisibles(total, maximo) {
    if (total <= maximo) {
        return { cantidad: total, extra: 0 };
    }
    return { cantidad: maximo - 1, extra: total - (maximo - 1) };
}

async function crearTodasLasMiniaturas() {
    const tareas = [];

    // 1. Miniaturas dentro de cada estante (centradas)
    datos.estantes.forEach((estante) => {
        const productos = ordenarPorCoincidencia(estante.productos); // NUEVO (paso 7)

        const maximo = Math.max(
            2,
            Math.floor(
                (estante.ancho - 20 + SEPARACION) /
                    (TAMANO_MINIATURA + SEPARACION),
            ),
        );
        const { cantidad, extra } = calcularVisibles(productos.length, maximo);

        const lugares = cantidad + (extra > 0 ? 1 : 0);
        const anchoTotal =
            lugares * TAMANO_MINIATURA + Math.max(0, lugares - 1) * SEPARACION;
        const inicioX = estante.posicion_x + (estante.ancho - anchoTotal) / 2;
        const y = estante.posicion_y + 46;

        for (let i = 0; i < cantidad; i++) {
            const x = inicioX + i * (TAMANO_MINIATURA + SEPARACION);
            tareas.push(
                crearMiniatura(
                    productos[i],
                    x,
                    y,
                    TAMANO_MINIATURA,
                    estante.id,
                ),
            );
        }

        if (extra > 0) {
            const x = inicioX + cantidad * (TAMANO_MINIATURA + SEPARACION);

            // NUEVO (paso 7): el "+N" se resalta si entre las prendas ocultas hay coincidencias
            const ocultasCoinciden =
                filtroActivo() &&
                productos
                    .slice(cantidad)
                    .some((producto) => coincideConFiltro(producto, filtro));

            tareas.push(
                crearInsigniaExtra(
                    extra,
                    x,
                    y,
                    TAMANO_MINIATURA,
                    ocultasCoinciden,
                ),
            );
        }
    });

    // 2. Miniaturas de la zona "Sin ubicar" (alineadas a la izquierda)
    const sinUbicar = ordenarPorCoincidencia(datos.sin_ubicar); // NUEVO (paso 7)
    const zona = rectanguloZona();
    const maximoZona = Math.max(
        2,
        Math.floor(
            (zona.ancho - 24 + SEPARACION) /
                (TAMANO_MINIATURA_ZONA + SEPARACION),
        ),
    );
    const visibles = calcularVisibles(sinUbicar.length, maximoZona);

    for (let i = 0; i < visibles.cantidad; i++) {
        const x = zona.x + 12 + i * (TAMANO_MINIATURA_ZONA + SEPARACION);
        const y = zona.y + 40;
        tareas.push(
            crearMiniatura(sinUbicar[i], x, y, TAMANO_MINIATURA_ZONA, null),
        );
    }

    if (visibles.extra > 0) {
        const x =
            zona.x +
            12 +
            visibles.cantidad * (TAMANO_MINIATURA_ZONA + SEPARACION);

        const ocultasCoinciden =
            filtroActivo() &&
            sinUbicar
                .slice(visibles.cantidad)
                .some((producto) => coincideConFiltro(producto, filtro));

        tareas.push(
            crearInsigniaExtra(
                visibles.extra,
                x,
                zona.y + 40,
                TAMANO_MINIATURA_ZONA,
                ocultasCoinciden,
            ),
        );
    }

    return Promise.all(tareas);
}

// Cuadro gris con "+N" cuando hay más prendas de las que entran a la vista
function crearInsigniaExtra(extra, x, y, tamano, resaltada = false) {
    const grupo = new Konva.Group({ x, y, listening: false });

    grupo.add(
        new Konva.Rect({
            width: tamano,
            height: tamano,
            fill: "#e5e7eb",
            stroke: resaltada ? COLOR_COINCIDENCIA : null, // NUEVO (paso 7)
            strokeWidth: resaltada ? 3 : 0,
            cornerRadius: 6,
        }),
    );
    grupo.add(
        new Konva.Text({
            text: `+${extra}`,
            width: tamano,
            height: tamano,
            align: "center",
            verticalAlign: "middle",
            fontSize: 13,
            fontStyle: "bold",
            fill: "#374151",
        }),
    );

    return grupo;
}

// Una miniatura arrastrable. "idEstante" es null si está en la zona "Sin ubicar"
async function crearMiniatura(producto, x, y, tamano, idEstante) {
    // NUEVO (paso 7): con búsqueda activa, lo que coincide se resalta y lo demás se atenúa
    const hayFiltro = filtroActivo();
    const coincide = coincideConFiltro(producto, filtro);
    const opacidadBase = hayFiltro && !coincide ? 0.2 : 1;

    const grupo = new Konva.Group({ x, y, draggable: true });
    grupo.opacity(opacidadBase);

    grupo.add(
        new Konva.Rect({
            width: tamano,
            height: tamano,
            fill: "#ffffff",
            stroke: hayFiltro && coincide ? COLOR_COINCIDENCIA : "#d1d5db",
            strokeWidth: hayFiltro && coincide ? 3 : 1,
            cornerRadius: 6,
        }),
    );

    // Imagen ajustada al cuadrado; si falla, un recuadro gris
    try {
        const imagen = await cargarImagen(producto.imagen_url);
        const escala = Math.min(
            (tamano - 6) / imagen.width,
            (tamano - 6) / imagen.height,
        );
        const ancho = imagen.width * escala;
        const alto = imagen.height * escala;

        grupo.add(
            new Konva.Image({
                image: imagen,
                x: (tamano - ancho) / 2,
                y: (tamano - alto) / 2,
                width: ancho,
                height: alto,
            }),
        );
    } catch (error) {
        grupo.add(
            new Konva.Rect({
                x: 4,
                y: 4,
                width: tamano - 8,
                height: tamano - 8,
                fill: "#d1d5db",
                cornerRadius: 4,
            }),
        );
    }

    // Lugar de origen: a dónde vuelve si el movimiento no se puede hacer
    const origen = { x, y };

    grupo.on("mouseenter", () => {
        escenario.container().style.cursor = "grab";
        mostrarGlobo(
            globo,
            textoFicha(producto),
            x + tamano / 2,
            y,
            y + tamano,
        );
    });

    grupo.on("mouseleave", () => {
        escenario.container().style.cursor = "default";
        ocultarGlobo(globo);
    });

    // Un click (sin arrastrar) selecciona el estante al que pertenece
    grupo.on("click tap", () => {
        if (idEstante !== null) {
            seleccionarEstante(idEstante);
        }
    });

    // NUEVO (paso 8): un doble click abre la ficha de la prenda (para manejar el stock)
    grupo.on("dblclick dbltap", () => {
        window.dispatchEvent(
            new CustomEvent("abrir-ficha", { detail: producto }),
        );
    });

    grupo.on("dragstart", () => {
        ocultarGlobo(globo);
        grupo.moveToTop();
        grupo.opacity(0.85);
        escenario.container().style.cursor = "grabbing";
    });

    // Mientras se arrastra, resaltamos el estante (o la zona) que está debajo
    grupo.on("dragmove", () => {
        resaltarDestino(
            buscarDestino({
                x: grupo.x() + tamano / 2,
                y: grupo.y() + tamano / 2,
            }),
        );
    });

    grupo.on("dragend", async () => {
        grupo.opacity(opacidadBase); // CAMBIA (paso 7): vuelve a la opacidad que corresponde según la búsqueda
        escenario.container().style.cursor = "default";

        const destino = buscarDestino({
            x: grupo.x() + tamano / 2,
            y: grupo.y() + tamano / 2,
        });
        resaltarDestino(null);

        await intentarMover(producto, idEstante, destino, grupo, origen);
    });

    return grupo;
}

// ------------------------------------------------------------
// ¿Qué hay debajo de un punto? Un estante, la zona "Sin ubicar" o nada
// ------------------------------------------------------------
function buscarDestino(punto) {
    const estante = datos.estantes.find(
        (e) =>
            punto.x >= e.posicion_x &&
            punto.x <= e.posicion_x + e.ancho &&
            punto.y >= e.posicion_y &&
            punto.y <= e.posicion_y + e.alto,
    );

    if (estante) {
        return { tipo: "estante", id: estante.id };
    }

    const zona = rectanguloZona();
    const dentroDeZona =
        punto.x >= zona.x &&
        punto.x <= zona.x + zona.ancho &&
        punto.y >= zona.y &&
        punto.y <= zona.y + zona.alto;

    if (dentroDeZona) {
        return { tipo: "zona" };
    }

    return null;
}

// Pinta de azul claro el destino sobre el que estás arrastrando (null = quita todo resaltado)
function resaltarDestino(destino) {
    marcos.forEach((marco) => marco.fill(marco.getAttr("rellenoNormal")));
    rectanguloZonaSinUbicar.fill(RELLENO_ZONA);

    if (destino?.tipo === "estante") {
        marcos.get(destino.id).fill("#bfdbfe");
    }
    if (destino?.tipo === "zona") {
        rectanguloZonaSinUbicar.fill("#fed7aa");
    }

    capaEstantes.batchDraw();
}

// ------------------------------------------------------------
// Intenta mover la prenda al destino donde se soltó
// ------------------------------------------------------------
async function intentarMover(producto, idOrigen, destino, grupo, origen) {
    // Se soltó en el vacío: vuelve a su lugar
    if (!destino) {
        avisar(
            'Suelta la prenda sobre un estante o sobre la zona "Sin ubicar".',
            "info",
        );
        volverAlOrigen(grupo, origen);
        return;
    }

    // Se soltó donde ya estaba: no hay nada que hacer
    const mismoLugar =
        (destino.tipo === "estante" && destino.id === idOrigen) ||
        (destino.tipo === "zona" && idOrigen === null);

    if (mismoLugar) {
        volverAlOrigen(grupo, origen);
        return;
    }

    const idDestino = destino.tipo === "estante" ? destino.id : null;

    // Comprobación rápida en el navegador (el servidor la repite)
    if (idDestino !== null) {
        const estante = datos.estantes.find((e) => e.id === idDestino);

        if (estante.productos.length >= estante.capacidad) {
            avisar(`${estante.nombre} está lleno.`, "error");
            volverAlOrigen(grupo, origen);
            return;
        }
    }

    // Pedimos al servidor que haga el cambio
    try {
        const url = contenedor.dataset.urlMover.replace("__ID__", producto.id);
        const respuesta = await axios.patch(
            url,
            { estante_id: idDestino },
            { headers: { "X-CSRF-TOKEN": tokenCsrf() } },
        );
        avisar(respuesta.data.mensaje + " ✔", "ok");
    } catch (error) {
        avisar(
            error.response?.data?.mensaje ?? "No se pudo mover la prenda.",
            "error",
        );
        volverAlOrigen(grupo, origen);
        return;
    }

    // Todo salió bien: volvemos a pedir los datos y redibujamos
    await cargarDatos();
}

// Devuelve una miniatura a su posición anterior con una animación corta
function volverAlOrigen(grupo, origen) {
    new Konva.Tween({
        node: grupo,
        duration: 0.25,
        x: origen.x,
        y: origen.y,
        easing: Konva.Easings.EaseOut,
    }).play();
}

// Envía un mensaje al panel de la página (Alpine) para mostrarlo bajo el mapa
function avisar(mensaje, tipo) {
    window.dispatchEvent(
        new CustomEvent("mapa-estado", { detail: { mensaje, tipo } }),
    );
}
