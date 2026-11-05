// Funciones simples que NO dependen de Konva.
// Por eso pueden cargarse en todas las páginas sin descargar la librería de dibujo.

// Convierte 12500 en "$ 12.500,00"
export function formatearPrecio(precio) {
    return '$ ' + Number(precio).toLocaleString('es', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}