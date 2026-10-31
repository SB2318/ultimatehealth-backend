let cachePBClient = null;

const { pocketbaseBreaker } = require("./circuitBreaker");

const getHTMLFileContent = async (collectionName, recordId) => {
    return await pocketbaseBreaker.execute(
        async () => {
            const pb = await getPocketbaseClient();
            await authenticateAdmin(pb);

            const record = await pb.collection(collectionName).getOne(recordId);
            const fileName = collectionName === 'content' ? record.html_file : record.edited_html_file;

            // In PocketBase JS SDK v0.23+, getUrl is preferred over getURL
            const htmlFileUrl = pb.files.getURL ? pb.files.getURL(record, fileName) : pb.files.getUrl(record, fileName);
            const response = await fetch(htmlFileUrl);
            const htmlContent = await response.text();

            return { htmlContent, fileName };
        },
        (error) => {
            console.warn("[PocketBaseBreaker] Fallback triggered for getHTMLFileContent:", error.message);
            return { htmlContent: "<p>Content temporarily unavailable.</p>", fileName: "unavailable.html" };
        }
    );
};

const authenticateAdmin = async (pb) => {
    const ADMIN_EMAIL = process.env.DATASOURCE_USERNAME;
    const ADMIN_PASSWORD = process.env.DATASOURCE_PASSWORD;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        console.warn('⚠️ Missing DATASOURCE_USERNAME or DATASOURCE_PASSWORD in environment');
        return;
    }

    try {
        if (pb && pb.authStore && pb.authStore.isValid) {
            return;
        }
        if (pb && pb.authStore) {
            pb.authStore.clear();
        }

        // PocketBase v0.23+ and SDK v0.26+ uses '_superusers' collection, older uses pb.admins
        let authData;
        try {
            authData = await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        } catch (superErr) {
            if (pb.admins?.authWithPassword) {
                authData = await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
            } else {
                throw superErr;
            }
        }
        return authData;
    } catch (err) {
        console.error("❌ PocketBase Admin authentication failed:", err.message);
        throw err;
    }
};

const getPocketbaseClient = async () => {
    if (cachePBClient) {
        return cachePBClient;
    }
    const Pocketbase = (await import('pocketbase')).default;
    const url = process.env.DATASOURCE_URL || process.env.POCKETBASE_URL || (process.env.NODE_ENV === 'production' ? 'http://pocketbase:8090' : 'http://127.0.0.1:8090');
    const client = new Pocketbase(url);
    cachePBClient = client;
    return client;
};

const deleteArticleRecordFromPocketbase = async (record_id) => {
    if (!record_id) {
        return;
    }
    try {
        const pb = await getPocketbaseClient();
        await authenticateAdmin(pb);
        const articleRecord = await pb.collection('content').getOne(record_id);

        if (!articleRecord) {
            return;
        }
        await pb.collection('content').delete(record_id);
    } catch (err) {
        console.log("Error deleting article file from pocketbase:", err);
    }
};

module.exports = {
    getHTMLFileContent,
    authenticateAdmin,
    getPocketbaseClient,
    deleteArticleRecordFromPocketbase
};