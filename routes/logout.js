const express = require('express');
const router = express.Router();

// GET /logout (ログアウト処理)
router.get('/', function(req, res, next) {
  req.logout(function(err) { // Passport.jsのreq.logout()を使用
    if (err) {
      console.error('ログアウト中にエラーが発生しました:', err);
      req.flash('error', 'ログアウト中にエラーが発生しました。');
      return next(err);
    }
    req.flash('success', 'ログアウトしました。');
    res.redirect('/signin'); // ログアウト後にサインインページへリダイレクト
  });
});

module.exports = router;
