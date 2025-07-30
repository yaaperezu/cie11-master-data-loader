const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

class SQLGenerator {
    constructor(outputFilePath) {
        this.outputFilePath = path.resolve(outputFilePath);
        // Limpia el archivo de salida al iniciar para cada ejecución
        this.clearOutputFile();
    }

    async clearOutputFile() {
        try {
            await fs.writeFile(this.outputFilePath, '', 'utf8');
            console.log(`Archivo de salida SQL "${this.outputFilePath}" limpiado.`);
        } catch (error) {
            console.error(`Error al limpiar el archivo de salida SQL: ${error.message}`);
        }
    }

    /**
     * Genera una sentencia INSERT para un diagnóstico CIE-11.
     * @param {object} diagnosisData - Datos del diagnóstico obtenidos de la API.
     * @param {number} idVersion - El ID de la versión de la CIE-11 (necesario para las FKs).
     * @returns {string|null} La sentencia INSERT o null si no se puede generar.
     */
    generateInsertStatement(diagnosisData, idVersion) {
        const tableName = "HIS_TB_MMS_CATEGORIA";

        // Función auxiliar para sanear y escapar strings para SQL
        const sanitizeAndEscape = (str) => {
            if (str === null || str === undefined) return 'NULL';
            let cleanedStr = String(str).trim();
            // Escapar comillas simples para Oracle SQL
            cleanedStr = cleanedStr.replace(/'/g, "''");
            return `'${cleanedStr}'`;
        };

        // Función para manejar valores booleanos
        const toOracleBoolean = (val) => val ? '1' : '0'; // Oracle usa 1/0 para booleanos en NUMBER(1)

        // Extraer y mapear propiedades de diagnosisData a columnas de la tabla
        const uriOms = sanitizeAndEscape(diagnosisData['@id']);
        const codigo = sanitizeAndEscape(diagnosisData.code);
        const uriFuenteFoundation = sanitizeAndEscape(diagnosisData.source || null); // 'source' puede ser la foundationReference
        const titulo = sanitizeAndEscape(diagnosisData.title && diagnosisData.title['@value'] ? diagnosisData.title['@value'] : null);
        const definicion = sanitizeAndEscape(diagnosisData.definition && diagnosisData.definition['@value'] ? diagnosisData.definition['@value'] : null);
        const nombreCompleto = sanitizeAndEscape(diagnosisData.fullySpecifiedName && diagnosisData.fullySpecifiedName['@value'] ? diagnosisData.fullySpecifiedName['@value'] : null);
        const urlNavegador = sanitizeAndEscape(diagnosisData.browserUrl || null);

        // Criterios Diagnósticos y Notas de Codificación no están directamente en la respuesta de CA40.
        // Si necesitas estos campos, la API podría tener otros endpoints o formas de obtenerlos.
        const criteriosDiagnosticos = 'NULL'; // No disponible en el JSON de ejemplo
        const notaCodificacion = 'NULL';    // No disponible en el JSON de ejemplo

        // Determinar si es una subcategoría residual
        const isOther = diagnosisData['@id'] && diagnosisData['@id'].endsWith('/other');
        const isUnspecified = diagnosisData['@id'] && diagnosisData['@id'].endsWith('/unspecified');
        const esResidualOtro = toOracleBoolean(isOther);
        const esResidualNoEspecificado = toOracleBoolean(isUnspecified);

        // Determinar si es hoja (no tiene hijos)
        const esHoja = toOracleBoolean(!(diagnosisData.child && diagnosisData.child.length > 0));

        // Determinar si tiene enlaces maternos/perinatales
        const tieneEnlaceMaternal = toOracleBoolean(diagnosisData.relatedEntitiesInMaternalChapter && diagnosisData.relatedEntitiesInMaternalChapter.length > 0);
        const tieneEnlacePerinatal = toOracleBoolean(diagnosisData.relatedEntitiesInPerinatalChapter && diagnosisData.relatedEntitiesInPerinatalChapter.length > 0);


        // Para id_capitulo e id_bloque, necesitaríamos consultar estas tablas primero
        // o asumir que ya tenemos un mapeo. Por ahora, los dejaremos como NULL o valores placeholder.
        // En un escenario real, deberías tener una lógica para obtener los IDs de capítulo/bloque
        // a partir de sus URIs o códigos, posiblemente insertándolos si no existen.
        // Por el momento, el `parent` de 'CA40' es '915779102' que parece ser un bloque o categoría superior, no un capítulo.
        // El capítulo se identifica por un URI que contiene '/chapter/'.

        let idCapitulo = 'NULL'; // Placeholder
        let idBloque = 'NULL';   // Placeholder

        // Lógica para intentar extraer el capítulo y bloque (requiere mapeo externo)
        // Para este ejemplo, solo usaremos placeholders. En una implementación real,
        // necesitarías un sistema para resolver los URIs de parent a sus IDs internos de BD.
        if (diagnosisData.parent && Array.isArray(diagnosisData.parent)) {
            for (const parentUri of diagnosisData.parent) {
                if (parentUri.includes('/chapter/')) {
                    // Aquí deberías tener una forma de mapear el URI del capítulo a un id_capitulo numérico
                    // Por ejemplo: 'id_capitulo = (SELECT ID_CAPITULO FROM HIS_TB_MMS_CAPITULO WHERE URI_OMS = '...URI del capítulo...')'
                    // Por simplicidad, lo dejamos en NULL.
                    // idCapitulo = getChapterIdFromUri(parentUri); // Esto sería una función que implementarías
                } else {
                    // Aquí podrías obtener el id_bloque de la misma manera
                    // idBloque = getBlockIdFromUri(parentUri); // Esto sería otra función
                }
            }
        }


        // Validaciones básicas
        if (!uriOms || !codigo || !titulo || !idVersion) {
            console.error(`Error: Datos incompletos para generar INSERT para código ${diagnosisData.code}. Faltan URI, Código, Título o ID de Versión.`);
            return null;
        }

        const columns = [
            "ID_CATEGORIA", "ID_BLOQUE", "ID_CAPITULO", "ID_VERSION",
            "URI_OMS", "CODIGO", "URI_FUENTE_FOUNDATION", "TITULO", "DEFINICION",
            "NOMBRE_COMPLETO", "CRITERIOS_DIAGNOSTICOS", "NOTA_CODIFICACION",
            "URL_NAVEGADOR", "ES_RESIDUAL_OTRO", "ES_RESIDUAL_NO_ESPECIFICADO",
            "ES_HOJA", "TIENE_ENLACE_MATERNAL", "TIENE_ENLACE_PERINATAL"
        ].join(", ");

        const values = [
            `HIS_SQ_MMS_CATEGORIA.NEXTVAL`, // Usamos la secuencia para ID_CATEGORIA
            idBloque,
            idCapitulo,
            idVersion,
            uriOms,
            codigo,
            uriFuenteFoundation,
            titulo,
            definicion, // Si es un CLOB corto, puede ir directo. Si es muy largo, se maneja con DBMS_LOB.
            nombreCompleto,
            criteriosDiagnosticos,
            notaCodificacion,
            urlNavegador,
            esResidualOtro,
            esResidualNoEspecificado,
            esHoja,
            tieneEnlaceMaternal,
            tieneEnlacePerinatal
        ].join(", ");

        let insertStatement = `INSERT INTO ${tableName} (${columns})
                               VALUES (${values});  `;

        // Nota: Para campos CLOB como DEFINICION o CRITERIOS_DIAGNOSTICOS
        // si son realmente muy largos (más de 4000 caracteres en Oracle sin NCLOB, etc.)
        // la estrategia de EMPTY_CLOB() + DBMS_LOB.WRITEAPPEND podría ser necesaria.
        // Por simplicidad aquí, asumimos que caben como literales o que Oracle los maneja
        // si el tipo de columna es CLOB y el string es más corto.
        // Para strings muy largos, se requeriría un bloque PL/SQL:
        // if (definicion.length > 4000 && definicion !== 'NULL') {
        //     insertStatement += `DECLARE v_lob CLOB; BEGIN SELECT DEFINICION INTO v_lob FROM ${tableName} WHERE CODIGO = ${codigo} FOR UPDATE; DBMS_LOB.WRITEAPPEND(v_lob, LENGTH(${definicion}), ${definicion}); END; / \n`;
        // }

        return insertStatement;
    }

    /**
     * Escribe la sentencia SQL en el archivo de salida.
     * @param {string} statement - La sentencia SQL a escribir.
     */
    async writeStatement(statement) {
        try {
            await fs.appendFile(this.outputFilePath, statement, 'utf8');
        } catch (error) {
            console.error(`Error al escribir la sentencia SQL en el archivo: ${error.message}`);
        }
    }
}

module.exports = SQLGenerator;