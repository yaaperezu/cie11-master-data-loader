// who_icd11_api_client.js

const axios = require('axios');
const config = require('./config');

class WHOICD11APIClient {
    constructor() {
        this.accessToken = null;
        this.headers = {
            "Accept": "application/json",
            "Accept-Language": "es",
            "API-Version": "v2"
        };
    }

    async getAccessToken() {
        if (this.accessToken) {
            console.log("Token de acceso ya disponible. Reutilizando.");
            return this.accessToken;
        }

        console.log("Obteniendo nuevo token de acceso de la API de la OMS...");
        try {
            const response = await axios.post(
                config.WHO_ICD11_AUTH_URL,
                new URLSearchParams({
                    client_id: config.WHO_ICD11_CLIENT_ID,
                    client_secret: config.WHO_ICD11_CLIENT_SECRET,
                    scope: "icdapi_access",
                    grant_type: "client_credentials"
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 10000
                }
            );
            this.accessToken = response.data.access_token;
            this.headers.Authorization = `Bearer ${this.accessToken}`;
            console.log("Token de acceso obtenido correctamente.");
            console.log("Token: " + this.accessToken.substring(0, 10) + "...");
            return this.accessToken;
        } catch (error) {
            console.error(`Error al obtener el token de acceso: ${error.message}`);
            if (error.response) {
                console.error(`Detalles del error (HTTP ${error.response.status}): ${JSON.stringify(error.response.data)}`);
            }
            throw new Error(`Fallo en la obtención del token de acceso: ${error.message}`);
        }
    }

    async getStemIdByCode(code) {
        if (!this.accessToken) {
            await this.getAccessToken();
        }

        const url = `${config.WHO_ICD11_BASE_API_URL}/release/${config.WHO_ICD11_API_RELEASE_ID}/${config.WHO_ICD11_LINEARIZATION_NAME}/codeinfo/${code}`;
        console.log(`Consultando stemId para el código '${code}' en: ${url}`);

        try {
            const response = await axios.get(url, {
                headers: this.headers,
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error(`Error al consultar stemId para el código '${code}': ${error.message}`);
            if (error.response) {
                console.error(`Detalles del error (HTTP ${error.response.status}): ${JSON.stringify(error.response.data)}`);
            }
            return null;
        }
    }

    async getDiagnosisDetailsById(entityId) {
        if (!this.accessToken) {
            await this.getAccessToken();
        }

        let actualEntityPath = '';

        // **INICIO DE LA CORRECCIÓN**
        // La variable 'entityId' contiene la URI completa del stemId, por ejemplo:
        // "http://id.who.int/icd/release/11/2025-01/mms/1256772020/unspecified"
        // Necesitamos extraer la parte que sigue a "/mms/", es decir: "1256772020/unspecified"

        const delimiter = '/mms/';
        const parts = entityId.split(delimiter);

        if (parts.length > 1) {
            // Si la división fue exitosa, la parte que necesitamos es la segunda (índice 1)
            actualEntityPath = parts[1];
        } else {
            // Si no se encuentra el delimitador, puede que ya se esté pasando la ruta correcta.
            // O podría ser un error. Por seguridad, lo registramos.
            console.warn(`El delimitador '${delimiter}' no se encontró en el entityId: '${entityId}'. Se usará el valor completo.`);
            actualEntityPath = entityId;
        }
        // **FIN DE LA CORRECCIÓN**

        const url = `${config.WHO_ICD11_BASE_API_URL}/release/${config.WHO_ICD11_API_RELEASE_ID}/${config.WHO_ICD11_LINEARIZATION_NAME}/${actualEntityPath}`;
        console.log(`Consultando detalles para la ruta '${actualEntityPath}' en: ${url}`);

        try {
            const response = await axios.get(url, {
                headers: this.headers,
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error(`Error al consultar detalles para la ruta '${actualEntityPath}': ${error.message}`);
            if (error.response) {
                console.error(`Detalles del error (HTTP ${error.response.status}): ${JSON.stringify(error.response.data)}`);
            }
            return null;
        }
    }
}

module.exports = WHOICD11APIClient;