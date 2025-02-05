const express = require("express");
const { signup, login,update,updateSavedPassword } = require("../controllers/authController");
const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/update-password", update);
router.post("/update-saved-password", updateSavedPassword);
module.exports = router;
