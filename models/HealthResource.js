const mongoose = require('mongoose');
const validator = require('validator');

const healthResourceSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Resource title is required'],
            trim: true,
            minlength: [3, 'Title must be at least 3 characters long'],
            maxlength: [250, 'Title cannot exceed 250 characters']
        },
        slug: {
            type: String,
            required: [true, 'Resource slug is required'],
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        description: {
            type: String,
            required: [true, 'Resource description is required'],
            trim: true,
            minlength: [10, 'Description must be at least 10 characters long']
        },
        category: {
            type: String,
            required: [true, 'Resource category is required'],
            trim: true,
            index: true
        },
        provider: {
            type: String,
            required: [true, 'Resource provider or governing body is required'],
            trim: true,
            index: true
        },
        officialUrl: {
            type: String,
            required: [true, 'Official resource URL is required'],
            trim: true,
            validate: {
                validator: function (v) {
                    if (!v || typeof v !== 'string') return false;
                    return validator.isURL(v, {
                        protocols: ['http', 'https'],
                        require_protocol: true
                    });
                },
                message: props => `${props.value} is not a valid HTTP/HTTPS URL`
            }
        },
        region: {
            type: String,
            default: 'National',
            trim: true,
            index: true
        },
        languages: {
            type: [String],
            default: ['en']
        },
        eligibility: {
            type: String,
            default: 'Open to all eligible citizens',
            trim: true
        },
        isFree: {
            type: Boolean,
            default: true,
            index: true
        },
        sourceType: {
            type: String,
            enum: ['government', 'ngo', 'public-health-org', 'international', 'other'],
            default: 'government',
            required: true,
            index: true
        },
        thumbnail: {
            type: String,
            default: '',
            trim: true
        },
        tags: {
            type: [String],
            default: [],
            index: true
        },
        status: {
            type: String,
            enum: ['draft', 'published', 'archived'],
            default: 'draft',
            required: true,
            index: true
        },
        verification: {
            verified: {
                type: Boolean,
                default: false,
                index: true
            },
            verifiedAt: {
                type: Date,
                default: null
            },
            verifiedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'admin',
                default: null
            }
        },
        expiresAt: {
            type: Date,
            default: null,
            index: true
        },
        auditTrail: [
            {
                action: {
                    type: String,
                    enum: ['CREATED', 'UPDATED', 'VERIFIED', 'PUBLISHED', 'ARCHIVED'],
                    required: true
                },
                performedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'admin',
                    default: null
                },
                timestamp: {
                    type: Date,
                    default: Date.now
                },
                details: {
                    type: mongoose.Schema.Types.Mixed
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

function generateSlug(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

healthResourceSchema.pre('validate', function () {
    if (!this.slug && this.title) {
        this.slug = generateSlug(this.title);
    } else if (this.slug) {
        this.slug = generateSlug(this.slug);
    }
});

healthResourceSchema.pre('save', function () {
    if (this.status === 'published' && (!this.verification || !this.verification.verified)) {
        throw new Error('Unverified resources cannot be published');
    }
});

healthResourceSchema.index({ status: 1, 'verification.verified': 1, expiresAt: 1 });
healthResourceSchema.index({ category: 1, status: 1, 'verification.verified': 1 });
healthResourceSchema.index({ region: 1, status: 1, 'verification.verified': 1 });

healthResourceSchema.index({
    title: 'text',
    description: 'text',
    provider: 'text',
    tags: 'text'
});

const HealthResource = mongoose.model('HealthResource', healthResourceSchema);

module.exports = HealthResource;
