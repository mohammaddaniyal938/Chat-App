const router = require("express").Router();
const controller = require("../controllers/authController");
router.post("/signup", controller.signup);
router.post("/login", controller.login);
router.post("/logout", require("../middleware/auth").authenticate, controller.logout);
module.exports = router;
