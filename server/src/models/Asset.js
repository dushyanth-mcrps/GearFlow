const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    assetTag: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String },
    imageUrl: { type: String },
    conditionGrade: {
      type: String,
      enum: ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'],
      default: 'EXCELLENT'
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'RESERVED', 'IN_USE', 'MAINTENANCE', 'DECOMMISSIONED'],
      default: 'AVAILABLE'
    },
    hourlyPenaltyRate: { type: Number, default: 15.0 },
    replacementCost: { type: Number, default: 2000.0 },
    accessories: [{ type: String }],
    location: { type: String, default: 'Central Media Vault (Bay 1)' }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

module.exports = mongoose.models.Asset || mongoose.model('Asset', assetSchema);
