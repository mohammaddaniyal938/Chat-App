const router = require("express").Router();
const auth = require("../middleware/auth").authenticate;
const controller = require("../controllers/conversationController");
router.use(auth);
router.post("/", controller.createGroup);
module.exports = router;
