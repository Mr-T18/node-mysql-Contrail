const express = require('express');
const router = express.Router();
const knex = require("../db/knex");

// 日付フォーマット関数 (既存のまま)
function formatDateTime(dateTime, isOverdue = false) {
  if (!dateTime) return '';
  const date = new Date(dateTime);

  if (isOverdue) {
    return '期限切れ';
  }

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
    errorMessage: req.flash('error'), // flashメッセージを取得
    successMessage: req.flash('success'), // flashメッセージを取得
    todos: [], // todosも常に初期化
    allTags: [], // allTagsを常に初期化
    query: req.query // NEW: req.query を EJS に渡す
  };

  if (isAuth) {
    const userId = req.user.id;
    data.username = req.user.name;

    try {
      // 全てのタスクと関連するタグを取得
      let query = knex("tasks")
        .select(
          "tasks.*",
          knex.raw('GROUP_CONCAT(DISTINCT tags.id) as tag_ids'),
          knex.raw('GROUP_CONCAT(DISTINCT tags.name) as tag_names'),
          knex.raw('GROUP_CONCAT(DISTINCT tags.color) as tag_colors')
        )
        .leftJoin("task_tags", "tasks.id", "task_tags.task_id")
        .leftJoin("tags", "task_tags.tag_id", "tags.id")
        .where({ "tasks.user_id": userId })
        .whereNot({ "tasks.done": -1 })
        .groupBy("tasks.id"); // タスクごとにグループ化

      // タグによる絞り込み検索
      const filterTagId = req.query.tag;
      if (filterTagId) {
        query = query.whereExists(function() {
          this.select('*')
            .from('task_tags')
            .whereRaw('task_tags.task_id = tasks.id')
            .andWhere('task_tags.tag_id', filterTagId);
        });
      }

      const allTasks = await query;

      // タグ情報を整形
      allTasks.forEach(task => {
        task.tags = [];
        // tag_idsがnullの場合があるため、チェックを追加
        if (task.tag_ids && task.tag_ids.length > 0) {
          const ids = task.tag_ids.split(',');
          const names = task.tag_names.split(',');
          const colors = task.tag_colors.split(',');
          for (let i = 0; i < ids.length; i++) {
            task.tags.push({ id: parseInt(ids[i], 10), name: names[i], color: colors[i] });
          }
        }

        const now = new Date();
        if (task.duedatetime) {
          const dueDate = new Date(task.duedatetime);
          task.isOverdue = dueDate < now;
          task.isDueSoon = !task.isOverdue && (dueDate.getTime() - now.getTime() <= 24 * 60 * 60 * 1000);
          task.duedatetime_formatted = formatDateTime(task.duedatetime, task.isOverdue);
          task.duedatetime_input_format = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}T${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`;
        } else {
          task.isOverdue = false;
          task.isDueSoon = false;
          task.duedatetime_input_format = '';
        }
      });

      const incompleteTasks = allTasks.filter(task => task.done === 0)
        .sort((a, b) => {
          if (a.isOverdue && !b.isOverdue) return -1;
          if (!a.isOverdue && b.isOverdue) return 1;
          if (a.isDueSoon && !b.isDueSoon) return -1;
          if (!a.isDueSoon && b.isDueSoon) return 1;
          if (a.duedatetime && b.duedatetime) {
            return new Date(a.duedatetime).getTime() - new Date(b.duedatetime).getTime();
          }
          if (a.duedatetime && !b.duedatetime) return -1;
          if (!a.duedatetime && b.duedatetime) return 1;
          return 0;
        });

      const completedTasks = allTasks.filter(task => task.done === 1);
      data.todos = [...incompleteTasks, ...completedTasks];

      // 全てのタグを取得して、タグフィルターUIに渡す
      // 認証されている場合のみ、ユーザーのタグを取得
      data.allTags = await knex('tags')
        .where({ user_id: userId })
        .select('*')
        .orderBy('name', 'asc');

    } catch (err) {
      console.error('タスクまたはタグの取得中にエラーが発生しました:', err);
      data.todos = [];
      data.allTags = []; // エラー時も空の配列を保証
      data.errorMessage.push('データの読み込み中にエラーが発生しました。');
    }
  }
  res.render("index", data);
}

/* GET home page. */
router.get('/', async function(req, res, next) {
  await renderIndexPage(req, res);
});


// POST / (タスク追加)
router.post("/", async function(req, res, next) {
  const isAuth = req.isAuthenticated();
  if (!isAuth) {
    return res.redirect('/signin');
  }

  const userId = req.user.id;
  const todoContent = req.body.add;
  const duedatetime = req.body.duedatetime || null;
  const description = req.body.description || null;
  const selectedTagIdsString = req.body.tags || ''; // hidden inputから文字列として取得

  let selectedTagIds = [];
  if (selectedTagIdsString) {
    // カンマ区切りの文字列を数値の配列に変換
    selectedTagIds = selectedTagIdsString.split(',').map(id => parseInt(id.trim(), 10));
  }

  if (!todoContent) {
    req.flash('error', 'タスク内容を入力してください。');
    return res.redirect('/');
  }

  try {
    const [taskId] = await knex("tasks")
      .insert({
        "user_id": userId,
        "content": todoContent,
        "duedatetime": duedatetime,
        "description": description,
        "done": 0
      });

    // タグの関連付けを保存
    if (selectedTagIds.length > 0) {
      const taskTagsToInsert = selectedTagIds.map(tagId => ({
        task_id: taskId,
        tag_id: tagId
      }));
      await knex('task_tags').insert(taskTagsToInsert);
    }

    req.flash('success', 'タスクが正常に追加されました。');
    res.redirect("/");
  } catch (err) {
    console.error('タスクの追加中にエラーが発生しました:', err);
    req.flash('error', `タスクの追加中にエラーが発生しました: ${err.sqlMessage || err.message}`);
    res.redirect('/');
  }
});

/* POST: タスクを完了する (既存のまま) */
router.post('/tasks/complete/:id', async function(req, res, next) {
  const isAuth = req.isAuthenticated();
  if (!isAuth) {
    return res.redirect('/signin');
  }

  const taskId = req.params.id;
  const userId = req.user.id;

  try {
    const count = await knex('tasks')
      .where({ id: taskId, user_id: userId })
      .update({ done: 1 });

    if (count === 0) {
      req.flash('error', 'タスクが見つからないか、完了できませんでした。');
    } else {
      req.flash('success', 'タスクを完了しました。');
    }
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.flash('error', `タスクの完了中にエラーが発生しました: ${err.sqlMessage || err.message}`);
    res.redirect('/');
  }
});

/* POST: タスクを未完了に戻す (Revert) (既存のまま) */
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
      .update({ done: 0 });

    if (count === 0) {
      req.flash('error', 'タスクが見つからないか、未完了に戻せませんでした。');
    } else {
      req.flash('success', 'タスクを未完了に戻しました。');
    }
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.flash('error', `タスクの復元中にエラーが発生しました: ${err.sqlMessage || err.message}`);
    res.redirect('/');
  }
});


/* POST: タスクを削除する (既存のまま) */
router.post('/tasks/delete/:id', async function(req, res, next) {
  const isAuth = req.isAuthenticated();
  if (!isAuth) {
    return res.redirect('/signin');
  }

  const taskId = req.params.id;
  const userId = req.user.id;

  try {
    const count = await knex('tasks')
      .where({ id: taskId, user_id: userId })
      .update({ done: -1 });

    if (count === 0) {
      req.flash('error', 'タスクが見つからないか、削除できませんでした。');
    } else {
      req.flash('success', 'タスクを削除しました。');
    }
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.flash('error', `タスクの削除中にエラーが発生しました: ${err.sqlMessage || err.message}`);
    res.redirect('/');
  }
});

// --- タスク編集機能の追加 (タグ対応) ---

/* GET: タスク編集フォームの表示 */
router.get('/tasks/edit/:id', async function(req, res, next) {
  const isAuth = req.isAuthenticated();
  if (!isAuth) {
    return res.redirect('/signin');
  }

  const taskId = req.params.id;
  const userId = req.user.id;

  try {
    // タスクと関連するタグを取得
    const task = await knex('tasks')
      .select(
        "tasks.*",
        knex.raw('GROUP_CONCAT(DISTINCT tags.id) as tag_ids'),
        knex.raw('GROUP_CONCAT(DISTINCT tags.name) as tag_names'),
        knex.raw('GROUP_CONCAT(DISTINCT tags.color) as tag_colors')
      )
      .leftJoin("task_tags", "tasks.id", "task_tags.task_id")
      .leftJoin("tags", "task_tags.tag_id", "tags.id")
      .where({ "tasks.id": taskId, "tasks.user_id": userId })
      .groupBy("tasks.id")
      .first();

    if (!task) {
      req.flash('error', `タスクID ${taskId} が見つからないか、アクセス権がありません。`);
      return res.redirect('/');
    }

    // タグ情報を整形
    task.tags = [];
    task.selectedTagIds = []; // 選択済みのタグIDを保持する配列
    // tag_idsがnullの場合があるため、チェックを追加
    if (task.tag_ids && task.tag_ids.length > 0) {
      const ids = task.tag_ids.split(',');
      const names = task.tag_names.split(',');
      const colors = task.tag_colors.split(',');
      for (let i = 0; i < ids.length; i++) {
        task.tags.push({ id: parseInt(ids[i], 10), name: names[i], color: colors[i] });
        task.selectedTagIds.push(parseInt(ids[i], 10)); // 数値として保存
      }
    }

    // datetime-local入力フィールド用に日付をフォーマット
    let duedatetimeInputFormat = '';
    if (task.duedatetime) {
      const dueDate = new Date(task.duedatetime);
      duedatetimeInputFormat = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}T${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`;
    }
    task.duedatetime_input_format = duedatetimeInputFormat;

    // 全てのタグを取得して、タグ選択UIに渡す
    const allTags = await knex('tags')
      .where({ user_id: userId })
      .select('*')
      .orderBy('name', 'asc');

    res.render('edit', {
      title: 'タスク編集',
      isAuth: isAuth,
      task: task,
      allTags: allTags, // 全てのタグを渡す
      errorMessage: req.flash('error')
    });

  } catch (err) {
    console.error('タスク編集フォームの表示中にエラーが発生しました:', err);
    req.flash('error', `タスク編集フォームの読み込み中にエラーが発生しました: ${err.sqlMessage || err.message}`);
    res.redirect('/');
  }
});

/* POST: タスクの更新処理 */
router.post('/tasks/edit/:id', async function(req, res, next) {
  const isAuth = req.isAuthenticated();
  if (!isAuth) {
    return res.redirect('/signin');
  }

  const taskId = req.params.id;
  const userId = req.user.id;
  const content = req.body.content;
  const duedatetime = req.body.duedatetime || null;
  const description = req.body.description || null;
  const selectedTagIdsString = req.body.tags || ''; // hidden inputから文字列として取得

  let selectedTagIds = [];
  if (selectedTagIdsString) {
    // カンマ区切りの文字列を数値の配列に変換
    selectedTagIds = selectedTagIdsString.split(',').map(id => parseInt(id.trim(), 10));
  }

  if (!content) {
    req.flash('error', 'タスク内容を入力してください。');
    return res.redirect(`/tasks/edit/${taskId}`); // エラー時は編集ページにリダイレクト
  }

  try {
    // タスクの基本情報を更新
    const count = await knex('tasks')
      .where({ id: taskId, user_id: userId })
      .update({
        content: content,
        duedatetime: duedatetime,
        description: description,
        updated_at: knex.fn.now() // 更新日時を自動更新
      });

    if (count === 0) {
      req.flash('error', `タスクID ${taskId} が見つからないか、更新できませんでした。`);
      return res.redirect(`/tasks/edit/${taskId}`);
    }

    // 既存のタグ関連付けを削除
    await knex('task_tags')
      .where({ task_id: taskId })
      .del();

    // 新しいタグ関連付けを保存
    if (selectedTagIds.length > 0) {
      const taskTagsToInsert = selectedTagIds.map(tagId => ({
        task_id: taskId,
        tag_id: tagId
      }));
      await knex('task_tags').insert(taskTagsToInsert);
    }

    req.flash('success', 'タスクが正常に更新されました。');
    res.redirect('/'); // 更新後、一覧ページへリダイレクト

  } catch (err) {
    console.error('タスクの更新中にエラーが発生しました:', err);
    req.flash('error', `タスクの更新中にエラーが発生しました: ${err.sqlMessage || err.message}`);
    res.redirect(`/tasks/edit/${taskId}`); // エラー時は編集ページにリダイレクト
  }
});

// --- タスク編集機能の追加 終わり ---


// 各ルーターファイルをインポートして使用する
router.use('/signup', require('./signup'));
router.use('/signin', require('./signin'));
router.use('/logout', require("./logout"));
router.use('/tags', require('./tags')); // NEW: タグ管理ルーターを追加

module.exports = router;
