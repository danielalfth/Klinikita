const express = require('express');
const router = express.Router();
const { getInfo, getSchedule } = require('../controllers/schedule.controller');
const { takeTicket, getQueueStatus } = require('../controllers/queue.controller');
const { getPatientPDF, getPatientMedicalRecordId } = require('../controllers/medicalRecord.controller');

router.get('/info', getInfo);
router.get('/schedule', getSchedule);
router.post('/queue/take', takeTicket);
router.get('/queue/status', getQueueStatus);
router.get('/queue/medical-record-id', getPatientMedicalRecordId);
router.get('/medical-records/:id/pdf', getPatientPDF);

module.exports = router;
