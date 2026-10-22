const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Try loading .env from current directory or parent directory
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

const adminModel = require("../models/admin/adminModel");

async function updateSuperAdmin() {
  const mongoUri = process.env.MONGODB_URL || process.env.MONGO_URI;

  if (!mongoUri) {
    console.error("❌ MONGODB_URL not found in environment.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log("Connected to MongoDB.");

  const emailsToMatch = [
    "sb2318@it.jgec.ac.in",
    "sb2318@it,jgec.ac.in",
  ];

  const result = await adminModel.updateMany(
    {
      $or: [
        { email: { $in: emailsToMatch } },
        { email: { $regex: /^sb2318@it[.,]jgec\.ac\.in$/i } },
      ],
    },
    {
      $set: {
        isSuperAdmin: true,
        role: "Super Admin",
      },
    }
  );

  console.log(`Matched ${result.matchedCount} admin document(s), updated ${result.modifiedCount}.`);

  const updated = await adminModel.find({
    $or: [
      { email: { $in: emailsToMatch } },
      { email: { $regex: /^sb2318@it[.,]jgec\.ac\.in$/i } },
    ],
  }).lean();

  console.log("Admin accounts found:", updated.map((a) => ({
    email: a.email,
    user_name: a.user_name,
    isSuperAdmin: a.isSuperAdmin,
    role: a.role,
  })));

  await mongoose.disconnect();
  console.log("Done.");
}

updateSuperAdmin().catch((err) => {
  console.error("Error updating super admin:", err.message);
  process.exit(1);
});
