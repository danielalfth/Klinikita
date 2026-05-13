const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { getAdminQueues, callQueue, skipQueue, recallQueue, assignQueue, linkPatient, getActiveDoctors } = require('../controllers/queue.controller');
const { searchPatients, createPatient } = require('../controllers/patient.controller');
const { getAllMedicalRecords, getPDF } = require('../controllers/medicalRecord.controller');

router.use(verifyToken, requireRole('admin'));

// Queue
router.get('/queues', getAdminQueues);
router.post('/queues/:id/call', callQueue);
router.post('/queues/:id/skip', skipQueue);
router.post('/queues/:id/recall', recallQueue);
router.post('/queues/:id/assign', assignQueue);
router.post('/queues/:id/link-patient', linkPatient);

// Patients
router.get('/patients/search', searchPatients);
router.post('/patients', createPatient);

// Active doctors
router.get('/doctors/active', getActiveDoctors);

// Medical Records (read-only for admin)
router.get('/medical-records', getAllMedicalRecords);
router.get('/medical-records/:id/pdf', getPDF);

module.exports = router;
