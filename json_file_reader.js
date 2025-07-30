const fs = require('fs').promises; // Usamos la versión de promesas para operaciones asíncronas
const path = require('path');

class JSONFileReader {
    /**
     * Lee un archivo JSON y parsea su contenido.
     * @param {string} filePath - La ruta al archivo JSON.
     * @returns {Promise<Array<string>>} Una promesa que resuelve con un array de códigos o un array vacío si falla.
     */
    static async readCodes(filePath) {
        try {
            const absolutePath = path.resolve(filePath);
            console.log(`Leyendo códigos desde el archivo: ${absolutePath}`);
            const data = await fs.readFile(absolutePath, 'utf8');
            const codes = JSON.parse(data);

            if (!Array.isArray(codes)) {
                console.error(`Error: El archivo JSON en ${filePath} no contiene un array de códigos.`);
                return [];
            }
            console.log(`Se leyeron ${codes.length} códigos del archivo JSON.`);
            return codes;
        } catch (error) {
            console.error(`Error al leer o parsear el archivo JSON '${filePath}': ${error.message}`);
            return [];
        }
    }
}

module.exports = JSONFileReader;