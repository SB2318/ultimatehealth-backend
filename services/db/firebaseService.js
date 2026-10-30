const admin = require("../../config/firebase");

/**
 * Syncs / clones a MongoDB user to Firebase Auth and Firestore.
 * Handles both new creation and updating existing records safely.
 *
 * @param {Object} user - The MongoDB User document/object
 * @returns {Promise<Object|null>} Firebase user record or null on error
 */
const cloneUserToFirebase = async (user) => {
  if (!user || !user.email) {
    console.warn("[FirebaseService] cloneUserToFirebase: Missing user or email");
    return null;
  }

  try {
    let firebaseUser;

    // 1. Check if user already exists in Firebase Auth by email
    try {
      firebaseUser = await admin.auth().getUserByEmail(user.email);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        // 2. Create user in Firebase Auth if not found
        firebaseUser = await admin.auth().createUser({
          uid: user.uid || undefined,
          email: user.email,
          emailVerified: Boolean(user.isVerified),
          displayName: user.user_name || undefined,
          photoURL: user.Profile_image || undefined,
        });
        console.log(`[FirebaseService] Created user in Firebase Auth: ${user.email} (UID: ${firebaseUser.uid})`);
      } else {
        throw err;
      }
    }

    // 3. Update UID in MongoDB user if not already matching
    if (firebaseUser && firebaseUser.uid && user.uid !== firebaseUser.uid) {
      user.uid = firebaseUser.uid;
      if (typeof user.save === "function") {
        await user.save();
      }
    }

    // 4. Optionally sync to Firestore "users" collection
    try {
      if (admin.firestore) {
        const firestore = admin.firestore();
        await firestore.collection("users").doc(user._id ? user._id.toString() : firebaseUser.uid).set({
          uid: firebaseUser.uid,
          email: user.email,
          user_name: user.user_name || "",
          user_handle: user.user_handle || "",
          isDoctor: Boolean(user.isDoctor),
          isVerified: Boolean(user.isVerified),
          Profile_image: user.Profile_image || "",
          updated_at: new Date(),
        }, { merge: true });
      }
    } catch (firestoreErr) {
      console.warn("[FirebaseService] Firestore user sync skipped:", firestoreErr.message);
    }

    return firebaseUser;
  } catch (error) {
    console.error(`[FirebaseService] Error syncing user ${user.email} to Firebase:`, error.message);
    return null;
  }
};

module.exports = {
  cloneUserToFirebase,
};
