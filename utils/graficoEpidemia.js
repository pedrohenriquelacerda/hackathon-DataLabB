const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const largura = 800;
const altura = 400;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: largura, height: altura });

async function gerarGrafico(series, microorganismo) {
    const labels = series.map(p => p.ano_semana);
    const data = series.map(p => p.total);

    const configuration = {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: `Casos semanais — ${microorganismo}`,
                data,
                fill: false,
                borderColor: 'red',
                tension: 0.2,
                pointRadius: 3,
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: `Evolução Temporal - ${microorganismo}`,
                    font: { size: 18 }
                },
                legend: {
                    display: true,
                    position: 'bottom'
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Ano-Semana' }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Número de Casos' }
                }
            }
        }
    };

    return await chartJSNodeCanvas.renderToBuffer(configuration);
}

module.exports = { gerarGrafico };
