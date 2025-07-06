const express = require('express');
const router = express.Router();
const knex = require("../db/knex");
const bcrypt = require("bcrypt");

router.get('/', function (req, res, next) {
  const userId = req.session.userid;
  const isAuth = Boolean(userId);
  res.render("signin", {
    title: "Sign in",
    isAuth: isAuth, 
  });
});

router.post('/', function (req, res, next) {
  const username = req.body.username;
  const password = req.body.password;
  const userId = req.session.userid;
  const isAuth = Boolean(userId);

  knex("users")
    .where({
      name: username,
    })
    .select("*")
    .then(async function(results){
      if (results.length === 0) {
        res.render("signin", {
          title: "Sign in",
          isAuth: isAuth, 
          errorMessage: ["ユーザが見つかりません"],
        });
      } else if (await bcrypt.compare(password, results[0].password)){
        req.session.userid = results[0].id;
        req.session.name = results[0].name;
        res.redirect('/');
      }
    })
    .catch(function (err) {
      console.error(err);
      res.render("signin", {
        title: "Sign in",
        isAuth: isAuth,
        errorMessage: [err.sqlMessage],
      });
    });
});

module.exports = router;