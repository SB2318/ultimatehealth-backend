const { sanitizePhi, sanitizeForAI } = require('../utils/phiSanitizer');

describe('HIPAA PHI Sanitizer Tests', () => {
    it('should leave normal non-PHI health text untouched', () => {
        const text = 'I walked 8500 steps today, drank 2 liters of water, and slept for 7.5 hours.';
        const result = sanitizePhi(text);
        expect(result.hasRedactedPhi).toBe(false);
        expect(result.sanitizedText).toBe(text);
    });

    it('should redact Social Security Numbers (SSN)', () => {
        const text = 'My SSN is 123-45-6789, please keep it private.';
        const result = sanitizePhi(text);
        expect(result.hasRedactedPhi).toBe(true);
        expect(result.redactedTypes).toContain('SSN');
        expect(result.sanitizedText).toBe('My SSN is [REDACTED_SSN], please keep it private.');
    });

    it('should redact email addresses', () => {
        const text = 'Contact my doctor at doctor.smith@hospital.org regarding my lab results.';
        const result = sanitizePhi(text);
        expect(result.hasRedactedPhi).toBe(true);
        expect(result.redactedTypes).toContain('EMAIL');
        expect(result.sanitizedText).toBe('Contact my doctor at [REDACTED_EMAIL] regarding my lab results.');
    });

    it('should redact phone numbers', () => {
        const text = 'Call me at (555) 123-4567 or +1-555-987-6543.';
        const result = sanitizePhi(text);
        expect(result.hasRedactedPhi).toBe(true);
        expect(result.redactedTypes).toContain('PHONE');
        expect(result.sanitizedText).not.toContain('555');
    });

    it('should redact Medical Record Numbers (MRN)', () => {
        const text = 'My patient MRN: AB12345678 was issued yesterday.';
        const result = sanitizePhi(text);
        expect(result.hasRedactedPhi).toBe(true);
        expect(result.redactedTypes).toContain('MRN');
        expect(result.sanitizedText).toContain('[REDACTED_MRN]');
    });

    it('should redact Dates of Birth', () => {
        const text = 'Patient DOB: 1985-04-12 reporting mild fatigue.';
        const result = sanitizePhi(text);
        expect(result.hasRedactedPhi).toBe(true);
        expect(result.redactedTypes).toContain('DOB');
        expect(result.sanitizedText).toContain('[REDACTED_DOB]');
    });

    it('should sanitize multiple mixed identifiers in a single string', () => {
        const text = 'My email is test@patient.com, phone is 555-019-2834, and SSN is 000-11-2222.';
        const sanitized = sanitizeForAI(text);
        expect(sanitized).toBe('My email is [REDACTED_EMAIL], phone is [REDACTED_PHONE], and SSN is [REDACTED_SSN].');
    });
});
