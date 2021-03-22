// 用@babel/parser,这是 babel7 的工具,来帮助我们分析内部的语法,包括 es6,返回一个 AST 抽象语法树
const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: { path: path.resolve(__dirname, './dist'), filename: 'main.js' }
};
