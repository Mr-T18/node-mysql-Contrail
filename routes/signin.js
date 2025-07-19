const express = require('express');
const router = express.Router();
const passport = require('passport'); // Passport.jsをインポート

// GET /signin (サインインフォームの表示)
router.get('/', function(req, res, next) {
  res.render('signin', {
    title: 'サインイン',
    errorMessage: req.flash('error'), // flashメッセージを取得
    isAuth: req.isAuthenticated() // NEW: isAuth をテンプレートに渡す
  });
});

// POST /signin (サインイン処理)
router.post('/', passport.authenticate('local', {
  successRedirect: '/', // 認証成功時にリダイレクトするパス
  failureRedirect: '/signin', // 認証失敗時にリダイレクトするパス
  failureFlash: true // flashメッセージを有効にする
}));

module.exports = router;
