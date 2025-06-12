const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'ToDo App' });
});

router.post("/", function(req,res,next) {
  res.render("index", {title: "ToDo App"});
})

module.exports = router;
