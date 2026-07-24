require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('./models/UserModel');
const { dbConnect } = require('./config/database');

const HANDLES = [
  '@SB2318', '@suhanipaliwal', '@BHS-Harish', '@SharmaNishchay', '@officeneerajsaini',
  '@meghanagottapu', '@jaickeyminj', '@Asymtode712', '@PradnyaGaitonde', '@sanmarg',
  '@adrikaDwivedi', '@Arpcoder', '@alishasingh06', '@Sibam-Paul', '@rushiii3',
  '@soham0005', '@kylie-kiaying', '@Himanshu8850', '@Hemu21', '@nishant0708',
  '@Kamaleshbala01', '@ParthNakum21', '@Abhigna-arsam', '@MaryamMohamedYahya',
  '@thevijayshankersharma', '@TonyStark-47', '@iamworrell', '@Aditijainnn',
  '@ananyag309', '@akshathere', '@Ayushmaanagarwal1211', '@Damini2004',
  '@Parth20GitHub', '@sreevidya-16', '@AsmitaMishra24', '@iamkanhaiyakumar',
  '@revanth1718', '@arunimaChintu', '@Maana-Ajmera', '@ANKeshri',
  '@Utsavladia', '@Nayanika1402', '@Maheshwari-Love', '@Pujan-sarkar'
];

async function exportContributors() {
  console.log('🔄 Connecting to MongoDB database...');
  dbConnect();

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`🔍 Fetching details for ${HANDLES.length} contributors...`);

  const users = await User.find({ user_handle: { $in: HANDLES } }).lean();

  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "sb2318@ultimatehealth_refresh";

  const formattedContributors = users.map(user => {
    const tokenPayload = {
      userId: user._id.toString(),
      user_id: user._id.toString(),
      email: user.email,
      user_handle: user.user_handle,
      isContributor: true
    };
    const refreshToken = jwt.sign(tokenPayload, secret, { expiresIn: '20m' });

    return {
      userId: user._id.toString(),
      userName: user.user_name,
      userHandle: user.user_handle,
      email: user.email,
      defaultPassword: 'ContributorPass123!',
      refreshToken: refreshToken,
      refreshTokenExpiresIn: '20m',
      isVerified: user.isVerified,
      isContributor: user.isContributor,
      profileImage: user.Profile_image,
      createdAt: user.created_at
    };
  });

  const jsonOutputPath = path.join(__dirname, 'contributors_credentials.json');
  fs.writeFileSync(jsonOutputPath, JSON.stringify(formattedContributors, null, 2));

  console.log(`✅ Saved ${formattedContributors.length} contributor credentials to ${jsonOutputPath}`);

  // Create Markdown Summary table
  let mdContent = `# Verified Contributors Credentials & Article Author IDs\n\n`;
  mdContent += `Total Contributors: **${formattedContributors.length}**\n`;
  mdContent += `Default Password for all seeded accounts: \`ContributorPass123!\`\n\n`;
  mdContent += `| # | User ID (\`_id\`) | Name | Handle | Email | Verified | Contributor |\n`;
  mdContent += `|---|---|---|---|---|---|---|\n`;

  formattedContributors.forEach((c, idx) => {
    mdContent += `| ${idx + 1} | \`${c.userId}\` | ${c.userName} | \`${c.userHandle}\` | \`${c.email}\` | ${c.isVerified ? '✅' : '❌'} | ${c.isContributor ? '✅' : '❌'} |\n`;
  });

  const mdOutputPath = path.join(__dirname, 'contributors_credentials.md');
  fs.writeFileSync(mdOutputPath, mdContent);
  console.log(`✅ Saved Markdown summary to ${mdOutputPath}`);

  mongoose.connection.close();
  process.exit(0);
}

exportContributors();
