const policies = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'https://checkout.stripe.com',
    'https://js.stripe.com',
    'https://maps.googleapis.com',
    'https://res.cloudinary.com',
  ],
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
  'frame-src': [
    "'self'",
    'https://checkout.stripe.com',
    'https://js.stripe.com',
    'https://hooks.stripe.com',
  ],
  'connect-src': [
    "'self'",
    'https://checkout.stripe.com',
    'https://api.stripe.com',
    'https://maps.googleapis.com',
    'http://localhost:3000',
    'http://localhost:4000',
    'admin.streetbeefsscrapyard.com',
    'streetbeefsscrapyard.com',
  ],
  'object-src': ['https://res.cloudinary.com'],
}

// Generate CSP string
export default Object.entries(policies)
  .map(([key, value]) => `${key} ${value.join(' ')}`)
  .join('; ')
