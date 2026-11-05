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
const COLOR_COINCIDENCIA = "#f59e0b"; // Naranja para lo que coincide con la búsqueda
const RELLENO_ZONA = "#fff7ed";

const contenedor = document.getElementById("mapa-almacen");

// Grilla, tamaños mínimos y límites del mapa (vienen del servidor, ver Estante.php)
const medidas = contenedor ? JSON.parse(contenedor.dataset.medidas) : {};

// ------------------------------------------------------------
// Estado del mapa
// ------------------------------------------------------------
let escenario;
let capaFondo, capaEstantes, capaMiniaturas, capaEdicion, capaGlobo;
let globo;
let transformador; // Las manijas para cambiar el tamaño (modo edición)
let asas; // Grupo que contiene las "asas" arrastrables (modo edición)

let datos = { estantes: [], sin_ubicar: [] }; // Lo último que respondió el servidor
let idSeleccionado = null; // Estante elegido con click
let marcos = new Map(); // id de estante -> su rectángulo
let partesEstantes = new Map(); // id de estante -> las figuras que lo forman
let asasPorId = new Map(); // id de estante -> su asa de edición
let rectanguloZonaSinUbicar = null;
let versionDibujo = 0; // Evita que dos dibujos se pisen entre sí
let filtro = { texto: "", categoria: "" }; // La búsqueda actual
let modoEdicion = false; // ¿Está activo el modo edición?

if (contenedor) {
    iniciarMapa();
}

// ------------------------------------------------------------
// Arranque: crea el escenario y sus capas
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
    capaEdicion = new Konva.Layer();
    capaGlobo = new Konva.Layer({ listening: false });

    escenario.add(capaFondo);
    escenario.add(capaEstantes);
    escenario.add(capaMiniaturas);
    escenario.add(capaEdicion);
    escenario.add(capaGlobo);

    dibujarGrilla(capaFondo, 1600, ALTO_ESCENARIO);

    globo = crearGlobo();
    capaGlobo.add(globo);

    // Capa de edición: primero el grupo de asas y encima el Transformer (las manijas)
    asas = new Konva.Group();
    capaEdicion.add(asas);

    transformador = new Konva.Transformer({
        rotateEnabled: false, // Los estantes no giran
        flipEnabled: false,
        keepRatio: false, // Ancho y alto se cambian por separado
        ignoreStroke: true,
        borderStroke: COLOR_SELECCION,
        anchorStroke: COLOR_SELECCION,
        anchorFill: "#ffffff",
        anchorSize: 10,
        boundBoxFunc: ajustarCaja, // Aquí se aplican grilla, límites y choques
    });
    capaEdicion.add(transformador);

    await cargarDatos();

    // Cuando se ubica una prenda desde el estante ampliado, se actualiza el mapa
    window.addEventListener("prenda-ubicada", cargarDatos);

    // Cuando se elige un estante (aquí o desde una miniatura), se pinta su borde azul
    window.addEventListener("estante-seleccionado", (evento) => {
        idSeleccionado = evento.detail.id;
        pintarSeleccion();
    });

    // Cuando la página cambia la búsqueda, guardamos el filtro y redibujamos
    window.addEventListener("filtro-cambiado", (evento) => {
        filtro = evento.detail;
        dibujar();
    });

    // Si cambia el tamaño de la ventana, ajustamos el escenario y redibujamos
    window.addEventListener("resize", () => {
        escenario.width(contenedor.clientWidth);
        dibujar();
    });

    // Si cambia el inventario (producto creado, stock modificado, estante creado o editado), se actualiza el mapa
    window.addEventListener("inventario-actualizado", cargarDatos);

    // Se activa o desactiva el modo edición
    window.addEventListener("modo-edicion", (evento) => {
        modoEdicion = evento.detail.activo;
        dibujar();
    });
}

// ------------------------------------------------------------
// Pide los datos al servidor y redibuja todo
// ------------------------------------------------------------
async function cargarDatos() {
    const respuesta = await axios.get(contenedor.dataset.url);
    datos = respuesta.data;

    // La lista de categorías para el selector del filtro, sin repetir y ordenada
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
        idSeleccionado = null; // El estante elegido ya no existe (fue eliminado)
    }
}

// ------------------------------------------------------------
// ¿Hay una búsqueda en marcha?
// ------------------------------------------------------------
function filtroActivo() {
    return filtro.texto.trim() !== "" || filtro.categoria !== "";
}

// Cuenta las coincidencias y se las avisa a la página
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

// Si hay búsqueda, las prendas que coinciden pasan al principio de la lista
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

    // Se suelta el estante del Transformer ANTES de destruir las figuras
    transformador.nodes([]);
    asas.destroyChildren();
    asasPorId = new Map();
    partesEstantes = new Map();

    capaEstantes.destroyChildren();
    capaMiniaturas.destroyChildren();
    marcos = new Map();
    ocultarGlobo(globo);

    datos.estantes.forEach((estante) =>
        capaEstantes.add(crearEstante(estante)),
    );

    if (modoEdicion) {
        // En modo edición se ocultan la zona "Sin ubicar" y las miniaturas,
        // y cada estante recibe su asa para arrastrarlo y redimensionarlo
        datos.estantes.forEach((estante) => asas.add(crearAsa(estante)));
    } else {
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
    capaEdicion.batchDraw();
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

    // Con búsqueda activa, el estante brilla si tiene coincidencias y se atenúa si no
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
        dash: modoEdicion ? [10, 6] : [], // Borde punteado en modo edición
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

    // Guardamos las figuras: en modo edición se reacomodan en vivo al mover o estirar
    partesEstantes.set(estante.id, {
        grupo,
        marco,
        titulo,
        detalle,
        fondoBarra,
        relleno,
        porcentaje,
    });

    // --- Interacción (fuera del modo edición; en modo edición la atiende el asa) ---

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
    actualizarTransformador();
}

// ------------------------------------------------------------
// MODO EDICIÓN: arrastrar y redimensionar estantes
// ------------------------------------------------------------

// Redondea al múltiplo de la grilla más cercano (47 -> 40, 53 -> 60)
function ajustarAGrilla(valor) {
    return Math.round(valor / medidas.grilla) * medidas.grilla;
}

// Borde derecho permitido: el menor entre el ancho visible y el ancho seguro del servidor
function limiteDerecho() {
    return Math.min(escenario.width(), medidas.ancho_mapa);
}

// La posición válida más cercana: sobre la grilla y dentro del mapa
function ajustarPosicion(x, y, ancho, alto) {
    const maxX =
        Math.floor((limiteDerecho() - ancho) / medidas.grilla) * medidas.grilla;
    const maxY =
        Math.floor((medidas.limite_inferior - alto) / medidas.grilla) *
        medidas.grilla;

    return {
        x: Math.max(0, Math.min(ajustarAGrilla(x), maxX)),
        y: Math.max(0, Math.min(ajustarAGrilla(y), maxY)),
    };
}

// ¿Ese rectángulo pisaría a otro estante? (tocarse por el borde está permitido)
function chocaConOtroEstante(x, y, ancho, alto, idPropio) {
    return datos.estantes.some(
        (otro) =>
            otro.id !== idPropio &&
            x < otro.posicion_x + otro.ancho &&
            x + ancho > otro.posicion_x &&
            y < otro.posicion_y + otro.alto &&
            y + alto > otro.posicion_y,
    );
}

// Crea el "asa" de un estante: un rectángulo casi invisible, encima del estante,
// que es lo que realmente se arrastra y se estira.
function crearAsa(estante) {
    const asa = new Konva.Rect({
        x: estante.posicion_x,
        y: estante.posicion_y,
        width: estante.ancho,
        height: estante.alto,
        fill: "rgba(37, 99, 235, 0.05)", // Casi transparente, pero recibe los clicks
        draggable: true,
        dragBoundFunc: (posicion) => limitarMovimiento(asa, estante.id, posicion),
    });

    asasPorId.set(estante.id, asa);

    asa.on("mouseenter", () => {
        escenario.container().style.cursor = "move";
    });

    asa.on("mouseleave", () => {
        escenario.container().style.cursor = "default";
    });

    // Al apretar el mouse sobre un estante, ese queda elegido (y recibe las manijas)
    asa.on("mousedown touchstart", () => {
        if (idSeleccionado !== estante.id) {
            seleccionarEstante(estante.id);
        }
    });

    // Mientras se arrastra, el estante dibujado acompaña al asa
    asa.on("dragmove", () => {
        acomodarEstante(estante.id, asa.x(), asa.y(), asa.width(), asa.height());
    });

    // Mientras se estira, Konva cambia la ESCALA del asa. La convertimos en
    // ancho y alto reales y volvemos la escala a 1 (así no se deforma nada).
    asa.on("transform", () => {
        asa.setAttrs({
            width: asa.width() * asa.scaleX(),
            height: asa.height() * asa.scaleY(),
            scaleX: 1,
            scaleY: 1,
        });
        acomodarEstante(estante.id, asa.x(), asa.y(), asa.width(), asa.height());
    });

    // Al soltar (después de mover o de estirar) se guarda
    asa.on("dragend transformend", () => guardarGeometria(estante, asa));

    return asa;
}

// Mientras se arrastra: devuelve la posición permitida más cercana a la del mouse.
// Avanza de a una celda de la grilla y se detiene antes de chocar, así nunca
// "salta por encima" de otro estante y se desliza por sus bordes.
function limitarMovimiento(asa, id, posicion) {
    const ancho = asa.width();
    const alto = asa.height();
    const paso = medidas.grilla;
    const deseada = ajustarPosicion(posicion.x, posicion.y, ancho, alto);

    let x = ajustarAGrilla(asa.x());
    let y = ajustarAGrilla(asa.y());

    // Primero en horizontal
    while (Math.abs(deseada.x - x) >= paso) {
        const siguiente = x + Math.sign(deseada.x - x) * paso;
        if (chocaConOtroEstante(siguiente, y, ancho, alto, id)) break;
        x = siguiente;
    }

    // Después en vertical
    while (Math.abs(deseada.y - y) >= paso) {
        const siguiente = y + Math.sign(deseada.y - y) * paso;
        if (chocaConOtroEstante(x, siguiente, ancho, alto, id)) break;
        y = siguiente;
    }

    return { x, y };
}

// El Transformer llama a esta función en cada movimiento de una manija.
// Devuelve la caja ajustada a la grilla, o la anterior si la nueva no es válida.
function ajustarCaja(anterior, nueva) {
    // Cada borde se ajusta por separado: al estirar un lado, el opuesto no se mueve
    const izquierda = ajustarAGrilla(nueva.x);
    const arriba = ajustarAGrilla(nueva.y);
    const derecha = ajustarAGrilla(nueva.x + nueva.width);
    const abajo = ajustarAGrilla(nueva.y + nueva.height);
    const ancho = derecha - izquierda;
    const alto = abajo - arriba;

    const valida =
        ancho >= medidas.ancho_minimo &&
        alto >= medidas.alto_minimo &&
        izquierda >= 0 &&
        arriba >= 0 &&
        derecha <= limiteDerecho() &&
        abajo <= medidas.limite_inferior &&
        !chocaConOtroEstante(izquierda, arriba, ancho, alto, idSeleccionado);

    return valida
        ? { ...nueva, x: izquierda, y: arriba, width: ancho, height: alto }
        : anterior;
}

// Muestra las manijas en el estante elegido (solo en modo edición)
function actualizarTransformador() {
    if (!transformador) return;

    const asa = modoEdicion ? asasPorId.get(idSeleccionado) : null;
    transformador.nodes(asa ? [asa] : []);
    capaEdicion.batchDraw();
}

// Mueve y estira las figuras del estante dibujado (para que sigan al asa en vivo)
function acomodarEstante(id, x, y, ancho, alto) {
    const partes = partesEstantes.get(id);
    if (!partes) return;

    const anchoBarra = ancho - 40;

    partes.grupo.position({ x, y });
    partes.marco.size({ width: ancho, height: alto });
    partes.titulo.width(ancho);
    partes.detalle.width(ancho);
    partes.fondoBarra.setAttrs({ y: alto - 16, width: anchoBarra });
    partes.relleno.setAttrs({
        y: alto - 16,
        width: anchoBarra * Math.min(partes.porcentaje, 1),
    });

    capaEstantes.batchDraw();
}

// Guarda posición y tamaño. Pase lo que pase, después se redibuja con los datos del servidor:
// si lo rechazó, el estante vuelve a su lugar.
async function guardarGeometria(estante, asa) {
    const nueva = {
        posicion_x: ajustarAGrilla(asa.x()),
        posicion_y: ajustarAGrilla(asa.y()),
        ancho: ajustarAGrilla(asa.width() * asa.scaleX()),
        alto: ajustarAGrilla(asa.height() * asa.scaleY()),
    };

    const sinCambios =
        nueva.posicion_x === estante.posicion_x &&
        nueva.posicion_y === estante.posicion_y &&
        nueva.ancho === estante.ancho &&
        nueva.alto === estante.alto;

    if (sinCambios) return;

    try {
        const url = contenedor.dataset.urlGeometria.replace(
            "__ID__",
            estante.id,
        );
        const respuesta = await axios.patch(url, nueva, {
            headers: { "X-CSRF-TOKEN": tokenCsrf() },
        });
        avisar(respuesta.data.mensaje + " ✔", "ok");
    } catch (error) {
        avisar(
            error.response?.data?.mensaje ?? "No se pudo guardar el cambio.",
            "error",
        );
    }

    await cargarDatos();
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
        const productos = ordenarPorCoincidencia(estante.productos);

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

            // El "+N" se resalta si entre las prendas ocultas hay coincidencias
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
    const sinUbicar = ordenarPorCoincidencia(datos.sin_ubicar);
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
            stroke: resaltada ? COLOR_COINCIDENCIA : null,
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
    // Con búsqueda activa, lo que coincide se resalta y lo demás se atenúa
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

    // Un doble click abre la ficha de la prenda (para manejar el stock)
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
        grupo.opacity(opacidadBase); // Vuelve a la opacidad que corresponde según la búsqueda
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