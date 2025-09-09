const mongoose = require('mongoose');

const whatsappMessageQueueSchema = new mongoose.Schema({
  user_mobile_number: { type: String, required: true },
  whatsappNumber: { type: String, required: true },
  receiverNumber: { type: String, required: true },
  templateMessage: { type: String, required: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'FetchedLead', required: true },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'retrying'], 
    default: 'pending' 
  },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lastAttempt: { type: Date },
  errorMessage: { type: String },
  verificationCode: { type: String },
  createdAt: { type: Date, default: Date.now },
  scheduledAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

whatsappMessageQueueSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model('WhatsAppMessageQueue', whatsappMessageQueueSchema);