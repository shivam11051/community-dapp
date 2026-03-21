const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.get("/:address", userController.getUser);
router.get("/:address/credit", userController.getCreditScore);
router.get("/:address/groups", userController.getUserGroups);

module.exports = router;
