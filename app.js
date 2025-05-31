var dotenv = require("dotenv").config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var culturaRouter = require('./routes/cultura');
var analiseRouter = require('./routes/analise');
var models = require('./models/index');

const expressLayouts = require('express-ejs-layouts');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout'); 


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use('/cultura', culturaRouter);
app.use('/analise', analiseRouter);

app.get('/', (req, res) => {
  res.render('index', {});
});

app.use(function (req, res, next) {
  next(createError(404));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).render('error', {
      message: err.message || 'Ocorreu um erro inesperado',
      error: { status: err.status || 500 }
  });
});

module.exports = app;
