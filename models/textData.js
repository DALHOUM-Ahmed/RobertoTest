const mongoose = require('mongoose');

const textDataSchema = new mongoose.Schema({
  ipfsHash: {
    type: String,
    required: true,
    unique: true,
  },
}, { timestamps: true });

const TextData = mongoose.model('TextData', textDataSchema);

module.exports = TextData;