const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please fill a valid email address",
      ],
    },
    referralId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      default: function () {
        // Generate a custom referral ID
        // Format: REF-YYYYMMDD-RANDOMSTRING
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const randomString = Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase();
        return `REF-${year}${month}${day}-${randomString}`;
      },
    },
    phoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[+]?[\d\s()-]{10,15}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number!`,
      },
    },
    indiaMartPhoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[+]?[\d\s()-]{10,15}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid IndiaMart phone number!`,
      },
    },
    referralDate: {
      type: Date,
      default: Date.now,
    },
    validityMonths: {
      type: Number,
      required: true,
      min: [1, "Validity must be at least 1 month"],
      max: [36, "Validity cannot exceed 36 months"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiryDate: {
      type: Date,
      default: function () {
        return new Date(
          this.referralDate.getTime() +
            this.validityMonths * 30 * 24 * 60 * 60 * 1000
        );
      },
    },
  },
  {
    timestamps: true, // This will add createdAt and updatedAt fields
  }
);

// Pre-save middleware to calculate expiry date
referralSchema.pre("save", function (next) {
  if (this.isModified("referralDate") || this.isModified("validityMonths")) {
    this.expiryDate = new Date(
      this.referralDate.getTime() +
        this.validityMonths * 30 * 24 * 60 * 60 * 1000
    );
  }
  next();
});

// Method to check if referral is still valid
referralSchema.methods.isValidReferral = function () {
  return this.isActive && new Date() <= this.expiryDate;
};

// Static method to find active referrals
referralSchema.statics.findActiveReferrals = function () {
  return this.find({
    isActive: true,
    expiryDate: { $gte: new Date() },
  });
};

const Referral = mongoose.model("Referral", referralSchema);

module.exports = Referral;
