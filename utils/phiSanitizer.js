/**
 * PHI Sanitizer Utility (HIPAA Safe Harbor De-identification - 45 CFR § 164.514)
 * 
 * Redacts direct identifiers and Protected Health Information (PHI) before
 * transmitting user prompts and conversation history to third-party AI providers.
 */

// Social Security Number: 123-45-6789 or 123 45 6789
const SSN_REGEX = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g;

// Email address
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// US and International Phone numbers
const PHONE_REGEX = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

// Medical Record Numbers (e.g. MRN: 1234567, MRN#AB123456)
const MRN_REGEX = /\b(?:MRN|mrn|medical record number)[:\s#]*[A-Za-z0-9-]{6,12}\b/gi;

// Credit / Debit card numbers (13-16 digits formatted)
const CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;

// Explicit Date of Birth (e.g., DOB: 01/15/1985 or Date of Birth: 1990-05-20)
const DOB_REGEX = /\b(?:DOB|dob|Date of Birth|Birthdate)[:\s]*\d{1,4}[-\/\.]\d{1,2}[-\/\.]\d{2,4}\b/gi;

// IPv4 and IPv6 addresses
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

/**
 * Sanitizes a string by replacing direct personal identifiers with redact tags.
 * @param {string} text - Raw input text from patient/user
 * @returns {{ sanitizedText: string, hasRedactedPhi: boolean, redactedTypes: string[] }}
 */
function sanitizePhi(text) {
    if (!text || typeof text !== 'string') {
        return { sanitizedText: text || '', hasRedactedPhi: false, redactedTypes: [] };
    }

    let sanitized = text;
    const redactedTypes = [];

    if (SSN_REGEX.test(sanitized)) {
        sanitized = sanitized.replace(SSN_REGEX, '[REDACTED_SSN]');
        redactedTypes.push('SSN');
    }

    if (EMAIL_REGEX.test(sanitized)) {
        sanitized = sanitized.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
        redactedTypes.push('EMAIL');
    }

    if (MRN_REGEX.test(sanitized)) {
        sanitized = sanitized.replace(MRN_REGEX, '[REDACTED_MRN]');
        redactedTypes.push('MRN');
    }

    if (CARD_REGEX.test(sanitized)) {
        sanitized = sanitized.replace(CARD_REGEX, '[REDACTED_FINANCIAL]');
        redactedTypes.push('FINANCIAL');
    }

    if (DOB_REGEX.test(sanitized)) {
        sanitized = sanitized.replace(DOB_REGEX, '[REDACTED_DOB]');
        redactedTypes.push('DOB');
    }

    if (PHONE_REGEX.test(sanitized)) {
        sanitized = sanitized.replace(PHONE_REGEX, '[REDACTED_PHONE]');
        redactedTypes.push('PHONE');
    }

    if (IP_REGEX.test(sanitized)) {
        sanitized = sanitized.replace(IP_REGEX, '[REDACTED_IP]');
        redactedTypes.push('IP');
    }

    return {
        sanitizedText: sanitized,
        hasRedactedPhi: redactedTypes.length > 0,
        redactedTypes
    };
}

/**
 * Convenience helper returning only the sanitized string.
 * @param {string} text
 * @returns {string}
 */
function sanitizeForAI(text) {
    return sanitizePhi(text).sanitizedText;
}

module.exports = {
    sanitizePhi,
    sanitizeForAI
};
