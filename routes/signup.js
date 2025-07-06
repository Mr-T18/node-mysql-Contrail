const express = require('express');
const knex = require("../db/knex");
const bcrypt = require("bcrypt");
const router = express.Router();

router.get('/', function (req, res, next) {
  const isAuth = req.isAuthenticated();
  res.render('signup', {
    title: 'Sign up',
    isAuth: isAuth,
  });
});

router.post('/', function (req, res, next) {
  const username = req.body.username;
  const password = req.body.password;
  const repassword = req.body.repassword;
  const isAuth = req.isAuthenticated();

  knex("users")
    .where({name: username})
    .select("*")
    .then(async function (result) {
      if (result.length !== 0) {
        res.render("signup", {
          title: "Sign up",
          isAuth: isAuth,
          errorMessage: ["このユーザ名は既に使われています"],
        }) 
      } else if (password === repassword) {
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword);
        knex("users")
          .insert({name: username, password: hashedPassword})
          .then(function () {
            res.redirect("/");
          })
          .catch(function (err) {
            console.error(err);
            res.render("signup", {
              title: "Sign up",
              isAuth: isAuth,
              errorMessage: [err.sqlMessage],
            });
          });
      } else {
        res.render("signup", {
          title: "Sign up",
          isAuth: isAuth,
          errorMessage: ["パスワードが一致しません"],
        });
      }
    })
    .catch(function (err) {
      console.error(err);
      res.render("signup", {
        title: "Sign up",
        isAuth: isAuth,
        errorMessage: [err.sqlMessage],
      });
    });
});

module.exports = router;