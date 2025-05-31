const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { Cultura } = require('../models');
const { Sequelize } = require('sequelize');
const moment = require('moment');
const sequelize = require('../db');

// Configuração do Multer para upload em memória
const upload = multer({ storage: multer.memoryStorage() }).single('arquivo');

router.post('/importar-excel', (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                error: 'Erro no upload do arquivo',
                details: err.message
            });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            const workbook = xlsx.read(req.file.buffer);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const dadosExcel = xlsx.utils.sheet_to_json(worksheet);

            const culturasParaImportar = dadosExcel.map(item => {
                if (!item.paciente_id || !item.microorganismo || !item.resultado_final) {
                    throw new Error('Dados incompletos no arquivo Excel');
                }

                // ✅ CORREÇÃO DO PARSE DE DATA:
                let dataColeta = new Date(); // fallback
                if (item.data_coleta) {
                    if (typeof item.data_coleta === 'number') {
                        // Quando Excel exporta como número serial
                        const parsed = xlsx.SSF.parse_date_code(item.data_coleta);
                        if (parsed) {
                            dataColeta = new Date(parsed.y, parsed.m - 1, parsed.d);
                        }
                    } else if (typeof item.data_coleta === 'string') {
                        const formatos = ['YYYY-MM-DD', 'DD/MM/YYYY', 'YYYY-MM-DD HH:mm:ss', 'DD/MM/YYYY HH:mm:ss'];
                        const m = moment(item.data_coleta, formatos, true);
                        if (m.isValid()) dataColeta = m.toDate();
                    }
                }

                return {
                    paciente_id: item.paciente_id,
                    data_coleta: dataColeta,
                    local_coleta: item.local_coleta || 'desconhecido',
                    tipo_amostra: item.tipo_amostra || 'não especificado',
                    microorganismo: item.microorganismo,
                    quantidade_ufc_por_ml: item.quantidade_ufc_por_ml || 0,
                    metodo_identificacao: item['método_de_identificação'] || 'não especificado',
                    status_internacao: item.status_internacao || 'não especificado',
                    resultado_final: item.resultado_final
                };
            });

            const result = await Cultura.bulkCreate(culturasParaImportar, {
                validate: true,
                returning: true
            });

            res.json({
                success: true,
                message: `${result.length} registros importados com sucesso`
            });

        } catch (error) {
            console.error('Erro na importação:', error);
            res.status(500).json({
                error: 'Erro ao processar o arquivo',
                details: error.message
            });
        }
    });
});

module.exports = router;
