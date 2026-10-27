const express = require('express');
const router = express.Router();
const {
  getAllAssets,
  getAssetById,
  checkAvailability,
  createAsset,
  updateAsset,
  getCategories
} = require('../controllers/assetController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/categories', getCategories);
router.get('/', getAllAssets);
router.get('/:id', getAssetById);
router.get('/:id/availability', checkAvailability);
router.post('/', authenticate, authorize('custodian', 'admin'), createAsset);
router.put('/:id', authenticate, authorize('custodian', 'admin'), updateAsset);

module.exports = router;
