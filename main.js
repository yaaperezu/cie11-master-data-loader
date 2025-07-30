const WHOICD11APIClient = require('./who_icd11_api_client');
const JSONFileReader = require('./json_file_reader');
const SQLGenerator = require('./sql_generator');
const config = require('./config');

async function runDataLoader() {
    const apiClient = new WHOICD11APIClient();
    const sqlGenerator = new SQLGenerator(config.OUTPUT_SQL_FILE);

    try {
        console.log("--- Iniciando proceso de carga de datos maestros CIE-11 ---");

        // --- NOTA IMPORTANTE ---
        // idVersion: Este ID debe corresponder a un registro existente en tu tabla HIS_TB_MMS_VERSION.
        // Por simplicidad, lo quemamos aquí, pero en producción deberías obtenerlo dinámicamente.
        const ID_VERSION_MMS = 1; // EJEMPLO: Asegúrate de que este ID exista en HIS_TB_MMS_VERSION
        console.log(`Utilizando ID de Versión MMS: ${ID_VERSION_MMS}`);
        // -----------------------

        // Paso 1: Leer los códigos CIE-11 desde el archivo JSON
        await sqlGenerator.clearOutputFile(); // Limpia el archivo de salida al inicio
        const cie11Codes = await JSONFileReader.readCodes(config.INPUT_CODES_FILE);

        if (cie11Codes.length === 0) {
            console.warn("No se encontraron códigos CIE-11 para procesar en el archivo JSON.");
            return;
        }

        // Paso 2: Procesar cada código en la lista
        for (const code of cie11Codes) {
            console.log(`\n--- Procesando código: '${code}' ---`);

            const codeInfo = await apiClient.getStemIdByCode(code);

            if (codeInfo && codeInfo.stemId) {
                // ***** INICIO DE LA CORRECCIÓN *****
                // Se elimina la línea que procesaba el stemId: const stemId = codeInfo.stemId.split('/').pop();
                // Ahora, pasamos la URI completa directamente a la siguiente función.
                const diagnosisDetails = await apiClient.getDiagnosisDetailsById(codeInfo.stemId);
                // ***** FIN DE LA CORRECCIÓN *****

                if (diagnosisDetails) {
                    // Genera la sentencia INSERT usando el esquema de la tabla y el ID de versión
                    const insertStatement = sqlGenerator.generateInsertStatement(diagnosisDetails, ID_VERSION_MMS);

                    if (insertStatement) {
                        await sqlGenerator.writeStatement(insertStatement);
                        console.log(`INSERT generado y escrito para el código: '${code}'.`);
                    } else {
                        console.error(`No se pudo generar el INSERT para el código: '${code}'.`);
                    }

                } else {
                    console.error(`No se pudieron obtener los detalles completos para el código '${code}'.`);
                }
            } else {
                console.error(`No se pudo obtener el 'stemId' para el código '${code}'.`);
            }
        }

    } catch (error) {
        console.error(`\nError crítico en la ejecución del script: ${error.message}`);
    } finally {
        console.log(`\n--- Proceso de carga de datos maestros CIE-11 finalizado. Revise '${config.OUTPUT_SQL_FILE}' ---`);
    }
}

runDataLoader();