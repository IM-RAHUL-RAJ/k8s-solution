export const API_ENDPOINTS = {
  tradeApiBase: 'http://10.8.76.150:8084',
  tradeApiHealth: '/actuator/health',
  authApiHealth: '/health',
  marketInstruments: null as string | null,
  currencyConverter: null as string | null
} as const;
