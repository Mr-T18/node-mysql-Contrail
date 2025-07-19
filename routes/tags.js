const express = require('express');
const router = express.Router();
const knex = require("../db/knex"); // knexのパスを適切に設定してください

// ユーザー認証チェックミドルウェア
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'ログインが必要です。');
  res.redirect('/signin');
}

// タグ管理ページを表示
router.get('/', ensureAuthenticated, async function(req, res, next) {
  const userId = req.user.id;
  try {
    const tags = await knex('tags')
      .where({ user_id: userId })
      .select('*')
      .orderBy('name', 'asc'); // タグ名をアルファベット順にソート

    res.render('tags_manage', {
      title: 'タグ管理',
      isAuth: req.isAuthenticated(),
      tags: tags,
      errorMessage: req.flash('error'), // フォームエラーやリダイレクト時のエラー
      successMessage: req.flash('success') // 成功メッセージを表示
    });
  } catch (err) {
    console.error('タグの取得中にエラーが発生しました:', err);
    req.flash('error', 'タグの読み込み中にエラーが発生しました。');
    res.redirect('/'); // エラー時はメインページへ
  }
});

// 新しいタグを追加
router.post('/', ensureAuthenticated, async function(req, res, next) {
  const userId = req.user.id;
  const tagName = req.body.tagName ? req.body.tagName.trim() : ''; // 前後の空白を削除
  const tagColor = req.body.tagColor || '#6c757d'; // デフォルト色

  if (!tagName) {
    req.flash('error', 'タグ名を入力してください。');
    return res.redirect('/tags');
  }

  try {
    // 同じユーザーが同じ名前のタグを既に持っているかチェック
    const existingTag = await knex('tags')
      .where({ user_id: userId, name: tagName })
      .first();

    if (existingTag) {
      req.flash('error', 'このタグ名は既に存在します。');
      return res.redirect('/tags');
    }

    await knex('tags').insert({
      user_id: userId,
      name: tagName,
      color: tagColor
    });
    req.flash('success', 'タグが正常に追加されました。');
    res.redirect('/tags');
  } catch (err) {
    console.error('タグの追加中にエラーが発生しました:', err);
    req.flash('error', `タグの追加中にエラーが発生しました: ${err.sqlMessage || err.message}`);
    res.redirect('/tags');
  }
});

// タグ編集フォームを表示
router.get('/edit/:id', ensureAuthenticated, async function(req, res, next) {
  const tagId = req.params.id;
  const userId = req.user.id;

  try {
    const tag = await knex('tags')
      .where({ id: tagId, user_id: userId })
      .first();

    if (!tag) {
      req.flash('error', 'タグが見つからないか、編集権限がありません。');
      return res.redirect('/tags');
    }

    res.render('tags_edit', { // 新しい tags_edit.ejs テンプレートをレンダリング
      title: 'タグ編集',
      isAuth: req.isAuthenticated(),
      tag: tag,
      errorMessage: req.flash('error'),
      successMessage: req.flash('success')
    });
  } catch (err) {
    console.error('タグ編集フォームの表示中にエラーが発生しました:', err);
    req.flash('error', 'タグ編集フォームの読み込み中にエラーが発生しました。');
    res.redirect('/tags');
  }
});

// タグを更新
router.post('/edit/:id', ensureAuthenticated, async function(req, res, next) {
  const tagId = req.params.id;
  const userId = req.user.id;
  const newTagName = req.body.tagName ? req.body.tagName.trim() : '';
  const newTagColor = req.body.tagColor || '#6c757d';

  if (!newTagName) {
    req.flash('error', 'タグ名を入力してください。');
    return res.redirect(`/tags/edit/${tagId}`);
  }

  try {
    // 同じユーザーが同じ名前のタグを既に持っているかチェック (自分自身を除く)
    const existingTag = await knex('tags')
      .where({ user_id: userId, name: newTagName })
      .whereNot({ id: tagId }) // 編集中のタグ自身は除く
      .first();

    if (existingTag) {
      req.flash('error', 'このタグ名は既に存在します。');
      return res.redirect(`/tags/edit/${tagId}`);
    }

    const count = await knex('tags')
      .where({ id: tagId, user_id: userId })
      .update({
        name: newTagName,
        color: newTagColor,
        updated_at: knex.fn.now() // 更新日時を自動更新
      });

    if (count === 0) {
      req.flash('error', 'タグが見つからないか、更新できませんでした。');
    } else {
      req.flash('success', 'タグが正常に更新されました。');
    }
    res.redirect('/tags');
  } catch (err) {
    console.error('タグの更新中にエラーが発生しました:', err);
    req.flash('error', `タグの更新中にエラーが発生しました: ${err.sqlMessage || err.message}`);
    res.redirect(`/tags/edit/${tagId}`);
  }
});

// タグを削除
router.post('/delete/:id', ensureAuthenticated, async function(req, res, next) {
  const tagId = req.params.id;
  const userId = req.user.id;

  try {
    // まず task_tags テーブルから関連付けを削除
    await knex('task_tags')
      .where({ tag_id: tagId })
      .del();

    // 次に tags テーブルからタグ自体を削除
    const count = await knex('tags')
      .where({ id: tagId, user_id: userId })
      .del();

    if (count === 0) {
      req.flash('error', 'タグが見つからないか、削除できませんでした。');
    } else {
      req.flash('success', 'タグが正常に削除されました。');
    }
    res.redirect('/tags');
  } catch (err) {
    console.error('タグの削除中にエラーが発生しました:', err);
    req.flash('error', `タグの削除中にエラーが発生しました: ${err.sqlMessage || err.message}`);
    res.redirect('/tags');
  }
});

module.exports = router;
