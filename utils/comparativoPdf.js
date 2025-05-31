const PDFDocument = require('pdfkit');

async function gerarPdfComparativo({ comparativo, series, periodo }) {
    try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => { });

        doc.fontSize(18).text('Relatório Comparativo Semanal', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Período: ${periodo.inicio} a ${periodo.fim}`);
        doc.moveDown();

        // Percorre cada microorganismo
        for (const micro in series) {
            doc.fontSize(14).text(`Microorganismo: ${micro}`, { underline: true });
            doc.moveDown(0.5);

            const alertas = series[micro];

            // Cabeçalho da tabela
            doc.fontSize(10).text('Data', { continued: true }).text(' - ', { continued: true }).text('Serviço');

            alertas.forEach(alerta => {
                const dataFormatada = new Date(alerta.data).toLocaleDateString();
                doc.text(`${dataFormatada} - ${alerta.servico || 'N/A'}`);
            });

            doc.moveDown();
        }

        doc.end();

        return await new Promise((resolve, reject) => {
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => {
                console.error('❌ Erro ao gerar o PDF internamente:', err);
                reject(err);
            });
        });
    } catch (err) {
        console.error('❌ Erro dentro de gerarPdfComparativo:', err);
        throw err;
    }
}

module.exports = { gerarPdfComparativo };