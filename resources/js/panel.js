// Gráfico de stock por categoría (Chart.js).
// Los datos los prepara Laravel (PanelController) y llegan en el atributo data-categorias.
import Chart from 'chart.js/auto';
import { formatearPrecio } from './almacen/utilidades.js';

const lienzo = document.getElementById('grafico-categorias');

if (lienzo) {
    // [{ categoria: 'Remeras', unidades: 43, valor: 537500 }, ...]
    const categorias = JSON.parse(lienzo.dataset.categorias);

    // Lo que cambia entre "Unidades" y "Valor"
    const medidas = {
        unidades: { titulo: 'Unidades', color: '#2563eb' },
        valor: { titulo: 'Valor del stock', color: '#16a34a' },
    };

    let medidaActual = 'unidades';

    const grafico = new Chart(lienzo, {
        type: 'bar',
        data: {
            labels: categorias.map((fila) => fila.categoria),
            datasets: [
                {
                    label: medidas.unidades.titulo,
                    data: categorias.map((fila) => fila.unidades),
                    backgroundColor: medidas.unidades.color,
                    borderRadius: 6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // El alto lo manda el contenedor (h-72)
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        // Texto del globo al pasar el mouse sobre una barra
                        label: (contexto) =>
                            medidaActual === 'valor'
                                ? formatearPrecio(contexto.parsed.y)
                                : `${contexto.parsed.y} unidades`,
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        callback: (valor) =>
                            medidaActual === 'valor' ? '$ ' + Number(valor).toLocaleString('es') : valor,
                    },
                },
            },
        },
    });

    // Los botones del panel (Alpine) avisan con este evento cuál medida se eligió
    window.addEventListener('medida-grafico', (evento) => {
        medidaActual = evento.detail;

        const dataset = grafico.data.datasets[0];
        dataset.label = medidas[medidaActual].titulo;
        dataset.backgroundColor = medidas[medidaActual].color;
        dataset.data = categorias.map((fila) => fila[medidaActual]);

        grafico.update(); // Redibuja con animación
    });
}