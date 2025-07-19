var createError = require('http-errors'); // http-errors をインポート
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session'); // express-session をインポート
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var knex = require('./db/knex');
var flash = require('connect-flash'); // connect-flash をインポート
var bcrypt = require('bcrypt'); // bcrypt をインポート

// ルーターファイルのインポート
var indexRouter = require('./routes/index');
var tagsRouter = require('./routes/tags'); // tags ルーターをインポート

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// セッションミドルウェアの設定（Passport.jsより前に配置）
app.use(session({
  secret: 'your_secret_key_for_session', // 任意の秘密鍵を設定してください (本番環境ではより複雑なものに)
  resave: false,
  saveUninitialized: false
}));

app.use(flash()); // connect-flash をセッションの後に初期化

// Passport.jsの初期化
app.use(passport.initialize());
app.use(passport.session());

// Passport.jsのLocalStrategy設定
passport.use(new LocalStrategy(
  function(username, password, done) {
    knex('users').where({ name: username }).first()
      .then(user => {
        if (!user) { return done(null, false, { message: 'ユーザー名が正しくありません。' }); }
        // パスワードの比較 (bcrypt.compareを使用)
        bcrypt.compare(password, user.password, function(err, result) {
          if (err) { return done(err); }
          if (!result) { return done(null, false, { message: 'パスワードが正しくありません。' }); }
          return done(null, user);
        });
      })
      .catch(err => done(err));
  }
));

// ユーザーオブジェクトのシリアライズ/デシリアライズ
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  knex('users').where({ id: id }).first()
    .then(user => {
      done(null, user);
    })
    .catch(err => done(err));
});


// ルーターの使用
app.use('/', indexRouter);
app.use('/tags', tagsRouter); // /tags パスに tagsRouter を適用


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404)); // http-errors を使用して404エラーを生成
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page (error_messages.ejs を使用)
  res.status(err.status || 500);
  res.render('error_messages', {
    title: 'エラーが発生しました',
    isAuth: req.isAuthenticated(),
    errorMessage: [err.message], // エラーメッセージを配列として渡す
    message: err.message, // 汎用的なエラーメッセージ (error_messages.ejsで表示)
    error: res.locals.error // 開発環境での詳細エラー (error_messages.ejsで表示)
  });
});

module.exports = app;
