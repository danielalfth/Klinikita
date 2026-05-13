const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { getDoctorQueues, callInQueue, completeQueue } = require('../controllers/queue.controller');
const { getPatientRecords, updateMedicalRecord, getPDF, getShiftStatus, getAllMedicalRecords } = require('../controllers/medicalRecord.controller');

router.use(verifyToken, requireRole('dokter'));

// Queue
router.get('/queues', getDoctorQueues);
router.post('/queues/:id/call-in', callInQueue);
router.post('/queues/:id/complete', completeQueue);

// Medical Records — per pasien
router.get('/patients/:patient_id/records', getPatientRecords);
router.put('/medical-records/:id', updateMedicalRecord);
router.get('/medical-records/:id/pdf', getPDF);

// Medical Records — semua pasien (global, dengan search)
router.get('/medical-records', getAllMedicalRecords);

// Shift
router.get('/shift-status', getShiftStatus);

module.exports = router;
