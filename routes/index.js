const express = require('express');
const router = express.Router();
const knex = require("../db/knex");
const mysql = require("mysql");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "todo_app"
});


/* GET home page. */
router.get('/', function(req, res, next) {
  const userId = req.session.userid;
  const userName = req.session.name;
  const isAuth = Boolean(userId);
  console.log(`isAuth: ${isAuth}`);
  
  knex("tasks")
    .select("*")
    .where("user_id", userId)
    .then(function (results){
      console.log(results);
      res.render("index", {
        title: "ToDo App", 
        todos: results, 
        isAuth: isAuth,
        user_name: userName, 
      });
    })
    .catch(function (err) {
      console.error(err);
      res.render("index", {
        title: "ToDo App",
        isAuth: isAuth,
      });
    });
});


router.post("/", function(req,res,next) {
  const userId = req.session.userid;
  const isAuth = Boolean(userId);
  const todo = req.body.add;

  knex("tasks")
    .insert({"user_id": userId, "content": todo})
    .then(function(){
      res.redirect("/");
    })
    .catch(function(err){
      console.error(err);
      res.render("index", {
        title: "ToDo App",
        isAuth: isAuth,
      });
    });
})

router.use('/signup', require('./signup'));
router.use('/signin', require('./signin'));
router.use('/logout', require("./logout"));

module.exports = router;
