
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const { gerarGrafico } = require('./graficoEpidemia');

async function gerarPdfRelatorioHistorico({ series, inicio, fim }) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const stream = new PassThrough();
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Título
            doc.fontSize(20).font('Helvetica-Bold').text('Relatório Histórico de Ocorrência por Microrganismo', { align: 'center' });
            doc.moveDown();

            // Período
            doc.fontSize(12).font('Helvetica').fillColor('black');
            doc.text(`Período: ${inicio} a ${fim}`);
            doc.text(`Total de microrganismos analisados: ${Object.keys(series).length}`);
            doc.moveDown();

            const micOrdenados = Object.entries(series).sort((a, b) => b[1].length - a[1].length);

            for (const [microorganismo, dados] of micOrdenados) {
                doc.fontSize(13).font('Helvetica-Bold').text(`➡ ${microorganismo}`, { align: 'left' });
                doc.moveDown(0.5);

                const imagemBuffer = await gerarGrafico(dados, microorganismo);
                doc.image(imagemBuffer, {
                    fit: [500, 300],
                    align: 'center',
                    valign: 'center',
                });
                doc.addPage();
            }

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { gerarPdfRelatorioHistorico };
