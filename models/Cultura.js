const { Cultura } = require(".");

module.exports = (sequelize, DataTypes) => {
  const Cultura = sequelize.define('Cultura', {
    coleta_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    paciente_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: {
          msg: 'ID do paciente deve ser um número inteiro'
        }
      }
    },
    data_coleta: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: {
          msg: 'Data de coleta inválida'
        }
      }
    },
    local_coleta: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: {
          args: [['sangue', 'ferida', 'secreção vaginal', 'urina', 'escarro', 'cateter']],
          msg: 'Local de coleta inválido'
        }
      }
    },
    tipo_amostra: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: {
          args: [['frasco anaeróbico', 'frasco aeróbico', 'aspirado', 'swab', 'jato médio']],
          msg: 'Tipo de amostra inválido'
        }
      }
    },
    microorganismo: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Microrganismo é obrigatório'
        }
      }
    },
    quantidade_ufc_por_ml: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        isFloat: {
          msg: 'Quantidade UFC/mL deve ser um número'
        },
        min: {
          args: [0],
          msg: 'Quantidade não pode ser negativa'
        }
      }
    },
    metodo_identificacao: {
      type: DataTypes.STRING(50),
      allowNull: false,
      /*validate: {
        isIn: {
          args: [['MALDI-TOF', 'cultura em ágar', 'hemocultura']],
          msg: 'Método de identificação inválido'
        }
      }*/
    },
    status_internacao: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: {
          args: [['UTI', 'internado', 'ambulatorial']],
          msg: 'Status de internação inválido'
        }
      }
    },
    resultado_final: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: {
          args: [['contaminação', 'infecção', 'colonização']],
          msg: 'Resultado final inválido'
        }
      }
    }
  }, {
    tableName: 'cultura',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      {
        name: 'idx_amostra_paciente',
        fields: ['paciente_id']
      },
      {
        name: 'idx_amostra_data',
        fields: ['data_coleta']
      },
      {
        name: 'idx_amostra_microorganismo',
        fields: ['microorganismo']
      },
      {
        name: 'idx_amostra_resultado',
        fields: ['resultado_final']
      }
    ]
  });

  Cultura.prototype.getResumo = function () {
    return `${this.paciente_id} - ${this.microorganismo} (${this.quantidade_ufc_por_ml} UFC/mL)`;
  };

  Cultura.porStatus = function (status) {
    return this.findAll({
      where: { status_internacao: status },
      order: [['data_coleta', 'DESC']]
    });
  };

  return Cultura;
};
