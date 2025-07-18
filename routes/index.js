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

// 日付フォーマット関数
// 期限切れの場合は「期限切れ」と表示するように修正
function formatDateTime(dateTime, isOverdue = false) {
  if (!dateTime) return '';
  const date = new Date(dateTime);

  if (isOverdue) {
    return '期限切れ';
  }

  // YYYY年M月D日（W） HH:MM 形式にフォーマット
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}年${m}月${d}日（${w}） ${hh}:${mm}`;
}

/**
 * indexページをレンダリングするためのヘルパー関数
 * @param {object} req - Expressのリクエストオブジェクト
 * @param {object} res - Expressのレスポンスオブジェクト
 */
async function renderIndexPage(req, res) {
  const isAuth = req.isAuthenticated();
  const data = {
    title: "ToDo App",
    isAuth: isAuth,
    errorMessage: [],
    successMessage: []
  };

  if (isAuth) {
    const userId = req.user.id;
    data.username = req.user.name;

    try {
      // doneが-1（削除済み）ではないタスクを全て取得
      const allTasks = await knex("tasks")
        .select("*")
        .where({ user_id: userId })
        .whereNot({ done: -1 });

      const now = new Date(); // 現在時刻

      // 各タスクに期限の状態フラグを追加
      allTasks.forEach(task => {
        if (task.duedatetime) {
          const dueDate = new Date(task.duedatetime);
          task.isOverdue = dueDate < now; // 期限切れかどうか
          task.isDueSoon = !task.isOverdue && (dueDate.getTime() - now.getTime() <= 24 * 60 * 60 * 1000); // 期限が24時間以内かどうか

          // フォーマットされた日付文字列を生成 (期限切れの場合は特別な表示)
          task.duedatetime_formatted = formatDateTime(task.duedatetime, task.isOverdue);
        } else {
          task.isOverdue = false;
          task.isDueSoon = false;
        }
      });

      // 未完了タスク (done: 0) と完了タスク (done: 1) に分ける
      // さらに、未完了タスクは isDueSoon, isOverdue, duedatetime でソート
      const incompleteTasks = allTasks.filter(task => task.done === 0)
        .sort((a, b) => {
          // 1. 期限切れのタスクを優先 (上に来るように)
          if (a.isOverdue && !b.isOverdue) return -1;
          if (!a.isOverdue && b.isOverdue) return 1;

          // 2. 期限が近いタスクを優先
          if (a.isDueSoon && !b.isDueSoon) return -1;
          if (!a.isDueSoon && b.isDueSoon) return 1;

          // 3. 期限日でソート (昇順)
          if (a.duedatetime && b.duedatetime) {
            return new Date(a.duedatetime).getTime() - new Date(b.duedatetime).getTime();
          }
          // 期限がないタスクは最後に
          if (a.duedatetime && !b.duedatetime) return -1;
          if (!a.duedatetime && b.duedatetime) return 1;
          return 0;
        });

      const completedTasks = allTasks.filter(task => task.done === 1);

      // 未完了タスクの後に完了タスクを結合して、todosに渡す
      data.todos = [...incompleteTasks, ...completedTasks];

    } catch (err) {
      console.error(err);
      data.todos = []; // エラー時は空の配列
    }
  }
  res.render("index", data);
}

/* GET home page. */
router.get('/', async function(req, res, next) {
  await renderIndexPage(req, res);
});


router.post("/", function(req,res,next) {
  const isAuth = req.isAuthenticated();
  const userId = req.user.id;
  const todo = req.body.add;
  const duedatetime = req.body.duedatetime || null; // 期限がない場合はnull
  const description = req.body.description || null; // 説明がない場合はnull

  knex("tasks")
    .insert({
      "user_id": userId, 
      "content": todo, 
      "duedatetime":duedatetime,
      "description": description,
      "done": 0 // 新しいタスクは未完了として追加
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

/* POST: タスクを完了する */
router.post('/tasks/complete/:id', async function(req, res, next) {
  const isAuth = req.isAuthenticated();
  if (!isAuth) {
    return res.redirect('/signin');
  }

  const taskId = req.params.id;
  const userId = req.user.id;

  try {
    const count = await knex('tasks')
      .where({ id: taskId, user_id: userId }) // ユーザーIDも条件に含めることで、他のユーザーのタスクを操作できないようにする
      .update({ done: 1 }); // doneを1（完了）に設定

    if (count === 0) {
      console.error('タスクが見つからないか、完了できませんでした。');
    }
    // 完了後、ルートパスにリダイレクト
    res.redirect('/');
  } catch (err) {
    console.error(err);
    // エラーが発生したらルートパスにリダイレクト
    res.redirect('/');
  }
});

/* POST: タスクを未完了に戻す (Revert) */
router.post('/tasks/revert/:id', async function(req, res, next) {
  const isAuth = req.isAuthenticated();
  if (!isAuth) {
    return res.redirect('/signin');
  }

  const taskId = req.params.id;
  const userId = req.user.id;

  try {
    const count = await knex('tasks')
      .where({ id: taskId, user_id: userId })
      .update({ done: 0 }); // doneを0（未完了）に戻す

    if (count === 0) {
      console.error('タスクが見つからないか、未完了に戻せませんでした。');
    }
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});


/* POST: タスクを削除する */
router.post('/tasks/delete/:id', async function(req, res, next) {
  const isAuth = req.isAuthenticated();
  if (!isAuth) {
    return res.redirect('/signin');
  }

  const taskId = req.params.id;
  const userId = req.user.id;

  try {
    const count = await knex('tasks')
      .where({ id: taskId, user_id: userId }) // ユーザーIDも条件に含めることで、他のユーザーのタスクを操作できないようにする
      .update({ done: -1 }); // doneを-1（削除済み）に設定

    if (count === 0) {
      console.error('タスクが見つからないか、削除できませんでした。');
    }
    // 削除後、ルートパスにリダイレクト
    res.redirect('/');
  } catch (err) {
    console.error(err);
    // エラーが発生したらルートパスにリダイレクト
    res.redirect('/');
  }
});


router.use('/signup', require('./signup'));
router.use('/signin', require('./signin'));
router.use('/logout', require("./logout"));

module.exports = router;
