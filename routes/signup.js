const express = require('express');
const knex = require("../db/knex");
const bcrypt = require("bcrypt");
const router = express.Router();
const passport = require('passport'); // req.login() を使用するためにPassport.jsをインポート

router.get('/', function (req, res, next) {
  const isAuth = req.isAuthenticated();
  res.render('signup', {
    title: 'Sign up',
    isAuth: isAuth,
    errorMessage: [], // エラーメッセージを初期化
  });
});

router.post('/', async function (req, res, next) {
  const username = req.body.username;
  const password = req.body.password;
  const repassword = req.body.repassword;
  const isAuth = req.isAuthenticated(); // この変数はここでは直接使用しませんが、残しておきます

  // パスワードの一致を確認
  if (password !== repassword) {
    console.error('パスワードが一致しません。');
    return res.render("signup", {
      title: "Sign up",
      isAuth: isAuth,
      errorMessage: ["パスワードが一致しません"],
    });
  }

  try {
    // ユーザーが既に存在するか確認
    const existingUser = await knex("users")
      .where({ name: username })
      .select("*")
      .first(); // .first() を使用して単一の結果を取得

    if (existingUser) {
      console.error('このユーザー名は既に使われています。');
      return res.render("signup", {
        title: "Sign up",
        isAuth: isAuth,
        errorMessage: ["このユーザ名は既に使われています"],
      });
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Hashed Password:", hashedPassword); // デバッグ用ログ

    // ユーザーをデータベースに挿入
    await knex("users")
      .insert({ name: username, password: hashedPassword });

    // 新しく挿入されたユーザー情報を取得
    // req.login() がセッションにユーザー情報をシリアライズするために必要
    const newUser = await knex("users")
      .where({ name: username })
      .select("*")
      .first();

    if (newUser) {
      // Passport.jsのreq.login()を使用してユーザーをログイン状態にする
      req.login(newUser, function(err) {
        if (err) {
          console.error('サインアップ後の自動ログイン中にエラーが発生しました:', err);
          // ログインエラー時はサインインページへリダイレクト
          return res.redirect('/signin');
        }
        // ログイン成功したらメインページへリダイレクト
        res.redirect('/');
      });
    } else {
      // ユーザーの取得に失敗した場合
      console.error('サインアップ後に新規ユーザーの取得に失敗しました。');
      res.render("signup", {
        title: "Sign up",
        isAuth: isAuth,
        errorMessage: ["サインアップ後にユーザーの取得に失敗しました。"],
      });
    }

  } catch (err) {
    console.error("サインアップ中にエラーが発生しました:", err);
    res.render("signup", {
      title: "Sign up",
      isAuth: isAuth,
      errorMessage: [err.sqlMessage || "サインアップ中に予期せぬエラーが発生しました。"],
    });
  }
});

module.exports = router;
