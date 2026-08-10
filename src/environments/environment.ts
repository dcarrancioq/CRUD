export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  stripePublicKey: '',
  googleAnalyticsId: '',
  recaptchaSiteKey: '',
  devin: {
    // El backend (/api/integrations/devin) es quien añade el token de servicio.
    proxyPath: '/integrations/devin'
  }
};
