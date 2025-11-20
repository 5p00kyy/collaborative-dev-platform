const crypto = require('crypto');

// ====== CSRF Protection Middleware ======

/**
 * Modern CSRF protection using double-submit cookie pattern
 * More info: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

const CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN';

/**
 * Generate a random CSRF token
 */
function generateToken() {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Sign a token with HMAC
 */
function signToken(token) {
  return crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(token)
    .digest('hex');
}

/**
 * Verify a signed token
 */
function verifyToken(token, signature) {
  const expectedSignature = signToken(token);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Middleware to generate and set CSRF token
 */
function csrfProtection(req, res, next) {
  // Skip CSRF for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF for API calls with Bearer token (JWT handles auth)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // Get token from cookie
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  
  // Get token from header
  const headerToken = req.headers[CSRF_HEADER_NAME.toLowerCase()];

  // Verify both tokens exist and match
  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token missing',
      code: 'CSRF_MISSING'
    });
  }

  // Simple comparison for double-submit cookie pattern
  if (cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token mismatch',
      code: 'CSRF_INVALID'
    });
  }

  next();
}

/**
 * Middleware to set CSRF token cookie
 */
function setCsrfToken(req, res, next) {
  // Check if token already exists
  let token = req.cookies[CSRF_COOKIE_NAME];
  
  if (!token) {
    // Generate new token
    token = generateToken();
    
    // Set cookie
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be accessible to JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
  }

  // Make token available in response for initial page loads
  res.locals.csrfToken = token;
  
  next();
}

/**
 * Route to get CSRF token
 */
function getCsrfToken(req, res) {
  const token = req.cookies[CSRF_COOKIE_NAME] || generateToken();
  
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    data: {
      csrfToken: token
    }
  });
}

/**
 * Alternative CSRF using encrypted tokens (more secure)
 */
function csrfProtectionEncrypted(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip for API calls with JWT
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = req.headers[CSRF_HEADER_NAME.toLowerCase()] || 
                req.body._csrf || 
                req.query._csrf;

  if (!token) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token required',
      code: 'CSRF_MISSING'
    });
  }

  try {
    // Token should be "token.signature"
    const [tokenValue, signature] = token.split('.');
    
    if (!tokenValue || !signature) {
      throw new Error('Invalid token format');
    }

    // Verify signature
    if (!verifyToken(tokenValue, signature)) {
      throw new Error('Invalid token signature');
    }

    // Token is valid
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      code: 'CSRF_INVALID'
    });
  }
}

/**
 * Generate encrypted CSRF token
 */
function generateEncryptedToken() {
  const token = generateToken();
  const signature = signToken(token);
  return `${token}.${signature}`;
}

module.exports = {
  csrfProtection,
  setCsrfToken,
  getCsrfToken,
  csrfProtectionEncrypted,
  generateEncryptedToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME
};
