/**
 * Comprehensive Master Data & Mock Admin Seeder for UltimateHealth Admin Dashboard
 * 
 * Populates real production & mock data across ALL Admin routes:
 * 1. Super Admin & Mock Moderators (with verified status, credentials & signature URLs)
 * 2. Medical Specializations (15 clinical disciplines)
 * 3. System Languages (8 locales)
 * 4. Content Clusters & Article Tags (12 health categories)
 * 5. Moderation & Report Reasons (7 medical/compliance reasons)
 * 6. Admin / Reviewer Applicants Pipeline (5 applicants across pending, reviewed, approved, rejected)
 * 7. Mock Articles in Review Queue (unassigned, in-progress, review-pending, published)
 * 8. Mock Article Edit / Improvement Requests (unassigned, in-progress, review-pending)
 * 9. Mock Content Moderation Reports (pending, investigation, resolved)
 * 
 * 100% Idempotent: Uses atomic upserts to prevent duplication.
 */

const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");

// Search and load environment configuration
const envPaths = [
  path.join(__dirname, "..", ".env"),
  path.join("C:", "backend_ultimatehealth", ".env"),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const Admin = require("../models/admin/adminModel");
const Specialization = require("../models/SpecializationsModel");
const Language = require("../models/Language");
const ArticleTag = require("../models/ArticleModel");
const Reason = require("../models/reasonSchema");
const AdminApplicant = require("../models/admin/adminApplicantModel");
const User = require("../models/UserModel");
const Article = require("../models/Articles");
const EditRequest = require("../models/admin/articleEditRequestModel");
const { ReportAction, reportActionEnum } = require("../models/admin/reportActionSchema");
const { statusEnum } = require("../utils/StatusEnum");

async function seedAllAdminData() {
  const primaryUri = process.env.MONGODB_URL || process.env.MONGO_URI;
  const fallbackUri = "mongodb://127.0.0.1:27017/ultimate_health";

  console.log("========================================================");
  console.log("🏥 UltimateHealth: Comprehensive Admin Master Data Seeder");
  console.log("========================================================");

  let connected = false;
  if (primaryUri) {
    try {
      console.log("Connecting to Primary MongoDB URI:", primaryUri.split("@").pop());
      await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 6000 });
      console.log("✅ Connected to Primary MongoDB successfully.\n");
      connected = true;
    } catch (err) {
      console.warn("⚠️ Primary MongoDB connection failed:", err.message);
      console.log("Attempting fallback to local MongoDB...");
    }
  }

  if (!connected) {
    console.log("Connecting to Fallback MongoDB:", fallbackUri);
    await mongoose.connect(fallbackUri, { serverSelectionTimeoutMS: 8000 });
    console.log("✅ Connected to Local Fallback MongoDB successfully.\n");
  }

  const salt = await bcrypt.genSalt(10);
  const superAdminPassword = await bcrypt.hash("SuperAdmin@123", salt);
  const moderatorPassword = await bcrypt.hash("Moderator@123", salt);
  const reviewerPassword = await bcrypt.hash("Reviewer@123", salt);

  // ==============================================================
  // 1. Super Admin & Mock Moderators (Admin Accounts)
  // ==============================================================
  console.log("--- 1. Seeding Mock Admins & Moderators ---");
  const adminRecords = [
    {
      email: "sb2318@it.jgec.ac.in",
      user_name: "Super Admin (UltimateHealth)",
      user_handle: "superadmin_sb",
      role: "Super Admin",
      isSuperAdmin: true,
      isVerified: true,
      isBlocked: false,
      password: superAdminPassword,
      signature_url: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-signatures/superadmin_signature.png",
      Profile_avtar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    },
    {
      email: "dr_ananya@ultimatehealth.org",
      user_name: "Dr. Ananya Sharma",
      user_handle: "dr_ananya_cardio",
      role: "Moderator",
      isSuperAdmin: false,
      isVerified: true,
      isBlocked: false,
      password: moderatorPassword,
      signature_url: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-signatures/dr_ananya_sig.png",
      Profile_avtar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=250&q=80",
    },
    {
      email: "dr_rajesh@ultimatehealth.org",
      user_name: "Dr. Rajesh Verma",
      user_handle: "dr_rajesh_neuro",
      role: "Moderator",
      isSuperAdmin: false,
      isVerified: true,
      isBlocked: false,
      password: moderatorPassword,
      signature_url: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-signatures/dr_rajesh_sig.png",
      Profile_avtar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=250&q=80",
    },
    {
      email: "reviewer@ultimatehealth.org",
      user_name: "Dr. Priya Patel",
      user_handle: "dr_priya_pharm",
      role: "Moderator",
      isSuperAdmin: false,
      isVerified: true,
      isBlocked: false,
      password: reviewerPassword,
      signature_url: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-signatures/dr_priya_sig.png",
      Profile_avtar: "https://images.unsplash.com/photo-1594824813689-fbef49195d0d?auto=format&fit=crop&w=250&q=80",
    },
  ];

  const adminMap = {};
  for (const adm of adminRecords) {
    const filter = { email: adm.email.toLowerCase() };
    const update = {
      $set: {
        user_name: adm.user_name,
        user_handle: adm.user_handle,
        role: adm.role,
        isSuperAdmin: adm.isSuperAdmin,
        isVerified: adm.isVerified,
        isBlocked: adm.isBlocked,
        signature_url: adm.signature_url,
        Profile_avtar: adm.Profile_avtar,
        password: adm.password,
      },
    };
    const saved = await Admin.findOneAndUpdate(filter, update, { upsert: true, new: true });
    adminMap[adm.email] = saved;
    console.log(`  ✓ Admin: ${adm.user_name} | Email: ${adm.email} | Role: ${adm.role}`);
  }

  const superAdminId = adminMap["sb2318@it.jgec.ac.in"]._id;
  const moderatorId = adminMap["dr_ananya@ultimatehealth.org"]._id;

  // ==============================================================
  // 2. Mock Clinical Authors & Contributors (User Model)
  // ==============================================================
  console.log("\n--- 2. Seeding Mock Doctor Authors & Contributors ---");
  const authorDoctors = [
    {
      email: "author.malhotra@ultimatehealth.org",
      user_name: "Dr. Vikram Malhotra",
      user_handle: "dr_malhotra_md",
      uid: "uid_author_malhotra",
      isDoctor: true,
      isVerified: true,
      isBlockUser: false,
      isBannedUser: false,
      specialization: "Cardiology",
      qualification: "MD, DM (Cardiology), FACC",
    },
    {
      email: "author.sen@ultimatehealth.org",
      user_name: "Dr. Sunita Sen",
      user_handle: "dr_sunita_neuro",
      uid: "uid_author_sunita",
      isDoctor: true,
      isVerified: true,
      isBlockUser: false,
      isBannedUser: false,
      specialization: "Neurology",
      qualification: "MBBS, DNB (Neurology)",
    },
    {
      email: "user.aarav@gmail.com",
      user_name: "Aarav Sharma",
      user_handle: "aarav_s",
      uid: "uid_user_aarav",
      isDoctor: false,
      isVerified: true,
      isBlockUser: false,
      isBannedUser: false,
    },
  ];

  const userMap = {};
  for (const u of authorDoctors) {
    const filter = { email: u.email.toLowerCase() };
    const update = {
      $set: {
        user_name: u.user_name,
        user_handle: u.user_handle,
        uid: u.uid,
        isDoctor: u.isDoctor,
        isVerified: u.isVerified,
        isBlockUser: u.isBlockUser,
        isBannedUser: u.isBannedUser,
        specialization: u.specialization || null,
        qualification: u.qualification || null,
      },
    };
    const saved = await User.findOneAndUpdate(filter, update, { upsert: true, new: true });
    userMap[u.email] = saved;
    console.log(`  ✓ User/Author: ${u.user_name} (${u.email}) [Doctor: ${u.isDoctor}]`);
  }

  const doctorMalhotraId = userMap["author.malhotra@ultimatehealth.org"]._id;
  const doctorSunitaId = userMap["author.sen@ultimatehealth.org"]._id;
  const generalUserId = userMap["user.aarav@gmail.com"]._id;

  // ==============================================================
  // 3. Medical Specializations Master Data
  // ==============================================================
  console.log("\n--- 3. Seeding Medical Specializations ---");
  const specializations = [
    { name: "Cardiology & Cardiovascular Surgery", count: 12 },
    { name: "Neurology & Neurosurgery", count: 8 },
    { name: "Endocrinology & Diabetology", count: 10 },
    { name: "Dermatology & Cosmetology", count: 15 },
    { name: "Pediatrics & Adolescent Medicine", count: 14 },
    { name: "Orthopedics & Joint Replacement", count: 9 },
    { name: "Medical & Surgical Oncology", count: 7 },
    { name: "Psychiatry & Behavioral Health", count: 11 },
    { name: "Gastroenterology & Hepatology", count: 8 },
    { name: "Pulmonology & Respiratory Medicine", count: 6 },
    { name: "Ophthalmology & Refractive Surgery", count: 10 },
    { name: "Obstetrics & Gynecology", count: 16 },
    { name: "Nephrology & Renal Transplant", count: 5 },
    { name: "Rheumatology & Clinical Immunology", count: 4 },
    { name: "General Internal Medicine & Family Care", count: 22 },
  ];

  for (const spec of specializations) {
    await Specialization.findOneAndUpdate(
      { name: spec.name },
      {
        $set: {
          name: spec.name,
          countOfExistingDoctors: spec.count,
          last_updated_at: new Date(),
        },
        $setOnInsert: {
          contributed_by: superAdminId,
          created_at: new Date(),
          doctor_ids: [doctorMalhotraId],
        },
      },
      { upsert: true }
    );
    console.log(`  ✓ Specialization: ${spec.name} (${spec.count} doctors)`);
  }

  // ==============================================================
  // 4. Supported Languages Master Data
  // ==============================================================
  console.log("\n--- 4. Seeding System Languages ---");
  const languages = [
    { name: "English", code: "en-IN" },
    { name: "English (US)", code: "en-US" },
    { name: "Hindi (हिन्दी)", code: "hi-IN" },
    { name: "Bengali (বাংলা)", code: "bn-IN" },
    { name: "Tamil (தமிழ்)", code: "ta-IN" },
    { name: "Telugu (తెలుగు)", code: "te-IN" },
    { name: "Marathi (मराठी)", code: "mr-IN" },
    { name: "Spanish (Español)", code: "es-ES" },
  ];

  for (const lang of languages) {
    await Language.findOneAndUpdate(
      { code: lang.code },
      {
        $set: { name: lang.name, code: lang.code },
      },
      { upsert: true }
    );
    console.log(`  ✓ Language: ${lang.name} [Code: ${lang.code}]`);
  }

  // ==============================================================
  // 5. Content Clusters / Article Tags Master Data
  // ==============================================================
  console.log("\n--- 5. Seeding Article Tags / Content Clusters ---");
  const articleTags = [
    { id: 1, name: "Cardiovascular Health" },
    { id: 2, name: "Diabetes & Metabolic Disorders" },
    { id: 3, name: "Mental Health & Neuropsychiatry" },
    { id: 4, name: "Preventive Healthcare & Longevity" },
    { id: 5, name: "Women's Health & Maternal Care" },
    { id: 6, name: "Pediatrics & Child Nutrition" },
    { id: 7, name: "Oncology & Cancer Care" },
    { id: 8, name: "Infectious Diseases & Immunity" },
    { id: 9, name: "Gastrointestinal & Liver Health" },
    { id: 10, name: "Orthopedics & Joint Wellness" },
    { id: 11, name: "Respiratory & Pulmonary Care" },
    { id: 12, name: "Dermatology & Skin Science" },
  ];

  const tagDocs = [];
  for (const tag of articleTags) {
    const savedTag = await ArticleTag.findOneAndUpdate(
      { id: tag.id },
      { $set: { id: tag.id, name: tag.name } },
      { upsert: true, new: true }
    );
    tagDocs.push(savedTag._id);
    console.log(`  ✓ Article Tag [ID ${tag.id}]: ${tag.name}`);
  }

  // ==============================================================
  // 6. Moderation & Report Reasons Master Data
  // ==============================================================
  console.log("\n--- 6. Seeding Moderation & Report Reasons ---");
  const reportReasons = [
    { reason: "Misleading health advice / Medical disinformation", status: "Active" },
    { reason: "Unverified drug claims or dangerous pharmaceutical dosages", status: "Active" },
    { reason: "Plagiarized content without clinical citations or peer-review sources", status: "Active" },
    { reason: "Spam, affiliate marketing or commercial product solicitation", status: "Active" },
    { reason: "Inappropriate, abusive, defamatory or hateful language", status: "Active" },
    { reason: "Violation of patient privacy (HIPAA / DISHA non-compliant identifiable data)", status: "Active" },
    { reason: "Outdated clinical guidance superseded by new medical guidelines", status: "Active" },
  ];

  const reasonDocs = [];
  for (const r of reportReasons) {
    const savedReason = await Reason.findOneAndUpdate(
      { reason: r.reason },
      {
        $set: { reason: r.reason, status: r.status, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true }
    );
    reasonDocs.push(savedReason);
    console.log(`  ✓ Moderation Reason: "${r.reason}"`);
  }

  // ==============================================================
  // 7. Admin / Reviewer Applicants Pipeline
  // ==============================================================
  console.log("\n--- 7. Seeding Reviewer Applicants Pipeline ---");
  const applicants = [
    {
      fullName: "Dr. Meera Nambiar",
      email: "meera.nambiar@apollohospitals.org",
      phone: "+91-9876543211",
      role: "Doctor/Medical Reviewer",
      designation: "Senior Consultant Pediatrician",
      experience: "7 years clinical experience at Apollo Hospitals; Member of IAP",
      message: "Passionate about verifying pediatric clinical literature and ensuring evidence-based medicine for parents.",
      resumeUrl: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-resumes/dr_meera_cv.pdf",
      agreementUrl: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-agreements/dr_meera_agreement.pdf",
      status: "pending",
    },
    {
      fullName: "Dr. Rohan Kapoor",
      email: "rohan.kapoor@maxhealthcare.com",
      phone: "+91-9812345678",
      role: "Content Reviewer",
      designation: "Associate Professor, Orthopedics",
      experience: "10 years orthopedic surgery and sports medicine rehabilitation at Max Healthcare.",
      message: "Interested in moderating musculoskeletal articles, reviewing joint replacement guidance, and myth-busting back pain content.",
      resumeUrl: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-resumes/dr_rohan_cv.pdf",
      agreementUrl: "",
      status: "pending",
    },
    {
      fullName: "Dr. Sneha Mukherjee",
      email: "sneha.mukherjee@nimhans.ac.in",
      phone: "+91-9745612345",
      role: "Doctor/Medical Reviewer",
      designation: "Consultant Neuropsychiatrist",
      experience: "6 years at NIMHANS focusing on mood disorders, anxiety management, and cognitive behavioral protocols.",
      message: "Seeking to ensure mental health articles adhere strictly to DSM-5-TR and ICD-11 diagnostic criteria.",
      resumeUrl: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-resumes/dr_sneha_cv.pdf",
      agreementUrl: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-agreements/dr_sneha_agreement.pdf",
      status: "reviewed",
    },
    {
      fullName: "Dr. Farhan Akhtar",
      email: "farhan.akhtar@fortishealthcare.com",
      phone: "+91-9923456789",
      role: "Moderator",
      designation: "Lead Clinical Pharmacologist",
      experience: "8 years in pharmacovigilance, drug-drug interaction research, and hospital formulary review.",
      message: "Can lead pharmacotherapy review, dosage safety checks, and drug recall advisory updates.",
      resumeUrl: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-resumes/dr_farhan_cv.pdf",
      agreementUrl: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-agreements/dr_farhan_agreement.pdf",
      status: "approved",
    },
    {
      fullName: "Dr. Kavita Rao",
      email: "kavita.rao@aiims.edu",
      phone: "+91-9834567890",
      role: "Doctor/Medical Reviewer",
      designation: "Assistant Professor, Dermatology",
      experience: "5 years post-MD dermatology at AIIMS New Delhi. Clinical trials in biologics for psoriasis.",
      message: "Would like to assist the editorial board in debunking OTC skin remedies and cosmetic product disinformation.",
      resumeUrl: "https://s3.ap-south-1.amazonaws.com/ultimatehealth-resumes/dr_kavita_cv.pdf",
      agreementUrl: "",
      status: "rejected",
    },
  ];

  for (const app of applicants) {
    await AdminApplicant.findOneAndUpdate(
      { email: app.email.toLowerCase() },
      {
        $set: {
          fullName: app.fullName,
          email: app.email.toLowerCase(),
          phone: app.phone,
          role: app.role,
          designation: app.designation,
          experience: app.experience,
          message: app.message,
          resumeUrl: app.resumeUrl,
          agreementUrl: app.agreementUrl,
          status: app.status,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    console.log(`  ✓ Applicant: ${app.fullName} (${app.email}) [Status: ${app.status}]`);
  }

  // ==============================================================
  // 8. Mock Articles in Admin Review Queues
  // ==============================================================
  console.log("\n--- 8. Seeding Mock Articles Across Review Stages ---");
  const reviewArticles = [
    {
      _id: 1001,
      title: "Understanding Atherosclerosis: Prevention and Modern Interventions",
      description: "A comprehensive clinical review on coronary artery plaques and statin therapies.",
      authorName: "Dr. Vikram Malhotra",
      authorId: doctorMalhotraId,
      content: "<p>Atherosclerosis represents the primary pathogenic foundation for cardiovascular morbidity worldwide...</p>",
      summary: "Clinical overview of arterial plaque formation, diagnostic angiography, and therapeutic statin protocols.",
      status: statusEnum.UNASSIGNED,
      reviewer_id: null,
      is_removed: false,
      tags: [tagDocs[0]],
      imageUtils: ["https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=600&q=80"],
      language: "English",
      viewCount: 154,
      likeCount: 23,
    },
    {
      _id: 1002,
      title: "GLP-1 Receptor Agonists in Type 2 Diabetes & Obesity Management",
      description: "Mechanism of action, renal benefits, and cardiovascular safety profiles of Semaglutide & Tirzepatide.",
      authorName: "Dr. Vikram Malhotra",
      authorId: doctorMalhotraId,
      content: "<p>The emergence of GLP-1 receptor agonists has revolutionized cardiometabolic treatment paradigms...</p>",
      summary: "Comparison of GLP-1 and dual GIP/GLP-1 receptor agonists in glycemic control and weight reduction.",
      status: statusEnum.IN_PROGRESS,
      reviewer_id: moderatorId,
      is_removed: false,
      tags: [tagDocs[1]],
      imageUtils: ["https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80"],
      language: "English",
      viewCount: 342,
      likeCount: 45,
    },
    {
      _id: 1003,
      title: "Early Warning Indicators of Pediatric Autoimmune Encephalitis",
      description: "Diagnostic workup, CSF antibody panels, and pulse methylprednisolone management protocols.",
      authorName: "Dr. Sunita Sen",
      authorId: doctorSunitaId,
      content: "<p>Autoimmune encephalitis in pediatric cohorts frequently presents with subacute psychiatric symptoms...</p>",
      summary: "Neuropsychiatric presentation, EEG telemetry, and early immunomodulatory response rates.",
      status: statusEnum.REVIEW_PENDING,
      reviewer_id: moderatorId,
      is_removed: false,
      tags: [tagDocs[2], tagDocs[5]],
      imageUtils: ["https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80"],
      language: "English",
      viewCount: 210,
      likeCount: 31,
    },
    {
      _id: 1004,
      title: "Evidence-Based Management of Hypertension in Primary Care",
      description: "JNC 8 and AHA/ACC guidelines on first-line antihypertensive therapy combinations.",
      authorName: "Dr. Vikram Malhotra",
      authorId: doctorMalhotraId,
      content: "<p>Essential hypertension remains the silent epidemic contributing to chronic kidney disease and stroke...</p>",
      summary: "Stepwise escalation: ACEi/ARB + CCB + Thiazide diuretics in stage 2 hypertension.",
      status: statusEnum.PUBLISHED,
      reviewer_id: moderatorId,
      is_removed: false,
      tags: [tagDocs[0]],
      imageUtils: ["https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80"],
      language: "English",
      viewCount: 1250,
      likeCount: 184,
    },
  ];

  for (const art of reviewArticles) {
    await Article.findOneAndUpdate(
      { _id: art._id },
      { $set: art },
      { upsert: true }
    );
    console.log(`  ✓ Article [ID ${art._id}]: "${art.title.substring(0, 45)}..." | Status: ${art.status}`);
  }

  // ==============================================================
  // 9. Mock Article Improvement / Edit Requests
  // ==============================================================
  console.log("\n--- 9. Seeding Article Improvement / Edit Requests ---");
  const editRequests = [
    {
      article: 1004,
      user_id: doctorSunitaId,
      article_recordId: "rec_art_1004",
      pb_recordId: "pb_edit_001",
      edit_reason: "Updated 2026 ESC guideline references regarding ambulatory blood pressure monitoring (ABPM) targets.",
      status: statusEnum.UNASSIGNED,
      reviewer_id: null,
      edited_content: "<p>Updated 2026 guidelines recommend daytime ABPM targets below 130/80 mmHg...</p>",
      imageUtils: [],
    },
    {
      article: 1004,
      user_id: generalUserId,
      article_recordId: "rec_art_1004",
      pb_recordId: "pb_edit_002",
      edit_reason: "Clarified dietary sodium reduction guidelines and DASH diet potassium intake recommendations.",
      status: statusEnum.IN_PROGRESS,
      reviewer_id: moderatorId,
      edited_content: "<p>DASH dietary intervention demonstrates a 5-11 mmHg systolic reduction in salt-sensitive cohorts...</p>",
      imageUtils: [],
    },
  ];

  for (const er of editRequests) {
    await EditRequest.findOneAndUpdate(
      { pb_recordId: er.pb_recordId },
      { $set: er },
      { upsert: true }
    );
    console.log(`  ✓ Edit Request [Article #${er.article}]: "${er.edit_reason.substring(0, 45)}..." | Status: ${er.status}`);
  }

  // ==============================================================
  // 10. Mock Content Moderation Reports
  // ==============================================================
  console.log("\n--- 10. Seeding Content Moderation Reports ---");
  const mockReports = [
    {
      articleId: 1004,
      reportedBy: generalUserId,
      convictId: doctorMalhotraId,
      reasonId: reasonDocs[0]._id,
      action_taken: reportActionEnum.PENDING,
      admin_id: null,
    },
    {
      articleId: 1001,
      reportedBy: generalUserId,
      convictId: doctorMalhotraId,
      reasonId: reasonDocs[1]._id,
      action_taken: reportActionEnum.INVESTIGATION,
      admin_id: moderatorId,
    },
  ];

  for (const rep of mockReports) {
    await ReportAction.findOneAndUpdate(
      {
        articleId: rep.articleId,
        reportedBy: rep.reportedBy,
      },
      { $set: rep },
      { upsert: true }
    );
    console.log(`  ✓ Content Report: Article #${rep.articleId} | Action: ${rep.action_taken}`);
  }

  console.log("\n========================================================");
  console.log("🎉 ALL ADMIN ROUTES SEEDED WITH COMPREHENSIVE MOCK DATA!");
  console.log("========================================================");
  console.log("\n🔑 Mock Admin Credentials Summary for Dashboard Testing:");
  console.log("--------------------------------------------------------");
  console.log("1. Super Admin:");
  console.log("   - Email:    sb2318@it.jgec.ac.in");
  console.log("   - Password: SuperAdmin@123");
  console.log("   - Role:     Super Admin (isSuperAdmin: true)");
  console.log("2. Moderator (Cardiology Lead):");
  console.log("   - Email:    dr_ananya@ultimatehealth.org");
  console.log("   - Password: Moderator@123");
  console.log("   - Role:     Moderator");
  console.log("3. Moderator (Neurology Editorial):");
  console.log("   - Email:    dr_rajesh@ultimatehealth.org");
  console.log("   - Password: Moderator@123");
  console.log("   - Role:     Moderator");
  console.log("4. Content Reviewer (Pharmacology):");
  console.log("   - Email:    reviewer@ultimatehealth.org");
  console.log("   - Password: Reviewer@123");
  console.log("   - Role:     Moderator\n");

  await mongoose.disconnect();
  console.log("Database disconnected.");
}

seedAllAdminData().catch((err) => {
  console.error("❌ Seeding failed with error:", err);
  process.exit(1);
});
