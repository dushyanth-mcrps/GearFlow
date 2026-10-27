const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CHECKED_OUT', 'RETURNED', 'OVERDUE', 'CANCELLED', 'FLAGGED_DAMAGE'],
      default: 'CONFIRMED'
    },
    purpose: { type: String, default: null },
    checkedOutAt: { type: Date, default: null },
    checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    checkoutChecklist: { type: mongoose.Schema.Types.Mixed, default: {} },
    checkoutNotes: { type: String, default: null },
    returnedAt: { type: Date, default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    returnInspection: { type: mongoose.Schema.Types.Mixed, default: {} },
    returnNotes: { type: String, default: null },
    overduePenaltyFee: { type: Number, default: 0.0 },
    damagePenaltyFee: { type: Number, default: 0.0 },
    penaltyStatus: {
      type: String,
      enum: ['NONE', 'ASSESSED', 'PAID', 'WAIVED'],
      default: 'NONE'
    }
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

// Compound index for fast conflict detection queries
reservationSchema.index({ assetId: 1, startTime: 1, endTime: 1, status: 1 });
reservationSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema);
