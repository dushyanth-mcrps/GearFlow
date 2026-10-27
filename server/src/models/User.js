const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['borrower', 'custodian', 'admin'],
      default: 'borrower'
    },
    department: { type: String, default: null },
    phone: { type: String, default: null },
    depositBalance: { type: Number, default: 250.0 }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      }
    }
  }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
