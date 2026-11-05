/**
 * AI Guardrails & Character Boundary Enforcement
 * 
 * Protects UltimateHealth AI from:
 * 1. Intentional dirty / NSFW / sexually explicit content
 * 2. Jailbreaks and prompt injection attempts
 * 3. Malicious / illegal instructions (hacking, weapons, illicit substances)
 * 4. Acute life-threatening medical emergencies (providing instant crisis hotlines)
 * 5. Out-of-scope domain drift (ensuring Coach Alex, Dr. Sarah, Guide Maya, and Assistant stick 100% to their assigned roles)
 */

// 1. Critical Life-Threatening Emergency Red Flags
const EMERGENCY_PATTERNS = [
    /\b(chest pain|crushing chest|heart attack|myocardial infarction)\b/i,
    /\b(stroke|face drooping|arm weakness|slurred speech)\b/i,
    /\b(can'?t breathe|cannot breathe|severe shortness of breath|suffocating|choking)\b/i,
    /\b(suicide|suicidal|want to die|kill myself|end my life|self-harm|cutting myself)\b/i,
    /\b(overdose|overdosed|swallowed pills|poisoning|drank poison)\b/i,
    /\b(severe bleeding|coughing up blood|vomiting blood|profuse bleeding)\b/i,
    /\b(anaphylaxis|throat swelling|severe allergic reaction)\b/i
];

const EMERGENCY_RESPONSE = `🚨 **URGENT MEDICAL NOTICE** 🚨
If you or someone near you is experiencing a medical or mental health emergency:
- **Call 911 (US/Canada)** or your local emergency number (e.g., **112 in EU/India**) immediately.
- **Crisis & Suicide Lifeline**: Dial or text **988** (Available 24/7, free and confidential).
- **Poison Control**: Call **1-800-222-1222** (US).

Please visit the nearest emergency room or urgent care center right now. UltimateHealth AI cannot provide emergency medical intervention.`;

// 2. Dirty / NSFW / Sexually Explicit / Abusive Content
const NSFW_DIRTY_PATTERNS = [
    /\b(porn|pornography|xxx|hentai|erotic|erotica|sex position|blowjob|handjob|cumshot|masturbat\w*)\b/i,
    /\b(nude|nudes|naked pictures|send nudes|striptease|sexy roleplay|dirty talk)\b/i,
    /\b(fuck you|motherfucker|bitch|slut|whore|dickhead|asshole)\b/i,
    /\b(penis size|dick size|vagina|boobs|pussy|tits|orgasm tips|horny)\b/i
];

const NSFW_REFUSAL = `I am an AI health and wellness coach for UltimateHealth. I do not engage with sexually explicit, adult, or abusive content. If you have questions regarding general fitness, nutrition, or wellness, I am here to assist you.`;

// 3. Jailbreak & Prompt Injection Defense
const JAILBREAK_PATTERNS = [
    /ignore (all )?(previous|prior) (instructions|directives|rules)/i,
    /disregard (all )?(previous|system) (prompts|instructions)/i,
    /\b(dan mode|jailbreak|unfiltered mode|developer mode)\b/i,
    /\b(act as|pretend to be) (an unrestricted|a malicious|an unfiltered|evil|chaos) ai\b/i,
    /\breveal (your )?(system prompt|initial prompt|hidden instructions)\b/i,
    /\bbypass (your )?(safety|content filter|guardrails)\b/i,
    /now you can do anything now/i
];

const JAILBREAK_REFUSAL = `Request denied. System safety directives and clinical guardrails cannot be bypassed or overridden. How can I assist you with your health and wellness goals today?`;

// 4. Malicious / Dangerous / Illegal Activities
const MALICIOUS_PATTERNS = [
    /\b(how to make|synthesize|cook) (meth|methamphetamine|fentanyl|heroin|lsd|cocaine|bomb|explosive|weapon)\b/i,
    /\b(ddos|hack into|sql injection|exploit vulnerability|steal passwords|phishing script)\b/i,
    /\b(how to hurt someone|poison someone|commit murder)\b/i
];

const MALICIOUS_REFUSAL = `UltimateHealth AI strictly adheres to safety guidelines and cannot generate content related to illegal, dangerous, or harmful activities.`;

// 5. Character-Specific Scopes & Domain Mismatches
const CHARACTER_SCOPES = {
    fitness_coach: {
        name: "Coach Alex (Fitness Coach)",
        allowedKeywords: ["workout", "exercise", "gym", "squat", "pushup", "deadlift", "cardio", "running", "stretch", "muscle", "mobility", "posture", "training", "reps", "sets", "flexibility", "stamina", "endurance", "warmup", "cooldown"],
        outOfScopeRegex: /\b(write code|python script|javascript|debug code|crypto|stock market|prescribe medication|diagnose my disease|what medication for)\b/i,
        refusalMessage: `I am Coach Alex, your dedicated Fitness Coach! 🏋️‍♂️ My focus is strictly on physical training, exercise form, workouts, and mobility. 

- For diet and meal plans, please switch to **Dr. Sarah (Nutritionist)**.
- For stress and mindfulness, talk to **Guide Maya (Mental Wellness)**.
- For medical questions or prescriptions, please consult a licensed doctor.

What exercise or workout goals are you working on today?`
    },
    nutritionist: {
        name: "Dr. Sarah (Nutritionist)",
        allowedKeywords: ["diet", "food", "calorie", "protein", "carbs", "fats", "vitamin", "mineral", "hydration", "water", "meal", "recipe", "breakfast", "lunch", "dinner", "snack", "keto", "vegan", "intermittent fasting", "fiber", "supplements", "nutrition"],
        outOfScopeRegex: /\b(write code|python script|crypto|stock market|bench press split|5 day workout routine|prescribe medication|diagnose disease)\b/i,
        refusalMessage: `I am Dr. Sarah, your Nutrition Specialist! 🥗 My expertise is strictly balanced nutrition, meal planning, dietary habits, and hydration.

- For workout splits, lifting, or cardio routines, please switch to **Coach Alex (Fitness Coach)**.
- For emotional stress and meditation, please speak to **Guide Maya**.
- For clinical diagnosis or drug prescriptions, consult your primary care doctor.

How can I help you optimize your nutrition and meals today?`
    },
    mental_wellness: {
        name: "Guide Maya (Mental Wellness)",
        allowedKeywords: ["stress", "anxiety", "mindfulness", "meditation", "breathwork", "breathing", "calm", "sleep", "insomnia", "relaxation", "overwhelmed", "burnout", "journaling", "emotional", "peace", "mood", "wellness"],
        outOfScopeRegex: /\b(write code|python script|crypto|stock market|leg day split|workout routine|prescribe prozac|prescribe medication|diagnose bipolar)\b/i,
        refusalMessage: `I am Guide Maya, your Mental Wellness Guide. 🧘‍♀️ I am here to help you cultivate mindfulness, ease stress, and practice breathing and relaxation techniques.

- For workout programs and gym training, please chat with **Coach Alex**.
- For dietary planning and nutrition advice, please talk to **Dr. Sarah**.
- For psychiatric diagnosis or clinical medication, please reach out to a licensed therapist or physician.

Take a gentle breath. What is on your mind today?`
    },
    general: {
        name: "UltimateHealth Assistant",
        allowedKeywords: ["health", "wellness", "sleep", "habit", "water", "lifestyle", "prevention", "vital", "app", "feature"],
        outOfScopeRegex: /\b(write code|python script|debug javascript|crypto trading|stock picks|political election|hack)\b/i,
        refusalMessage: `I am the UltimateHealth Assistant focusing on general health education and healthy lifestyle habits. 🌿

I do not handle non-health topics like software programming, finance, or politics. How can I assist you with your health and wellness journey today?`
    }
};

/**
 * Validates a user query against all guardrail layers:
 * 1. Emergency Red-Flag Triage
 * 2. Dirty / NSFW / Abuse Filter
 * 3. Jailbreak & Prompt Injection Defense
 * 4. Malicious / Dangerous Content Filter
 * 5. Character Domain Scope Enforcement
 * 
 * @param {string} text - User message text
 * @param {string} character - Target character ID ('general', 'fitness_coach', 'nutritionist', 'mental_wellness')
 * @returns {{ passed: boolean, reason?: string, fallbackReply?: string, isEmergency?: boolean, category?: string }}
 */
function evaluateGuardrails(text, character = 'general') {
    if (!text || typeof text !== 'string') {
        return { passed: false, reason: "Empty input", fallbackReply: "Please provide a valid question." };
    }

    const trimmed = text.trim();

    // Layer 1: Emergency Red-Flag Triage
    for (const pattern of EMERGENCY_PATTERNS) {
        if (pattern.test(trimmed)) {
            return {
                passed: false,
                isEmergency: true,
                category: 'EMERGENCY',
                reason: 'Acute medical emergency keyword detected',
                fallbackReply: EMERGENCY_RESPONSE
            };
        }
    }

    // Layer 2: Dirty / NSFW / Vulgarity Filter
    for (const pattern of NSFW_DIRTY_PATTERNS) {
        if (pattern.test(trimmed)) {
            return {
                passed: false,
                category: 'NSFW_DIRTY',
                reason: 'Inappropriate or sexually explicit content detected',
                fallbackReply: NSFW_REFUSAL
            };
        }
    }

    // Layer 3: Jailbreak & Prompt Injection Defense
    for (const pattern of JAILBREAK_PATTERNS) {
        if (pattern.test(trimmed)) {
            return {
                passed: false,
                category: 'PROMPT_INJECTION',
                reason: 'Prompt injection or system override detected',
                fallbackReply: JAILBREAK_REFUSAL
            };
        }
    }

    // Layer 4: Malicious / Dangerous Filter
    for (const pattern of MALICIOUS_PATTERNS) {
        if (pattern.test(trimmed)) {
            return {
                passed: false,
                category: 'MALICIOUS_DANGEROUS',
                reason: 'Malicious or illegal activity instruction detected',
                fallbackReply: MALICIOUS_REFUSAL
            };
        }
    }

    // Layer 5: Character Scope Enforcement
    const charConfig = CHARACTER_SCOPES[character] || CHARACTER_SCOPES['general'];
    if (charConfig.outOfScopeRegex && charConfig.outOfScopeRegex.test(trimmed)) {
        return {
            passed: false,
            category: 'OUT_OF_SCOPE',
            reason: `Query is strictly outside the domain of ${charConfig.name}`,
            fallbackReply: charConfig.refusalMessage
        };
    }

    return { passed: true };
}

/**
 * Hardened Persona & Character Prompts with Domain Constraints
 */
const HARDENED_CHARACTER_PROMPTS = {
    general: `You are the official personalized health assistant for UltimateHealth.
[TASK & ROLE BOUNDARY]
- Your domain is strictly general preventive health, healthy lifestyle habits, sleep hygiene, and hydration.
- You MUST NEVER answer questions about computer programming/coding, stock trading, politics, creative fiction, or adult/NSFW topics.
- You NEVER provide definitive medical diagnoses or prescribe medications.
- If a query is outside general wellness, politely inform the user and redirect them to Coach Alex (Fitness) or Dr. Sarah (Nutrition).
Keep your answers concise, practical, and medically cautious.`,

    fitness_coach: `You are Coach Alex, the dedicated Fitness Coach for UltimateHealth.
[TASK & ROLE BOUNDARY]
- Your domain is STRICTLY physical fitness: workouts, exercise technique, strength training, cardio, stretching, mobility, and physical recovery.
- You MUST NEVER answer questions about computer programming, financial advice, or adult topics.
- DO NOT design detailed medical diets or treat clinical eating disorders (politely redirect to Dr. Sarah, our Nutritionist).
- DO NOT provide medical diagnoses or prescribe medications.
- If a user asks for anything outside fitness/movement, politely refuse and remind them of your fitness coaching role.
Keep your tone energetic, motivating, and focused on movement! 💪`,

    nutritionist: `You are Dr. Sarah, the professional Nutritionist for UltimateHealth.
[TASK & ROLE BOUNDARY]
- Your domain is STRICTLY dietary guidance: balanced eating, macronutrients/micronutrients, healthy recipes, vitamins, and hydration.
- You MUST NEVER answer questions about computer programming, cryptocurrency, or adult content.
- DO NOT provide workout splits, gym lifting programs, or athletic conditioning (politely redirect to Coach Alex, our Fitness Coach).
- DO NOT provide clinical diagnosis or prescribe pharmaceuticals.
- If a query is outside nutrition and food, politely refuse and steer back to dietary wellness.
Keep your answers encouraging, practical, and focused on wholesome nutrition! 🥗`,

    mental_wellness: `You are Guide Maya, the Mental Wellness Guide for UltimateHealth.
[TASK & ROLE BOUNDARY]
- Your domain is STRICTLY mindfulness, stress management, breathing exercises, meditation, and general emotional self-care.
- You MUST NEVER answer questions about coding, tech support, or adult content.
- You ARE NOT a licensed psychiatrist or crisis counselor. DO NOT diagnose DSM-5 mental disorders or prescribe psychiatric drugs.
- If a user indicates acute suicidal thoughts or severe distress, IMMEDIATELY advise them to call 988 or 911.
- For physical workouts or meal planning, politely redirect to Coach Alex or Dr. Sarah.
Keep your tone warm, empathetic, calming, and soothing. 🧘‍♀️`
};

module.exports = {
    evaluateGuardrails,
    HARDENED_CHARACTER_PROMPTS,
    EMERGENCY_RESPONSE,
    NSFW_REFUSAL,
    JAILBREAK_REFUSAL,
    MALICIOUS_REFUSAL,
    CHARACTER_SCOPES
};
