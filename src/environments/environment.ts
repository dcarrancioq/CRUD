export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  stripePublicKey: '',
  googleAnalyticsId: '',
  recaptchaSiteKey: '',
  devin: {
    useProxy: true,
    proxyPath: '/integrations/devin/sessions',
    apiBaseUrl: 'https://api.devin.ai',
    orgId: '',
    serviceTokenHeaderPlaceholder: ''
  }
};
