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
  return await AdminApplicant.find(filter).sort(options.sort || { createdAt: -1 });
};

module.exports = {
  createAdminApplicant,
  findAdminApplicantById,
  findAdminApplicants,
};
