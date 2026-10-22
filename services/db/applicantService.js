const AdminApplicant = require("../../models/admin/adminApplicantModel");

/**
 * Persist candidate application to separate AdminApplicant collection
 */
const createAdminApplicant = async (applicantData) => {
  return await AdminApplicant.create(applicantData);
};

const findAdminApplicantById = async (id) => {
  return await AdminApplicant.findById(id);
};

const findAdminApplicants = async (filter = {}, options = {}) => {
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.max(1, parseInt(options.limit, 10) || 10);
  const skip = (page - 1) * limit;

  const [applicants, total] = await Promise.all([
    AdminApplicant.find(filter)
      .sort(options.sort || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AdminApplicant.countDocuments(filter),
  ]);

  return {
    applicants,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const updateAdminApplicantStatus = async (id, status, reviewNotes = "") => {
  return await AdminApplicant.findByIdAndUpdate(
    id,
    { status, reviewNotes, updatedAt: new Date() },
    { new: true }
  );
};

module.exports = {
  createAdminApplicant,
  findAdminApplicantById,
  findAdminApplicants,
  updateAdminApplicantStatus,
};
