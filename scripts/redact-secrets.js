/**
 * Secret Redaction Utility
 * Automatically masks sensitive tokens and credentials in logs
 * 
 * Usage:
 *   const { redactSecrets } = require('./scripts/redact-secrets');
 *   console.log(redactSecrets(unsafeText));
 */

// Patterns for common secrets (case-insensitive)
const SECRET_PATTERNS = [
  // GitHub tokens
  /ghp_[A-Za-z0-9_]{36,255}/gi,
  /github_pat_[A-Za-z0-9_]{36,255}/gi,
  /gho_[A-Za-z0-9_]{36,255}/gi,
  /ghu_[A-Za-z0-9_]{36,255}/gi,
  /ghs_[A-Za-z0-9_]{36,255}/gi,
  /ghr_[A-Za-z0-9_]{36,255}/gi,
  
  // AWS credentials
  /AKIA[0-9A-Z]{16}/g,
  /[A-Za-z0-9/+=]{40}/g,  // AWS Secret Key (40 chars base64)
  
  // OpenAI
  /sk-[A-Za-z0-9]{32,64}/g,
  
  // Google
  /AIza[0-9A-Za-z_-]{35}/g,
  /ya29\.[0-9A-Za-z_-]{68,}/g,
  /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/g,
  
  // Generic patterns
  /password["\s:=]+[^\s"']+/gi,
  /api[_-]?key["\s:=]+[^\s"']+/gi,
  /secret["\s:=]+[^\s"']+/gi,
  /token["\s:=]+[^\s"']+/gi,
];

/**
 * Redact secrets from a string
 * @param {string} text - Text that may contain secrets
 * @returns {string} - Text with secrets replaced by [REDACTED]
 */
function redactSecrets(text) {
  if (typeof text !== 'string') {
    return text;
  }
  
  let redacted = text;
  
  SECRET_PATTERNS.forEach(pattern => {
    redacted = redacted.replace(pattern, '[REDACTED]');
  });
  
  return redacted;
}

/**
 * Redact secrets from an object (recursive)
 * Useful for JSON logs
 * @param {any} obj - Object to redact
 * @returns {any} - Object with secrets redacted
 */
function redactObject(obj) {
  if (typeof obj === 'string') {
    return redactSecrets(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const redactedObj = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if key indicates a secret
      if (/password|secret|token|key|credential/i.test(key)) {
        redactedObj[key] = '[REDACTED]';
      } else {
        redactedObj[key] = redactObject(value);
      }
    }
    return redactedObj;
  }
  
  return obj;
}

/**
 * Safe JSON.stringify with secret redaction
 * @param {any} obj - Object to stringify
 * @param {number} space - Indentation (default 2)
 * @returns {string} - JSON string with secrets redacted
 */
function safeStringify(obj, space = 2) {
  const redacted = redactObject(obj);
  return JSON.stringify(redacted, null, space);
}

module.exports = {
  redactSecrets,
  redactObject,
  safeStringify,
  SECRET_PATTERNS
};

// CLI usage
if (require.main === module) {
  const readline = require('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });
  
  rl.on('line', (line) => {
    console.log(redactSecrets(line));
  });
}
