const HealthResource = require('../models/HealthResource');
const validator = require('validator');
const mongoose = require('mongoose');

const getPublicFilter = (additionalFilters = {}) => {
    return {
        status: 'published',
        'verification.verified': true,
        $and: [
            {
                $or: [
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } }
                ]
            },
            additionalFilters
        ]
    };
};

const getPublicHealthResources = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            category,
            country,
            region,
            language,
            sourceType,
            isFree,
            tag,
            search,
            q,
            sort = '-createdAt'
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        const queryConditions = {};

        const detectedCountry = country
            ? country.trim().toUpperCase()
            : (req.headers['cf-ipcountry'] || req.headers['x-country-code'] || req.user?.country || null);

        if (detectedCountry && detectedCountry !== 'ALL') {
            queryConditions.country = { $in: [detectedCountry, 'GLOBAL'] };
        }

        if (category) {
            queryConditions.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
        }

        if (region) {
            queryConditions.region = { $regex: new RegExp(`^${region.trim()}$`, 'i') };
        }

        if (language) {
            queryConditions.languages = { $in: [language.trim().toLowerCase()] };
        }

        if (sourceType) {
            queryConditions.sourceType = sourceType.trim().toLowerCase();
        }

        if (isFree !== undefined) {
            queryConditions.isFree = isFree === 'true' || isFree === true;
        }

        if (tag) {
            queryConditions.tags = { $in: [tag.trim().toLowerCase()] };
        }

        const searchText = (search || q || '').trim();
        if (searchText) {
            const regex = new RegExp(searchText, 'i');
            queryConditions.$or = [
                { title: regex },
                { description: regex },
                { provider: regex },
                { tags: regex }
            ];
        }

        const filter = getPublicFilter(queryConditions);

        const [total, resources] = await Promise.all([
            HealthResource.countDocuments(filter),
            HealthResource.find(filter)
                .select('-auditTrail -__v')
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .lean()
        ]);

        return res.status(200).json({
            success: true,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1,
            detectedCountry: detectedCountry || 'GLOBAL',
            data: resources
        });
    } catch (err) {
        console.error('getPublicHealthResources error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve public health resources'
        });
    }
};

// GET /api/v1/health-resources/categories
const getPublicCategories = async (req, res) => {
    try {
        const filter = getPublicFilter();

        const categories = await HealthResource.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1, _id: 1 } },
            {
                $project: {
                    _id: 0,
                    category: '$_id',
                    count: 1
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (err) {
        console.error('getPublicCategories error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve categories'
        });
    }
};

// GET /api/v1/health-resources/featured
const getFeaturedHealthResources = async (req, res) => {
    try {
        const limitNum = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));
        const filter = getPublicFilter();

        const resources = await HealthResource.find(filter)
            .select('-auditTrail -__v')
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(limitNum)
            .lean();

        return res.status(200).json({
            success: true,
            count: resources.length,
            data: resources
        });
    } catch (err) {
        console.error('getFeaturedHealthResources error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve featured health resources'
        });
    }
};

// GET /api/v1/health-resources/:slug
const getPublicHealthResourceBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        if (!slug) {
            return res.status(400).json({
                success: false,
                error: 'Slug parameter is required'
            });
        }

        const filter = getPublicFilter({ slug: slug.trim().toLowerCase() });
        const resource = await HealthResource.findOne(filter)
            .select('-auditTrail -__v')
            .lean();

        if (!resource) {
            return res.status(404).json({
                success: false,
                error: 'Health resource not found or currently unavailable'
            });
        }

        return res.status(200).json({
            success: true,
            data: resource
        });
    } catch (err) {
        console.error('getPublicHealthResourceBySlug error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve health resource'
        });
    }
};

const createAdminHealthResource = async (req, res) => {
    try {
        const {
            title,
            slug,
            description,
            category,
            provider,
            officialUrl,
            country,
            region,
            languages,
            eligibility,
            isFree,
            sourceType,
            thumbnail,
            tags,
            status = 'draft',
            expiresAt
        } = req.body;

        if (!title || !description || !category || !provider || !officialUrl) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: title, description, category, provider, and officialUrl are required.'
            });
        }

        if (!validator.isURL(officialUrl, { protocols: ['http', 'https'], require_protocol: true })) {
            return res.status(400).json({
                success: false,
                error: 'officialUrl must be a valid HTTP or HTTPS URL'
            });
        }

        if (status === 'published') {
            return res.status(400).json({
                success: false,
                error: 'Unverified resources cannot be published directly on creation. Verify the resource before publishing.'
            });
        }

        const resourceData = {
            title,
            slug,
            description,
            category,
            provider,
            officialUrl,
            country: country ? String(country).trim().toUpperCase() : 'GLOBAL',
            region: region || 'National',
            languages: Array.isArray(languages) && languages.length > 0 ? languages : ['en'],
            eligibility: eligibility || 'Open to all eligible citizens',
            isFree: isFree !== undefined ? isFree : true,
            sourceType: sourceType || 'government',
            thumbnail: thumbnail || '',
            tags: Array.isArray(tags) ? tags.map(t => String(t).trim().toLowerCase()) : [],
            status: status || 'draft',
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            verification: {
                verified: false,
                verifiedAt: null,
                verifiedBy: null
            },
            auditTrail: [
                {
                    action: 'CREATED',
                    performedBy: req.userId || null,
                    timestamp: new Date(),
                    details: { initialStatus: status || 'draft' }
                }
            ]
        };

        const resource = new HealthResource(resourceData);
        await resource.save();

        return res.status(201).json({
            success: true,
            message: 'Health resource created successfully',
            data: resource
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A health resource with this slug already exists'
            });
        }
        if (err.name === 'ValidationError') {
            const firstError = Object.values(err.errors)[0]?.message || 'Validation error';
            return res.status(400).json({
                success: false,
                error: firstError
            });
        }
        console.error('createAdminHealthResource error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to create health resource'
        });
    }
};

// PATCH /api/v1/health-resources/admin/:id
const updateAdminHealthResource = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid resource ID'
            });
        }

        const resource = await HealthResource.findById(id);
        if (!resource) {
            return res.status(404).json({
                success: false,
                error: 'Health resource not found'
            });
        }

        const updates = req.body;

        if (updates.officialUrl && !validator.isURL(updates.officialUrl, { protocols: ['http', 'https'], require_protocol: true })) {
            return res.status(400).json({
                success: false,
                error: 'officialUrl must be a valid HTTP or HTTPS URL'
            });
        }

        if (updates.status === 'published') {
            const isVerified = updates.verification?.verified ?? resource.verification?.verified;
            if (!isVerified) {
                return res.status(400).json({
                    success: false,
                    error: 'Unverified resources cannot be published. Verify the resource first.'
                });
            }
        }

        const allowedFields = [
            'title',
            'slug',
            'description',
            'category',
            'provider',
            'officialUrl',
            'country',
            'region',
            'languages',
            'eligibility',
            'isFree',
            'sourceType',
            'thumbnail',
            'tags',
            'status',
            'expiresAt'
        ];

        const changedFields = [];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                resource[field] = updates[field];
                changedFields.push(field);
            }
        });

        resource.auditTrail.push({
            action: 'UPDATED',
            performedBy: req.userId || null,
            timestamp: new Date(),
            details: { updatedFields: changedFields }
        });

        await resource.save();

        return res.status(200).json({
            success: true,
            message: 'Health resource updated successfully',
            data: resource
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A health resource with this slug already exists'
            });
        }
        if (err.name === 'ValidationError') {
            const firstError = Object.values(err.errors)[0]?.message || 'Validation error';
            return res.status(400).json({
                success: false,
                error: firstError
            });
        }
        console.error('updateAdminHealthResource error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to update health resource'
        });
    }
};

const deleteAdminHealthResource = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid resource ID'
            });
        }

        const resource = await HealthResource.findById(id);
        if (!resource) {
            return res.status(404).json({
                success: false,
                error: 'Health resource not found'
            });
        }

        resource.status = 'archived';
        resource.auditTrail.push({
            action: 'ARCHIVED',
            performedBy: req.userId || null,
            timestamp: new Date(),
            details: { previousStatus: resource.status }
        });

        await resource.save();

        return res.status(200).json({
            success: true,
            message: 'Health resource archived successfully',
            data: resource
        });
    } catch (err) {
        console.error('deleteAdminHealthResource error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to archive health resource'
        });
    }
};

const verifyAdminHealthResource = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid resource ID'
            });
        }

        const resource = await HealthResource.findById(id);
        if (!resource) {
            return res.status(404).json({
                success: false,
                error: 'Health resource not found'
            });
        }

        resource.verification = {
            verified: true,
            verifiedAt: new Date(),
            verifiedBy: req.userId || null
        };

        resource.auditTrail.push({
            action: 'VERIFIED',
            performedBy: req.userId || null,
            timestamp: new Date(),
            details: { verifiedAt: resource.verification.verifiedAt }
        });

        await resource.save();

        return res.status(200).json({
            success: true,
            message: 'Health resource verified successfully',
            data: resource
        });
    } catch (err) {
        console.error('verifyAdminHealthResource error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to verify health resource'
        });
    }
};

const publishAdminHealthResource = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid resource ID'
            });
        }

        const resource = await HealthResource.findById(id);
        if (!resource) {
            return res.status(404).json({
                success: false,
                error: 'Health resource not found'
            });
        }

        if (!resource.verification || !resource.verification.verified) {
            return res.status(400).json({
                success: false,
                error: 'Cannot publish unverified health resource. Please verify the resource first.'
            });
        }

        resource.status = 'published';
        resource.auditTrail.push({
            action: 'PUBLISHED',
            performedBy: req.userId || null,
            timestamp: new Date(),
            details: { publishedAt: new Date() }
        });

        await resource.save();

        return res.status(200).json({
            success: true,
            message: 'Health resource published successfully',
            data: resource
        });
    } catch (err) {
        console.error('publishAdminHealthResource error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to publish health resource'
        });
    }
};

module.exports = {
    getPublicHealthResources,
    getPublicCategories,
    getFeaturedHealthResources,
    getPublicHealthResourceBySlug,
    createAdminHealthResource,
    updateAdminHealthResource,
    deleteAdminHealthResource,
    verifyAdminHealthResource,
    publishAdminHealthResource
};
