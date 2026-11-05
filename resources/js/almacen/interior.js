import Konva from "konva";
import axios from "axios";
import {
    cargarImagen,
    tokenCsrf,
    crearGlobo,
    mostrarGlobo,
    ocultarGlobo,
    textoFicha,
} from "./compartido.js";

// ------------------------------------------------------------
// Medidas (en píxeles)
// ------------------------------------------------------------
const ANCHO_PRENDA = 120;
const ALTO_PRENDA = 140;
const TAMANO_IMAGEN = 100; // La imagen se ajusta a un cuadrado de 100 x 100
const PASO_X = 160; // Distancia entre casilleros de una misma fila (120 de prenda + 40 de aire)
const PASO_Y = 180; // Alto de cada fila (140 de prenda + 40 de aire)
const MARGEN_SUPERIOR = 40;
const ALTO_MINIMO = 380; // Alto mínimo del escenario (equivale a 2 filas)

// Colores de los casilleros
const CASILLERO_RELLENO = "rgba(255, 255, 255, 0.55)";
const CASILLERO_BORDE = "#cbd5e1";
const RESALTADOS = {
    libre: { relleno: "#bfdbfe", borde: "#3b82f6" }, // Azul: se puede soltar aquí
    intercambio: { relleno: "#fde68a", borde: "#f59e0b" }, // Amarillo: se intercambiará con la prenda que hay
    bloqueado: { relleno: "#fecaca", borde: "#dc2626" }, // Rojo: no se puede soltar aquí
};

const contenedor = document.getElementById("interior-estante");

// ------------------------------------------------------------
// Estado del estante ampliado
// ------------------------------------------------------------
let escenario = null; // El escenario actual (null si el modal está cerrado)
let capaFondo = null; // Pared, tablas de madera y casilleros
let capaPrendas = null; // Las prendas
let globo = null; // El globo de información
let estanteActual = null; // El estante abierto (id, nombre, capacidad, por_fila...)
let desplazamientoX = 0; // Margen izquierdo para centrar los casilleros
let rectangulosCasilleros = []; // Un rectángulo por casillero (para resaltarlos)
let prendas = []; // Las prendas dibujadas

// ------------------------------------------------------------
// Punto de entrada: escuchamos los avisos del modal (Alpine) y del navegador
// ------------------------------------------------------------
if (contenedor) {
    window.addEventListener("abrir-estante", (evento) =>
        abrirEstante(evento.detail),
    );
    window.addEventListener("cerrar-estante", cerrarEstante);

    // Eventos para recibir prendas arrastradas desde el panel HTML "Sin ubicar"
    contenedor.addEventListener("dragover", permitirSoltar);
    contenedor.addEventListener("dragleave", () => resaltarCasillero(null));
    contenedor.addEventListener("drop", soltarPrendaNueva);
    // NUEVO (paso 8): si cambia el inventario (por ejemplo el stock desde la ficha), se vuelve a cargar el estante
    window.addEventListener("inventario-actualizado", recargarInterior);
}

// ------------------------------------------------------------
// Abrir: crea el escenario según el tamaño del estante, pide las prendas y las dibuja
// ------------------------------------------------------------
async function abrirEstante(estante) {
    cerrarEstante(); // Por si quedó uno abierto antes
    estanteActual = estante;

    // Cuántas filas hacen falta y cuánto mide el escenario
    const filas = Math.ceil(estante.capacidad / estante.por_fila);
    const alto = Math.max(ALTO_MINIMO, filas * PASO_Y + 20);

    const nuevo = new Konva.Stage({
        container: contenedor,
        width: contenedor.clientWidth,
        height: alto,
    });
    escenario = nuevo;

    // Para centrar los casilleros horizontalmente
    const anchoCasilleros = estante.por_fila * PASO_X - (PASO_X - ANCHO_PRENDA);
    desplazamientoX = Math.max(10, (nuevo.width() - anchoCasilleros) / 2);

    capaFondo = new Konva.Layer({ listening: false });
    capaPrendas = new Konva.Layer();
    const capaGlobo = new Konva.Layer({ listening: false });
    nuevo.add(capaFondo);
    nuevo.add(capaPrendas);
    nuevo.add(capaGlobo);

    globo = crearGlobo();
    capaGlobo.add(globo);

    dibujarFondo(filas, alto);

    avisar("Cargando prendas...", "info");
    cargarSinUbicar(); // Llena el panel lateral

    // Pedimos al servidor las prendas de este estante
    let productos;
    try {
        const url = contenedor.dataset.urlProductos.replace(
            "__ID__",
            estante.id,
        );
        const respuesta = await axios.get(url);
        productos = respuesta.data;
    } catch (error) {
        avisar("No se pudieron cargar las prendas.", "error");
        return;
    }

    // Si mientras cargaba el usuario cerró el modal, no seguimos
    if (escenario !== nuevo) return;

    // Creamos todas las prendas; esperamos a que carguen sus imágenes
    const grupos = await Promise.all(
        productos.map((datos) => crearPrenda(datos)),
    );

    if (escenario !== nuevo) return;

    grupos.forEach((grupo) => {
        capaPrendas.add(grupo);
        prendas.push(grupo);
    });
    capaPrendas.batchDraw();

    avisar(
        productos.length === 0
            ? "Este estante está vacío. Arrastra prendas desde el panel de la derecha."
            : "Arrastra una prenda a otro casillero. Si lo sueltas sobre otra prenda, se intercambian.",
        "info",
    );
}

// ------------------------------------------------------------
// Cerrar: destruye el escenario para liberar memoria
// ------------------------------------------------------------
function cerrarEstante() {
    if (escenario) {
        escenario.destroy();
        escenario = null;
    }
    capaFondo = null;
    capaPrendas = null;
    globo = null;
    estanteActual = null;
    rectangulosCasilleros = [];
    prendas = [];
}

// ------------------------------------------------------------
// NUEVO (paso 8): vuelve a cargar el estante abierto (si hay uno) para mostrar los datos al día
// ------------------------------------------------------------
function recargarInterior() {
    if (escenario && estanteActual) {
        abrirEstante(estanteActual);
    }
}

// ------------------------------------------------------------
// Pide las prendas sin ubicar y se las pasa al panel (Alpine)
// ------------------------------------------------------------
async function cargarSinUbicar() {
    try {
        const respuesta = await axios.get(contenedor.dataset.urlSinUbicar);
        window.dispatchEvent(
            new CustomEvent("sin-ubicar-cargadas", { detail: respuesta.data }),
        );
    } catch (error) {
        avisar("No se pudo cargar la lista de prendas sin ubicar.", "error");
    }
}

// ------------------------------------------------------------
// Casilleros: de un número (0, 1, 2...) a su posición en pantalla
// ------------------------------------------------------------
function posicionDeCasillero(numero) {
    const fila = Math.floor(numero / estanteActual.por_fila);
    const columna = numero % estanteActual.por_fila;

    return {
        x: desplazamientoX + columna * PASO_X,
        y: MARGEN_SUPERIOR + fila * PASO_Y,
    };
}

// Devuelve el número del casillero más cercano a un punto de la pantalla
function casilleroMasCercano(punto) {
    let mejor = 0;
    let menorDistancia = Infinity;

    for (let numero = 0; numero < estanteActual.capacidad; numero++) {
        const { x, y } = posicionDeCasillero(numero);

        const dx = punto.x - (x + ANCHO_PRENDA / 2);
        const dy = punto.y - (y + ALTO_PRENDA / 2);
        const distancia = dx * dx + dy * dy; // Sin raíz cuadrada: alcanza para comparar

        if (distancia < menorDistancia) {
            menorDistancia = distancia;
            mejor = numero;
        }
    }

    return mejor;
}

// ¿Qué prenda hay en ese casillero? ("excepto" es la prenda que se está moviendo)
function prendaEnCasillero(numero, excepto) {
    return prendas.find(
        (prenda) =>
            prenda !== excepto && prenda.getAttr("casillero") === numero,
    );
}

// Pinta un casillero según el estado ('libre', 'intercambio', 'bloqueado'). null = quita todo resaltado
function resaltarCasillero(numero, estado = "libre") {
    if (!capaFondo) return;

    rectangulosCasilleros.forEach((rectangulo, indice) => {
        const colores =
            indice === numero
                ? RESALTADOS[estado]
                : { relleno: CASILLERO_RELLENO, borde: CASILLERO_BORDE };

        rectangulo.fill(colores.relleno);
        rectangulo.stroke(colores.borde);
    });

    capaFondo.batchDraw();
}

// Mueve una prenda (con animación) hasta su casillero y lo anota en la prenda
function colocarEnCasillero(grupo, numero) {
    grupo.setAttr("casillero", numero);
    const { x, y } = posicionDeCasillero(numero);

    new Konva.Tween({
        node: grupo,
        duration: 0.2,
        x: x,
        y: y,
        easing: Konva.Easings.EaseOut,
    }).play();
}

// ------------------------------------------------------------
// Fondo: pared, una tabla de madera por fila y un recuadro punteado por casillero
// ------------------------------------------------------------
function dibujarFondo(filas, alto) {
    capaFondo.add(
        new Konva.Rect({
            width: escenario.width(),
            height: alto,
            fill: "#f8fafc",
        }),
    );

    // Una tabla de madera debajo de cada fila
    for (let fila = 0; fila < filas; fila++) {
        capaFondo.add(
            new Konva.Rect({
                x: 0,
                y: MARGEN_SUPERIOR + fila * PASO_Y + ALTO_PRENDA,
                width: escenario.width(),
                height: 10,
                fill: "#d6b58a",
            }),
        );
    }

    // Un casillero por cada lugar del estante, con su número
    rectangulosCasilleros = [];

    for (let numero = 0; numero < estanteActual.capacidad; numero++) {
        const { x, y } = posicionDeCasillero(numero);

        const rectangulo = new Konva.Rect({
            x: x,
            y: y,
            width: ANCHO_PRENDA,
            height: ALTO_PRENDA,
            fill: CASILLERO_RELLENO,
            stroke: CASILLERO_BORDE,
            strokeWidth: 1.5,
            dash: [6, 4],
            cornerRadius: 8,
        });

        rectangulosCasilleros.push(rectangulo);
        capaFondo.add(rectangulo);

        // El número se muestra a partir de 1 (el casillero 0 es el "1")
        capaFondo.add(
            new Konva.Text({
                text: String(numero + 1),
                x: x + 8,
                y: y + 6,
                fontSize: 12,
                fontStyle: "bold",
                fill: "#94a3b8",
            }),
        );
    }
}

// ------------------------------------------------------------
// Dibuja una prenda: tarjeta + imagen + textos + globo con el stock
// ------------------------------------------------------------
async function crearPrenda(datos) {
    const casillero = datos.casillero ?? 0;
    const posicion = posicionDeCasillero(casillero);

    // El Group se puede arrastrar y mueve todas sus figuras juntas
    const grupo = new Konva.Group({
        x: posicion.x,
        y: posicion.y,
        draggable: true,
        dragBoundFunc: limitarAlEscenario,
    });
    grupo.setAttr("casillero", casillero);

    const tarjeta = new Konva.Rect({
        width: ANCHO_PRENDA,
        height: ALTO_PRENDA,
        fill: "rgba(255, 255, 255, 0.95)",
        stroke: "#e5e7eb",
        strokeWidth: 1,
        cornerRadius: 8,
    });
    grupo.add(tarjeta);

    // Imagen de la prenda; si falla, dibujamos un recuadro gris con un aviso
    try {
        const imagen = await cargarImagen(datos.imagen_url);

        // Ajustamos la imagen al cuadrado de 100 x 100 sin deformarla
        const escala = Math.min(
            TAMANO_IMAGEN / imagen.width,
            TAMANO_IMAGEN / imagen.height,
        );
        const ancho = imagen.width * escala;
        const alto = imagen.height * escala;

        grupo.add(
            new Konva.Image({
                image: imagen,
                x: (ANCHO_PRENDA - ancho) / 2,
                y: 6 + (TAMANO_IMAGEN - alto) / 2,
                width: ancho,
                height: alto,
            }),
        );
    } catch (error) {
        grupo.add(
            new Konva.Rect({
                x: (ANCHO_PRENDA - TAMANO_IMAGEN) / 2,
                y: 6,
                width: TAMANO_IMAGEN,
                height: TAMANO_IMAGEN,
                fill: "#d1d5db",
                cornerRadius: 6,
            }),
        );
        grupo.add(
            new Konva.Text({
                text: "Sin imagen",
                x: 0,
                y: 50,
                width: ANCHO_PRENDA,
                align: "center",
                fontSize: 12,
                fill: "#6b7280",
            }),
        );
    }

    // Nombre (una sola línea; si es largo se corta con "...")
    grupo.add(
        new Konva.Text({
            text: datos.nombre,
            x: 4,
            y: 108,
            width: ANCHO_PRENDA - 8,
            height: 14,
            align: "center",
            wrap: "none",
            ellipsis: true,
            fontSize: 12,
            fontStyle: "bold",
            fill: "#1f2937",
        }),
    );

    // Talle y color
    grupo.add(
        new Konva.Text({
            text: `${datos.talle} · ${datos.color}`,
            x: 4,
            y: 124,
            width: ANCHO_PRENDA - 8,
            align: "center",
            fontSize: 11,
            fill: "#6b7280",
        }),
    );

    // Globo azul con la cantidad en stock, arriba a la derecha
    grupo.add(
        new Konva.Circle({
            x: ANCHO_PRENDA - 12,
            y: 12,
            radius: 12,
            fill: "#2563eb",
        }),
    );
    grupo.add(
        new Konva.Text({
            text: String(datos.cantidad),
            x: ANCHO_PRENDA - 24,
            y: 7,
            width: 24,
            align: "center",
            fontSize: 11,
            fontStyle: "bold",
            fill: "#ffffff",
        }),
    );

    // --- Interacción ---

    grupo.on("mouseenter", () => {
        escenario.container().style.cursor = "grab";
        mostrarGlobo(
            globo,
            textoFicha(datos),
            grupo.x() + ANCHO_PRENDA / 2,
            grupo.y(),
            grupo.y() + ALTO_PRENDA,
        );
    });

    grupo.on("mouseleave", () => {
        escenario.container().style.cursor = "default";
        ocultarGlobo(globo);
    });

    // NUEVO (paso 8): un click (sin arrastrar) abre la ficha de la prenda
    grupo.on("click tap", () => {
        window.dispatchEvent(new CustomEvent("abrir-ficha", { detail: datos }));
    });

    grupo.on("dragstart", () => {
        ocultarGlobo(globo);
        grupo.moveToTop(); // La prenda arrastrada se dibuja por encima de las demás
        tarjeta.setAttrs({
            shadowColor: "black",
            shadowBlur: 12,
            shadowOpacity: 0.3,
            shadowOffset: { x: 4, y: 4 },
        });
        escenario.container().style.cursor = "grabbing";
    });

    // Mientras se arrastra, resaltamos el casillero que quedaría elegido
    grupo.on("dragmove", () => {
        const destino = casilleroMasCercano(centroDe(grupo));
        const hayOtraPrenda = prendaEnCasillero(destino, grupo);
        const esElMismo = destino === grupo.getAttr("casillero");

        resaltarCasillero(
            destino,
            hayOtraPrenda && !esElMismo ? "intercambio" : "libre",
        );
    });

    grupo.on("dragend", async () => {
        tarjeta.setAttrs({ shadowBlur: 0, shadowOpacity: 0 });
        escenario.container().style.cursor = "grab";

        const casilleroOrigen = grupo.getAttr("casillero");
        const casilleroDestino = casilleroMasCercano(centroDe(grupo));
        resaltarCasillero(null);

        // Soltada en su mismo casillero: solo vuelve a encajar
        if (casilleroDestino === casilleroOrigen) {
            colocarEnCasillero(grupo, casilleroOrigen);
            return;
        }

        // ¿Hay otra prenda en el destino? Entonces se intercambian
        const ocupante = prendaEnCasillero(casilleroDestino, grupo);

        // Movimiento visual inmediato (la pantalla responde sin esperar al servidor)
        colocarEnCasillero(grupo, casilleroDestino);
        if (ocupante) {
            colocarEnCasillero(ocupante, casilleroOrigen);
        }

        // Guardamos en el servidor; si falla, deshacemos el movimiento
        const guardado = await guardarCasillero(datos.id, casilleroDestino);

        if (!guardado) {
            colocarEnCasillero(grupo, casilleroOrigen);
            if (ocupante) {
                colocarEnCasillero(ocupante, casilleroDestino);
            }
        }
    });

    return grupo;
}

// Centro de una prenda (para saber a qué casillero se parece más)
function centroDe(grupo) {
    return { x: grupo.x() + ANCHO_PRENDA / 2, y: grupo.y() + ALTO_PRENDA / 2 };
}

// ------------------------------------------------------------
// Impide que una prenda salga del escenario mientras se arrastra
// ------------------------------------------------------------
function limitarAlEscenario(posicion) {
    return {
        x: Math.max(0, Math.min(posicion.x, escenario.width() - ANCHO_PRENDA)),
        y: Math.max(0, Math.min(posicion.y, escenario.height() - ALTO_PRENDA)),
    };
}

// ------------------------------------------------------------
// Arrastre desde el panel "Sin ubicar" (HTML) hacia el estante
// ------------------------------------------------------------

// El navegador solo permite soltar si "dragover" se cancela.
// Aprovechamos para resaltar el casillero que está bajo el puntero.
function permitirSoltar(evento) {
    evento.preventDefault();
    evento.dataTransfer.dropEffect = "copy";

    if (!escenario) return;

    escenario.setPointersPositions(evento);
    const numero = casilleroMasCercano(escenario.getPointerPosition());

    resaltarCasillero(
        numero,
        prendaEnCasillero(numero, null) ? "bloqueado" : "libre",
    );
}

// Se soltó sobre el estante una prenda arrastrada desde el panel
async function soltarPrendaNueva(evento) {
    evento.preventDefault(); // Evita que el navegador intente "abrir" lo arrastrado
    resaltarCasillero(null);

    if (!escenario) return;

    // Los datos de la prenda viajan dentro del arrastre (los puso el panel)
    const texto = evento.dataTransfer.getData("application/json");
    if (!texto) return;
    const producto = JSON.parse(texto);

    // Validación 1: ¿hay lugar en el estante?
    if (prendas.length >= estanteActual.capacidad) {
        avisar(
            "El estante está lleno. Libera espacio o elige otro estante.",
            "error",
        );
        return;
    }

    // Validación 2: el casillero más cercano al puntero, ¿está libre?
    escenario.setPointersPositions(evento);
    const casillero = casilleroMasCercano(escenario.getPointerPosition());

    if (prendaEnCasillero(casillero, null)) {
        avisar(
            `El casillero ${casillero + 1} ya está ocupado. Suéltala en uno libre.`,
            "error",
        );
        return;
    }

    // Guardamos en el servidor
    const escenarioAlSoltar = escenario;

    try {
        const url = contenedor.dataset.urlUbicar.replace("__ID__", producto.id);
        const respuesta = await axios.patch(
            url,
            { estante_id: estanteActual.id, casillero: casillero },
            { headers: { "X-CSRF-TOKEN": tokenCsrf() } },
        );

        // Dibujamos la prenda (si el modal sigue abierto)
        if (escenario === escenarioAlSoltar) {
            const grupo = await crearPrenda({
                ...producto,
                casillero: casillero,
            });
            capaPrendas.add(grupo);
            prendas.push(grupo);
            capaPrendas.batchDraw();
        }

        avisar(respuesta.data.mensaje + " ✔", "ok");

        // Avisamos al panel (para sacarla de la lista) y al mapa (para actualizar el conteo)
        window.dispatchEvent(
            new CustomEvent("prenda-ubicada", {
                detail: { id: producto.id, ocupados: respuesta.data.ocupados },
            }),
        );
    } catch (error) {
        avisar(
            error.response?.data?.mensaje ?? "No se pudo ubicar la prenda.",
            "error",
        );
    }
}

// ------------------------------------------------------------
// Guarda el casillero en el servidor. Devuelve true si salió bien
// ------------------------------------------------------------
async function guardarCasillero(idProducto, casillero) {
    const url = contenedor.dataset.urlCasillero.replace("__ID__", idProducto);

    try {
        const respuesta = await axios.patch(
            url,
            { casillero: casillero },
            { headers: { "X-CSRF-TOKEN": tokenCsrf() } },
        );
        avisar(respuesta.data.mensaje + " ✔", "ok");
        return true;
    } catch (error) {
        avisar(
            error.response?.data?.mensaje ??
                "No se pudo guardar. La prenda volvió a su lugar.",
            "error",
        );
        return false;
    }
}

// ------------------------------------------------------------
// Envía un mensaje al modal (Alpine) para mostrarlo en pantalla
// ------------------------------------------------------------
function avisar(mensaje, tipo) {
    window.dispatchEvent(
        new CustomEvent("interior-estado", { detail: { mensaje, tipo } }),
    );
}
