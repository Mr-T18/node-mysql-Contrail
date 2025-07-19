const express = require('express');
const knex = require("../db/knex");
const bcrypt = require("bcrypt"); // bcrypt をインポート
const router = express.Router();
const passport = require('passport'); // req.login() を使用するためにPassport.jsをインポート

router.get('/', function (req, res, next) {
  const isAuth = req.isAuthenticated();
  res.render('signup', {
    title: 'サインアップ',
    isAuth: isAuth,
    errorMessage: req.flash('error'), // flashメッセージを取得
  });
});

router.post('/', async function (req, res, next) {
  const username = req.body.username ? req.body.username.trim() : ''; // 前後の空白を削除
  const password = req.body.password;
  const repassword = req.body.repassword;

  // 入力チェック
  if (!username || !password || !repassword) {
    req.flash('error', 'すべてのフィールドを入力してください。');
    return res.redirect('/signup');
  }

  // パスワードの一致を確認
  if (password !== repassword) {
    req.flash('error', 'パスワードが一致しません。');
    return res.redirect('/signup');
  }

  try {
    // ユーザーが既に存在するか確認
    const existingUser = await knex("users")
      .where({name: username})
      .select("*")
      .first();

    if (existingUser) {
      req.flash('error', 'このユーザ名は既に使われています。');
      return res.redirect('/signup');
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);
    // console.log("Hashed Password:", hashedPassword); // デバッグ用ログ (本番では削除推奨)

    // ユーザーをデータベースに挿入
    await knex("users")
      .insert({name: username, password: hashedPassword});

    // 新しく挿入されたユーザー情報を取得
    // req.login() がセッションにユーザー情報をシリアライズするために必要
    const newUser = await knex("users")
      .where({name: username})
      .select("*")
      .first();

    if (newUser) {
      // Passport.jsのreq.login()を使用してユーザーをログイン状態にする
      req.login(newUser, function(err) {
        if (err) {
          console.error('サインアップ後の自動ログイン中にエラーが発生しました:', err);
          req.flash('error', 'サインアップ後の自動ログイン中にエラーが発生しました。');
          return res.redirect('/signin');
        }
        // ログイン成功したらメインページへリダイレクト
        req.flash('success', 'サインアップが完了し、ログインしました！');
        res.redirect('/');
      });
    } else {
      // ユーザーの取得に失敗した場合
      console.error('サインアップ後に新規ユーザーの取得に失敗しました。');
      req.flash('error', 'サインアップ後にユーザーの取得に失敗しました。');
      res.redirect('/signup');
    }

  } catch (err) {
    console.error("サインアップ中にエラーが発生しました:", err);
    req.flash('error', `サインアップ中にエラーが発生しました: ${err.sqlMessage || err.message}`);
    res.redirect('/signup');
  }
});

module.exports = router;
