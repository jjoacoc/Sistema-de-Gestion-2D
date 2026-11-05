import Konva from 'konva';
import { formatearPrecio } from './utilidades.js';

// ------------------------------------------------------------
// Carga de imágenes con memoria: si una imagen ya se pidió, se reutiliza.
// Así, al redibujar el mapa, las miniaturas no vuelven a descargarse.
// ------------------------------------------------------------
const imagenesCargadas = new Map();

export function cargarImagen(url) {
    if (!url) {
        return Promise.reject(new Error('La prenda no tiene imagen'));
    }

    if (!imagenesCargadas.has(url)) {
        imagenesCargadas.set(url, new Promise((resolver, rechazar) => {
            const imagen = new Image();
            imagen.onload = () => resolver(imagen);
            imagen.onerror = () => rechazar(new Error('No se pudo cargar la imagen'));
            imagen.src = url;
        }));
    }

    return imagenesCargadas.get(url);
}

// ------------------------------------------------------------
// Token de seguridad que Laravel exige en las peticiones que modifican datos
// ------------------------------------------------------------
export function tokenCsrf() {
    return document.querySelector('meta[name="csrf-token"]').content;
}

// Texto que muestra el globo al pasar el mouse sobre una prenda
export function textoFicha(producto) {
    return [
        producto.nombre,
        `Código: ${producto.codigo}`,
        `Talle ${producto.talle} · ${producto.color}`,
        `Precio: ${formatearPrecio(producto.precio)}`,
        `Stock: ${producto.cantidad}`,
    ].join('\n');
}

// ------------------------------------------------------------
// Globo de información (tooltip). Konva.Label = una etiqueta con "pico" + un texto
// ------------------------------------------------------------
export function crearGlobo() {
    const globo = new Konva.Label({ visible: false, listening: false });

    globo.add(new Konva.Tag({
        fill: '#111827',
        opacity: 0.92,
        pointerDirection: 'down',
        pointerWidth: 10,
        pointerHeight: 8,
        cornerRadius: 6,
        lineJoin: 'round',
    }));

    globo.add(new Konva.Text({
        text: '',
        fontSize: 12,
        lineHeight: 1.4,
        padding: 8,
        fill: '#ffffff',
    }));

    return globo;
}

// Muestra el globo. "yArriba" es el borde superior de la prenda y "yAbajo" el inferior.
// Si arriba no hay lugar (la prenda está pegada al borde), el globo se muestra debajo.
export function mostrarGlobo(globo, texto, x, yArriba, yAbajo) {
    const hayLugarArriba = yArriba > 110;   // El globo mide unos 100 px de alto

    globo.getText().text(texto);
    globo.getTag().pointerDirection(hayLugarArriba ? 'down' : 'up');
    globo.position({ x, y: hayLugarArriba ? yArriba - 2 : yAbajo + 2 });
    globo.visible(true);
    globo.getLayer().batchDraw();
}

export function ocultarGlobo(globo) {
    globo.visible(false);
    globo.getLayer()?.batchDraw();
}

// ------------------------------------------------------------
// Búsqueda y filtro
// ------------------------------------------------------------

// Pasa a minúsculas y quita las tildes, para que "Camísa" y "camisa" coincidan.
// normalize('NFD') separa cada letra de su tilde, y el replace borra las tildes sueltas.
export function normalizar(texto) {
    return String(texto ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

// ¿La prenda coincide con el texto (en nombre o código) y con la categoría elegida?
// "filtro" tiene la forma { texto: 'jean', categoria: 'Pantalones' }
export function coincideConFiltro(producto, filtro) {
    const texto = normalizar(filtro.texto).trim();

    const coincideTexto = texto === ''
        || normalizar(producto.nombre).includes(texto)
        || normalizar(producto.codigo).includes(texto);

    const coincideCategoria = filtro.categoria === ''
        || producto.categoria === filtro.categoria;

    return coincideTexto && coincideCategoria;
}