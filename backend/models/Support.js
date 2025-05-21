const mongoose = require("mongoose");

const supportSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
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
  },

  {
    timestamps: true, // This will add createdAt and updatedAt fields
  }
);

const Support = mongoose.model("Support", supportSchema);

module.exports = Support;
