const mongoose = require('mongoose');
const { Schema } = mongoose;

const User = mongoose.models.User || mongoose.model('User', new Schema({
  name: { type: String, required: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['doctor', 'reception'], required: true },
  active: { type: Boolean, default: true },
  failedAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
}, { timestamps: true }));

const Service = mongoose.models.Service || mongoose.model('Service', new Schema({
  name: { type: String, required: true, maxlength: 100 },
  price: { type: Number, required: true, min: 0, max: 1000000 },
  description: { type: String, default: '', maxlength: 300 },
  active: { type: Boolean, default: true },
}, { timestamps: true }));

const Patient = mongoose.models.Patient || mongoose.model('Patient', new Schema({
  name: { type: String, required: true, maxlength: 100, index: true },
  phone: { type: String, required: true, maxlength: 20, index: true },
  age: { type: Number, min: 0, max: 120, default: null },
  notes: { type: String, default: '', maxlength: 2000 },
}, { timestamps: true }));

const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', new Schema({
  patientName: { type: String, required: true, maxlength: 100 },
  phone: { type: String, required: true, maxlength: 20, index: true },
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', default: null },
  service: { type: Schema.Types.ObjectId, ref: 'Service', default: null },
  serviceName: { type: String, default: '', maxlength: 100 },
  date: { type: String, required: true },  // YYYY-MM-DD
  time: { type: String, required: true },  // HH:MM
  note: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['pending', 'confirmed', 'done', 'canceled'], default: 'pending', index: true },
  source: { type: String, enum: ['online', 'staff'], default: 'online' },
  ipHash: { type: String, default: '' },
}, { timestamps: true }));

const Payment = mongoose.models.Payment || mongoose.model('Payment', new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },
  amount: { type: Number, required: true, min: 0.01, max: 10000000 },
  method: { type: String, enum: ['cash', 'card', 'other'], default: 'cash' },
  note: { type: String, default: '', maxlength: 300 },
  paidAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }));

module.exports = { User, Service, Patient, Appointment, Payment };
