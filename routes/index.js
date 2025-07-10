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

function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}年${m}月${d}日（${w}） ${hh}:${mm}`;
}

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
        results.forEach(task => {
          if (task.duedatetime) {
            task.duedatetime_formatted = formatDateTime(task.duedatetime);
          }
        });
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
  const duedatetime = req.body.duedatetime;
  const description = req.body.description;

  knex("tasks")
    .insert({
      "user_id": userId, 
      "content": todo, 
      "duedatetime":duedatetime,
      "description": description
    })
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

/*
追加したい機能
・日付設定機能
・タスクの説明
・タグの設定
*/