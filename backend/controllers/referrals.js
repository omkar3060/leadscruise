const Referral = require("../models/Referral");
const User = require("../models/userModel"); // Import the User model

// Create a new referral
exports.createReferral = async (req, res) => {
  try {
    const { email, referralId, indiaMartPhoneNumber, validityMonths } =
      req.body;

    console.log("Received referral data:", req.body);

    // Check if referral with same email already exists
    const existingReferral = await Referral.findOne({ email });
    if (existingReferral) {
      return res.status(400).json({
        message: "Referral with this email already exists",
      });
    }

    // Create new referral
    const newReferral = new Referral({
      email,
      referralId,
      indiaMartPhoneNumber,
      validityMonths,
      referralDate: new Date(),
      isActive: true,
    });

    // Save referral
    const savedReferral = await newReferral.save();

    res.status(201).json({
      message: "Referral created successfully",
      referral: savedReferral,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating referral",
      error: error.message,
    });
  }
};

// Get all referrals
exports.getAllReferrals = async (req, res) => {
  try {
    const {
      active,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = {};
    if (active !== undefined) {
      query.isActive = active === "true";
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Pagination
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
    };

    // Fetch referrals
    const referrals = await Referral.find(query)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean(); // Convert documents to plain JavaScript objects

    // Count total referrals
    const totalReferrals = await Referral.countDocuments(query);

    // Count users who used each referral ID
    const userCounts = await User.aggregate([
      { $match: { refId: { $ne: null } } }, // Filter users with non-null refId
      { $group: { _id: "$refId", count: { $sum: 1 } } } // Count users per refId
    ]);

    // Convert userCounts array to an object { referralId: count }
    const userCountMap = {};
    userCounts.forEach((item) => {
      userCountMap[item._id] = item.count;
    });

    // Attach user count to each referral
    referrals.forEach((referral) => {
      referral.userCount = userCountMap[referral.referralId] || 0;
    });

    res.status(200).json({
      referrals,
      totalReferrals,
      totalPages: Math.ceil(totalReferrals / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching referrals",
      error: error.message,
    });
  }
};


// Get single referral by ID
exports.getReferralById = async (req, res) => {
  try {
    const { id } = req.params;
    const referral = await Referral.findOne({ referralId: id });

    if (!referral) {
      return res.status(404).json({
        message: "Referral not found",
      });
    }

    res.status(200).json(referral);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching referral",
      error: error.message,
    });
  }
};

// Update referral
exports.updateReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Prevent email from being changed
    if (updateData.email) {
      delete updateData.email;
    }

    // Find and update referral
    const updatedReferral = await Referral.findByIdAndUpdate(id, updateData, {
      new: true, // Return updated document
      runValidators: true, // Run model validations
    });

    if (!updatedReferral) {
      return res.status(404).json({
        message: "Referral not found",
      });
    }

    res.status(200).json({
      message: "Referral updated successfully",
      referral: updatedReferral,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating referral",
      error: error.message,
    });
  }
};

// Delete referral
exports.deleteReferral = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedReferral = await Referral.findByIdAndDelete(id);

    if (!deletedReferral) {
      return res.status(404).json({ message: "Referral not found" });
    }

    res.status(200).json({ message: "Referral deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting referral", error: error.message });
  }
};

// Bulk operations
exports.bulkUpdateReferrals = async (req, res) => {
  try {
    const { referralIds, updates } = req.body;

    const result = await Referral.updateMany(
      { _id: { $in: referralIds } },
      updates
    );

    res.status(200).json({
      message: "Bulk update successful",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error in bulk update",
      error: error.message,
    });
  }
};

// Search referrals
exports.searchReferrals = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;

    const searchConditions = {
      $or: [
        { email: { $regex: query, $options: "i" } },
        { phoneNumber: { $regex: query, $options: "i" } },
        { indiaMartPhoneNumber: { $regex: query, $options: "i" } },
      ],
    };

    const referrals = await Referral.find(searchConditions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalReferrals = await Referral.countDocuments(searchConditions);

    res.status(200).json({
      referrals,
      totalReferrals,
      totalPages: Math.ceil(totalReferrals / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error searching referrals",
      error: error.message,
    });
  }
};
