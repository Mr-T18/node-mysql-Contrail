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
  const isAuth = req.isAuthenticated();
  console.log(`isAuth: ${isAuth}`);
  if(isAuth){
    const userId = req.user.id;
    const userName = req.user.name;
    knex("tasks")
      .select("*")
      .where({user_id: userId})
      .then(function (results){
        console.log(results);
        res.render("index", {
          title: "ToDo App", 
          todos: results, 
          isAuth: isAuth,
          username: userName, 
        });
      })
      .catch(function (err) {
        console.error(err);
        res.render("index", {
          title: "ToDo App",
          isAuth: isAuth,
          errorMessage: [err.sqlMessage],
        });
      });
  }else{
    res.render('index', {
      title: 'ToDo App',
      isAuth: isAuth,
    });
  }
});


router.post("/", function(req,res,next) {
  const isAuth = req.isAuthenticated();
  const userId = req.user.id;
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
        errorMessage: [err.sqlMessage],
      });
    });
})

router.use('/signup', require('./signup'));
router.use('/signin', require('./signin'));
router.use('/logout', require("./logout"));

module.exports = router;
