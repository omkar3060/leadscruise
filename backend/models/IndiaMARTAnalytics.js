// 1. First, create a schema for storing IndiaMART analytics data
const mongoose = require('mongoose');

// Schema for storing chart data
const indiaMArtAnalyticsSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  charts: {
    weekly: { type: String }, // Base64 encoded image
    monthly: { type: String }  // Base64 encoded image
  },
  tables: {
    locations: [{
      location: { type: String },
      leadsConsumed: { type: Number },
      enquiries: { type: Number },
      calls: { type: Number }
    }],
    categories: [{
      category: { type: String },
      leadsConsumed: { type: Number },
      enquiries: { type: Number },
      calls: { type: Number }
    }]
  },
  fetchedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

indiaMArtAnalyticsSchema.index({ userId: 1, fetchedAt: -1 });

const IndiaMARTAnalytics = mongoose.model('IndiaMARTAnalytics', indiaMArtAnalyticsSchema);
module.exports = IndiaMARTAnalytics;