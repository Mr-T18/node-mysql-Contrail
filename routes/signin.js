const express = require('express');
const router = express.Router();
const passport = require("passport");
const flash = require('connect-flash');

router.get('/', function (req, res, next) {
  const isAuth = req.isAuthenticated();
  res.render("signin", {
    title: "Sign in",
    isAuth: isAuth,
  });
});

router.post('/', passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/signin",
  // failureFlash: true, // <- これなんか動かないんすよね（笑）
}));

module.exports = router;