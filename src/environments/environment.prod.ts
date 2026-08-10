export const environment = {
  production: true,
  apiUrl: 'https://api.example.com/api',
  stripePublicKey: '',
  googleAnalyticsId: '',
  recaptchaSiteKey: '',
  devin: {
    // El backend (/api/integrations/devin) es quien añade el token de servicio.
    proxyPath: '/integrations/devin'
  }
};
