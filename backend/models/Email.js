const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    message: {
        type: String,
        required: true
    },
    pdfPaths: [
        {
            type: String,
            required: true
        }
    ],
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Email', emailSchema);