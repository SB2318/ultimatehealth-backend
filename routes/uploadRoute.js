const multer = require('multer');
const express = require('express');
const controller = require('../controllers/uploadController');
const upload = multer({ dest: 'uploads/' }); 
const authenticateToken = require('../middleware/authentcatetoken');
const publisherMiddleware = require('../middleware/publisherMiddleware');
const adminAuthenticateToken = require("../middleware/adminAuthenticateToken");
const requireSuperAdmin = require("../middleware/superAdminMiddleware");
const uploadRoute = express.Router();

// For Storage Server

uploadRoute.post('/upload-storage', upload.single('file'), controller.uploadFile);

uploadRoute.get('/getFile/:key(*)', controller.getFile);
uploadRoute.get('/getFile/:key', controller.getFile);

uploadRoute.delete('/deleteFile/:key(*)', adminAuthenticateToken, requireSuperAdmin, controller.deleteFile);
uploadRoute.delete('/deleteFile/:key', adminAuthenticateToken, requireSuperAdmin, controller.deleteFile);

uploadRoute.post('/upload-pocketbase/article', publisherMiddleware, controller.uploadFileToPocketBase);

uploadRoute.post('/article/upload-pocketbase-file', authenticateToken, upload.single('file'), controller.uploadHTMLToPocketBase);
uploadRoute.post('/upload-pocketbase/improvement', authenticateToken,  controller.uploadImprovementFileToPocketbase);

uploadRoute.post('/publish-improvement-from-pocketbase', adminAuthenticateToken, controller.publishImprovementFileFromPocketbase);

uploadRoute.get('/articles/get-article-content/:id', controller.getPbFile); // auth removed for guest profile, purpose: user can read article in unauthenticated state
uploadRoute.get('/article/get-improve-content', authenticateToken, controller.getIMPFile);


uploadRoute.delete('/delete-improvement/:record_id', adminAuthenticateToken, controller.deleteImprovementRecordFromPocketbase);

uploadRoute.delete('/delete-pocketbase-record/:collectionName/:recordId', adminAuthenticateToken, requireSuperAdmin, controller.deletePocketbaseRecord);

module.exports = uploadRoute;


