const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''

// Build dynamic connect-src origins from environment
const connectOrigins = ["'self'"]
connectOrigins.push(
  'https://checkout.stripe.com',
  'https://api.stripe.com',
  'https://maps.googleapis.com',
)

// Add the deployment URL if set
if (serverUrl) {
  connectOrigins.push(serverUrl)
}

// Build dynamic script-src origins
const scriptOrigins = [
  "'self'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  'https://checkout.stripe.com',
  'https://js.stripe.com',
  'https://maps.googleapis.com',
  'https://res.cloudinary.com',
]

// Build dynamic frame-src origins
const frameOrigins = [
  "'self'",
  'https://checkout.stripe.com',
  'https://js.stripe.com',
  'https://hooks.stripe.com',
]

// Allow Vercel preview URLs and Vercel Live in non-production environments
if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production') {
  connectOrigins.push('https://*.vercel.app')
  scriptOrigins.push('https://vercel.live', 'https://*.vercel.live')
  frameOrigins.push('https://vercel.live', 'https://*.vercel.live')
}

// Keep localhost for local development only
if (!process.env.VERCEL) {
  connectOrigins.push('http://localhost:3000', 'http://localhost:4000')
}

const policies = {
  'default-src': ["'self'"],
  'script-src': scriptOrigins,
  'child-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'img-src': [
    "'self'",
    'https://res.cloudinary.com',
    'https://*.stripe.com',
    'https://raw.githubusercontent.com',
    'data:',
    'https://www.gravatar.com',
  ],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'frame-src': frameOrigins,
  'connect-src': connectOrigins,
  'object-src': ['https://res.cloudinary.com'],
}

// Generate CSP string
export default Object.entries(policies)
  .map(([key, value]) => `${key} ${value.join(' ')}`)
  .join('; ')
