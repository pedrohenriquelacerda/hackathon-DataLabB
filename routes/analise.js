// routes/analise.js
const express = require('express');
const { gerarGrafico } = require('../utils/graficoEpidemia');
const { gerarPdfComparativo } = require('../utils/comparativoPdf');
const router = express.Router();
const { Cultura } = require('../models');
const { Sequelize } = require('sequelize');
const Op = Sequelize.Op;
const moment = require('moment');
const sequelize = require('../db');
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const { gerarPdfRelatorioHistorico } = require('../utils/historicoPdf');


function calcMediaStd(arr) {
    if (!arr.length) return { mean: 0, std: 0 };
    const soma = arr.reduce((acc, v) => acc + v, 0);
    const mean = soma / arr.length;
    const variancia = arr.reduce((acc, v) => acc + (v - mean) ** 2, 0) / arr.length;
    return { mean, std: Math.sqrt(variancia) };
}

function calcIC95(arr) {
    const n = arr.length;
    const { mean, std } = calcMediaStd(arr);
    const ic95 = n > 1 ? 1.96 * (std / Math.sqrt(n)) : 0;
    return { mean, ic95 };
}

async function gerarAlertasEpidemiologicos() {
    const fim = moment().endOf('day');
    const inicio = moment(fim).subtract(12, 'months').startOf('day');

    const registros = await Cultura.findAll({
        attributes: [
            [sequelize.literal("DATE_FORMAT(data_coleta, '%x-%v')"), 'ano_semana'],
            'microorganismo',
            [sequelize.fn('COUNT', sequelize.col('coleta_id')), 'total'],
        ],
        where: {
            data_coleta: { [Op.between]: [inicio.toDate(), fim.toDate()] }
        },
        group: ['ano_semana', 'microorganismo'],
        order: [[sequelize.literal('ano_semana')]],
        raw: true,
    });

    const agrupado = {};
    registros.forEach(r => {
        const key = r.microorganismo;
        if (!agrupado[key]) agrupado[key] = [];
        agrupado[key].push({
            ano_semana: r.ano_semana,
            total: parseInt(r.total)
        });
    });

    const alertas = [];

    Object.entries(agrupado).forEach(([micro, series]) => {
        series.sort((a, b) => a.ano_semana.localeCompare(b.ano_semana));
        if (series.length < 6) return;

        for (let i = 5; i < series.length; i++) {
            const historico = series.slice(i - 5, i).map(x => x.total);
            const semanaAtual = series[i];
            const { mean, ic95 } = calcIC95(historico);

            if (semanaAtual.total > mean + ic95) {
                alertas.push({
                    microorganismo: micro,
                    semana: semanaAtual.ano_semana,
                    total_semana: semanaAtual.total,
                    media_historica: parseFloat(mean.toFixed(2)),
                    ic95: parseFloat(ic95.toFixed(2)),
                    limite_alerta: parseFloat((mean + ic95).toFixed(2)),
                    mensagem: `🚨 Surto detectado: ${micro} na semana ${semanaAtual.ano_semana} com ${semanaAtual.total} casos — ultrapassa limite (${(mean + ic95).toFixed(2)})`
                });
            }
        }
    });

    return {
        total_registros: registros.reduce((acc, r) => acc + parseInt(r.total), 0),
        microrganismos_analisados: Object.keys(agrupado),
        semanas_agrupadas: [...new Set(registros.map(r => r.ano_semana))],
        total_alertas: alertas.length,
        alertas
    };
}

router.get('/alertas/epidemiologicos', async (req, res) => {
    try {
        console.log('🔎 Iniciando análise epidemiológica...');
        const resultado = await gerarAlertasEpidemiologicos();
        res.json(resultado);
    } catch (error) {
        console.error('❌ Erro na análise:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/alertas/epidemiologicos/pdf', async (req, res) => {
    try {
        console.log('📄 Gerando PDF com análise epidemiológica...');
        const resultado = await gerarAlertasEpidemiologicos();

        const doc = new PDFDocument({ margin: 50 });
        const stream = new PassThrough();
        res.setHeader('Content-disposition', 'inline; filename="relatorio_alertas_epidemiologicos.pdf"');
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(stream);

        // Título
        doc.fontSize(20).font('Helvetica-Bold').text('Relatório de Alertas Epidemiológicos', { align: 'center' });
        doc.moveDown();

        // Sumário
        doc.fontSize(12).font('Helvetica').fillColor('black');
        doc.text(`Período: Últimos 12 meses até ${moment().format('DD/MM/YYYY')}`);
        doc.text(`Microrganismos analisados: ${resultado.microrganismos_analisados.length}`);
        doc.text(`Semanas avaliadas: ${resultado.semanas_agrupadas.length}`);
        doc.text(`Total de surtos detectados: ${resultado.total_alertas}`);
        doc.moveDown();

        // Lista de Microrganismos
        doc.fontSize(14).font('Helvetica-Bold').text('Microrganismos Analisados:', { underline: true });
        doc.fontSize(11).font('Helvetica').list(resultado.microrganismos_analisados);
        doc.moveDown();

        // Classificar alertas
        const urgentes = [];
        const comuns = [];

        resultado.alertas.forEach(alerta => {
            const excesso = alerta.total_semana - alerta.limite_alerta;
            const tipo = excesso > alerta.ic95 ? 'URGENTE' : 'ALERTA';
            const rotulo = `[${tipo}]`;
            const cor = tipo === 'URGENTE' ? 'red' : 'orange';
            const gravidade = { ...alerta, excesso, tipo, rotulo, cor };
            if (tipo === 'URGENTE') urgentes.push(gravidade);
            else comuns.push(gravidade);
        });

        const ordenar = (a, b) => {
            const semDiff = b.semana.localeCompare(a.semana);
            if (semDiff !== 0) return semDiff;
            return b.excesso - a.excesso;
        };

        urgentes.sort(ordenar);
        comuns.sort(ordenar);

        // Renderiza alertas no PDF
        const desenharAlertas = (lista, titulo) => {
            if (!lista.length) return;

            doc.fontSize(14).font('Helvetica-Bold').fillColor(lista[0].cor).text(titulo, { underline: true });
            doc.moveDown(0.5);

            lista.forEach((a, i) => {
                doc.font('Helvetica-Bold').fillColor(a.cor).fontSize(11)
                    .text(`${a.rotulo} ${i + 1}. ${a.microorganismo} — Semana ${a.semana}`);

                doc.font('Courier').fillColor('black').fontSize(10);
                doc.text(`   Casos na Semana    : ${a.total_semana}`);
                doc.text(`   Média Histórica    : ${a.media_historica}`);
                doc.text(`   IC95               : ±${a.ic95}`);
                doc.text(`   Limite de Alerta   : ${a.limite_alerta}`);
                doc.text(`   Excesso Absoluto   : ${a.excesso}`);
                doc.moveDown();
                doc.font('Helvetica');
            });
        };

        if (urgentes.length || comuns.length) {
            desenharAlertas(urgentes, 'Alertas URGENTES (acima de 2x IC95)');
            doc.moveDown();
            desenharAlertas(comuns, 'Alertas COMUNS (acima do IC95)');
        } else {
            doc.fontSize(12).fillColor('black').text('Nenhum surto foi detectado neste período.');
        }

        doc.moveDown();

        // 🔍 Agrupar alertas por microrganismo para gerar gráficos
        const micData = {};

        resultado.alertas.forEach(alerta => {
            if (!micData[alerta.microorganismo]) {
                micData[alerta.microorganismo] = {
                    microorganismo: alerta.microorganismo,
                    total_excesso: 0,
                    frequencia_alertas: 0,
                    series: [],
                };
            }
            micData[alerta.microorganismo].total_excesso += alerta.total_semana - alerta.limite_alerta;
            micData[alerta.microorganismo].frequencia_alertas += 1;
            micData[alerta.microorganismo].series.push({
                ano_semana: alerta.semana,
                total: alerta.total_semana,
            });
        });

        const micOrdenados = Object.values(micData).sort((a, b) => {
            if (b.total_excesso !== a.total_excesso) {
                return b.total_excesso - a.total_excesso;
            }
            return b.frequencia_alertas - a.frequencia_alertas;
        });

        // 📊 Título dos gráficos
        doc.fontSize(16).font('Helvetica-Bold').fillColor('black').text('Gráficos de Tendência por Microrganismo com Surto', {
            align: 'center',
        });
        doc.moveDown();

        // Geração dos gráficos ordenados
        for (const mic of micOrdenados) {
            const imagemBuffer = await gerarGrafico(
                mic.series.sort((a, b) => a.ano_semana.localeCompare(b.ano_semana)),
                mic.microorganismo
            );

            doc.fontSize(13).font('Helvetica-Bold').fillColor('black').text(`➡ ${mic.microorganismo}`, { align: 'left' });
            doc.moveDown(0.5);
            doc.image(imagemBuffer, {
                fit: [500, 300],
                align: 'center',
                valign: 'center',
            });
            doc.moveDown(1);
        }

        doc.end();
        stream.pipe(res);
    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/alertas/epidemiologicos/comparativo', async (req, res) => {
    try {
        console.log('📊 Iniciando análise comparativa semanal...');

        const fim = moment().endOf('isoWeek');
        const inicio = moment(fim).subtract(6, 'weeks').startOf('isoWeek');

        const registros = await Cultura.findAll({
            attributes: [
                [sequelize.literal("DATE_FORMAT(data_coleta, '%x-%v')"), 'ano_semana'],
                'microorganismo',
                [sequelize.fn('COUNT', sequelize.col('coleta_id')), 'total'],
            ],
            where: {
                data_coleta: { [Op.between]: [inicio.toDate(), fim.toDate()] }
            },
            group: ['ano_semana', 'microorganismo'],
            order: [[sequelize.literal('ano_semana'), 'ASC']],
            raw: true,
        });

        // Agrupar dados por microrganismo
        const porMicro = {};
        registros.forEach(r => {
            const mic = r.microorganismo;
            if (!porMicro[mic]) porMicro[mic] = [];
            porMicro[mic].push({
                semana: r.ano_semana,
                total: parseInt(r.total)
            });
        });

        const comparativo = [];

        Object.entries(porMicro).forEach(([micro, dados]) => {
            dados.sort((a, b) => a.semana.localeCompare(b.semana));
            for (let i = 1; i < dados.length; i++) {
                const anterior = dados[i - 1];
                const atual = dados[i];
                const variacao = atual.total - anterior.total;
                const percentual = anterior.total > 0 ? (variacao / anterior.total) * 100 : 100;

                comparativo.push({
                    microorganismo: micro,
                    semana_anterior: anterior.semana,
                    semana_atual: atual.semana,
                    casos_anteriores: anterior.total,
                    casos_atuais: atual.total,
                    variacao,
                    percentual: parseFloat(percentual.toFixed(2)),
                    alerta: percentual > 50 && atual.total >= 3
                        ? 'Aumento significativo'
                        : percentual < -50 && anterior.total >= 3
                            ? 'Redução expressiva'
                            : 'Estável'
                });
            }
        });

        // Ordenar por semana atual, depois por maior aumento percentual
        comparativo.sort((a, b) => {
            const sem = b.semana_atual.localeCompare(a.semana_atual);
            if (sem !== 0) return sem;
            return b.percentual - a.percentual;
        });

        res.json({
            periodo: {
                inicio: inicio.format('YYYY-MM-DD'),
                fim: fim.format('YYYY-MM-DD')
            },
            total_microorganismos: Object.keys(porMicro).length,
            comparacoes_realizadas: comparativo.length,
            comparativo
        });
    } catch (error) {
        console.error('Erro na análise comparativa:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/alertas/epidemiologicos/comparativo/pdf', async (req, res) => {
    try {
        console.log('Gerando PDF com comparativo alarmante...');

        const fim = moment().endOf('isoWeek');
        const inicio = moment(fim).subtract(3, 'weeks').startOf('isoWeek');

        const registros = await Cultura.findAll({
            attributes: [
                [sequelize.literal("DATE_FORMAT(data_coleta, '%x-%v')"), 'ano_semana'],
                'microorganismo',
                [sequelize.fn('COUNT', sequelize.col('coleta_id')), 'total'],
            ],
            where: {
                data_coleta: { [Op.between]: [inicio.toDate(), fim.toDate()] }
            },
            group: ['ano_semana', 'microorganismo'],
            order: [[sequelize.literal('ano_semana'), 'ASC']],
            raw: true,
        });

        const porMicro = {};
        registros.forEach(r => {
            const mic = r.microorganismo;
            if (!porMicro[mic]) porMicro[mic] = [];
            porMicro[mic].push({
                semana: r.ano_semana,
                total: parseInt(r.total)
            });
        });

        const comparativo = [];

        Object.entries(porMicro).forEach(([micro, dados]) => {
            dados.sort((a, b) => a.semana.localeCompare(b.semana));
            for (let i = 1; i < dados.length; i++) {
                const anterior = dados[i - 1];
                const atual = dados[i];
                const variacao = atual.total - anterior.total;
                const percentual = anterior.total > 0 ? (variacao / anterior.total) * 100 : 100;

                const alerta = percentual > 50 && atual.total >= 3
                    ? 'Aumento significativo'
                    : null;

                if (alerta) {
                    comparativo.push({
                        microorganismo: micro,
                        semana_anterior: anterior.semana,
                        semana_atual: atual.semana,
                        casos_anteriores: anterior.total,
                        casos_atuais: atual.total,
                        variacao,
                        percentual: parseFloat(percentual.toFixed(2)),
                        alerta
                    });
                }
            }
        });

        // Ordenar por semana e variação
        comparativo.sort((a, b) => {
            const sem = b.semana_atual.localeCompare(a.semana_atual);
            if (sem !== 0) return sem;
            return b.percentual - a.percentual;
        });

        // Geração do PDF
        const doc = new PDFDocument({ margin: 50 });
        const stream = new PassThrough();

        res.setHeader('Content-disposition', 'inline; filename="comparativo_alarmante.pdf"');
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(stream);

        doc.fontSize(18).font('Helvetica-Bold').text('Alerta: Aumento Significativo de Microrganismos', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(`Período analisado: ${inicio.format('DD/MM/YYYY')} a ${fim.format('DD/MM/YYYY')}`);
        doc.text(`Microrganismos com aumento significativo: ${comparativo.length}`);
        doc.moveDown();

        if (comparativo.length === 0) {
            doc.fontSize(12).fillColor('black').text('Nenhum aumento alarmante detectado nas últimas semanas.');
        } else {
            comparativo.forEach((item, i) => {
                doc.fontSize(13).fillColor('red').font('Helvetica-Bold')
                    .text(`${i + 1}. ${item.microorganismo} — Semana ${item.semana_atual}`);

                doc.fontSize(11).fillColor('black').font('Courier')
                    .text(`   Casos na semana anterior : ${item.casos_anteriores}`)
                    .text(`   Casos na semana atual    : ${item.casos_atuais}`)
                    .text(`   Variação absoluta        : ${item.variacao}`)
                    .text(`   Aumento percentual       : ${item.percentual}%`)
                    .text(`   Classificação            : ${item.alerta}`);
                doc.moveDown();
            });
        }

        doc.end();
        stream.pipe(res);
    } catch (error) {
        console.error('Erro ao gerar PDF comparativo:', error);
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
