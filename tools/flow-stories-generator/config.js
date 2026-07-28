// ============================================================================
//  CONFIGURACION — Flow & Stories Generator
// ----------------------------------------------------------------------------
//  La API key de Devin va AQUI, en el codigo, tal y como se pidio.
//
//  IMPORTANTE (seguridad): no subas una API key real al repositorio. Pega tu
//  key en local para usar la app; el valor por defecto es un placeholder.
//  Tambien puedes sobrescribir estos valores con variables de entorno:
//     DEVIN_API_KEY, DEVIN_API_BASE_URL, PORT
// ============================================================================

module.exports = {
  // Pega aqui tu Devin API key (genérala en:
  //   https://deloitte-es.devinenterprise.com/settings  -> API Keys)
  DEVIN_API_KEY: process.env.DEVIN_API_KEY || "PON_AQUI_TU_API_KEY",

  // Devin Cloud:      https://api.devin.ai/v1
  // Devin Enterprise: https://deloitte-es.devinenterprise.com/api/v1
  DEVIN_API_BASE_URL:
    process.env.DEVIN_API_BASE_URL || "https://deloitte-es.devinenterprise.com/api/v1",

  // Opcional: si lo dejas vacio, la app descubre el org_id del service user
  // automaticamente (GET /v3/enterprise/self). Ponlo solo si quieres forzarlo.
  DEVIN_ORG_ID: process.env.DEVIN_ORG_ID || "",

  PORT: process.env.PORT || 3100,

  // Carpeta con transcripciones de ejemplo que la app ofrece en un desplegable
  // (para poder cargar un documento sin usar el dialogo del sistema).
  // No subas transcripciones confidenciales al repositorio.
  SAMPLES_DIR: process.env.SAMPLES_DIR || require("path").join(__dirname, "samples"),
};
