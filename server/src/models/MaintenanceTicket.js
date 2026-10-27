const mongoose = require('mongoose');

const maintenanceTicketSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null },
    issueDescription: { type: String, required: true },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN'
    },
    assignedTo: { type: String, default: null },
    estimatedRepairCost: { type: Number, default: 0.0 },
    resolutionNotes: { type: String, default: null },
    resolvedAt: { type: Date, default: null }
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

maintenanceTicketSchema.index({ assetId: 1, status: 1 });

module.exports = mongoose.models.MaintenanceTicket || mongoose.model('MaintenanceTicket', maintenanceTicketSchema);
