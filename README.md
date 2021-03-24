@[TOC](webpack构建原理)

# 什么是 webpack ?

> 本质上,webpack 是一个现代 JavaScript 应用程序的静态模块打包器(module bundler)。 当 webpack 处理应用程序时,它会递归地构建一个依赖关系图(dependency graph),其中包含应用程序需要的每个模块,然后将所有这些模块打包成一个或多个 bundle。

webpack 就像一条生产线,要经过一系列处理流程后才能将源文件转换成输出结果。 这条生产线上的每个处理流程的职责都是单一的,多个流程之间有存在依赖关系,只有完成当前处理后才能交给下一个流程去处理。 插件就像是一个插入到生产线中的一个功能,在特定的时机对生产线上的资源做处理。webpack 通过 Tapable 来组织这条复杂的生产线。 > > webpack 在运行过程中会广播事件,插件只需要监听它所关心的事件,就能加入到这条生产线中,去改变生产线的运作。 webpack 的事件流机制保证了插件的有序性,使得整个系统扩展性很好。 ---- 深入浅出 webpack 吴浩麟

# webpack 核心概念

## Entry -- 入口起点(entry point)

指示 webpack 应该使用哪个模块，来作为构建其内部依赖图的开始。

进入入口起点后，webpack 会找出有哪些模块和库是入口点 (直接和间接) 依赖。

每个依赖项随即被处理，最后输出到 bundles 的文件中。

## Output -- 文件输出

output 属性告诉 webpack 再哪里输出它创建的 bundles，以及如何命名这些文件，默认值为 ./dist。

## Module -- 模块

在 webpack 里一切皆模块，一个模块对应着一个文件。webpack 会从配置的 entry 开始递归找出所有依赖的模块。

## Chunk -- 代码块

一个 chunk 由多个模块组合而成，用于代码合并和分隔。

## Loader -- 转换器

loader 让 webpack 能够去处理非 javaScript 文件(webpack 自身值能理解 javaScript)。

loader 可以将所有类型的文件转换为 webpack 可以处理的有效模块，然后就可以利用 webpack 的打包能力，对它们进行处理。

本质上, webpack loader 将所有类型的文件，转换为应用程序的依赖图(和最终的 bundle) 可以直接引用的模块。

## Plugin -- 插件

loader 被用于转换默写类型的模块，而插件可以用于执行范围更广的任务。

插件的范围包括，从打包优化到压缩，一直到重新定义环境中的变量。插件接口功能极其强大，可以用来处理各种各样的任务。

# webpack 构建流程

Webpack 的运行流程是一个串行的过程,从启动到结束会依次执行以下流程 :

1. 初始化参数：从配置文件和 Shell 语句中读取与合并参数,得出最终的参数。
2. 开始编译：用上一步得到的参数初始化 Compiler 对象,加载所有配置的插件,执行对象的 run 方法开始执行编译。
3. 确定入口：根据配置中的 entry 找出所有的入口文件。
4. 编译模块：从入口文件出发,调用所有配置的 Loader 对模块进行翻译,再找出该模块依赖的模块,再递归本步骤直到所有入口依赖的文件都经过了本步骤的处理。
5. 完成模块编译：在经过第 4 步使用 Loader 翻译完所有模块后,得到了每个模块被翻译后的最终内容以及它们之间的依赖关系。
6. 输出资源：根据入口和模块之间的依赖关系,组装成一个个包含多个模块的 Chunk,再把每个 Chunk 转换成一个单独的文件加入到输出列表,这步是可以修改输出内容的最后机会。
7. 输出完成：在确定好输出内容后,根据配置确定输出的路径和文件名,把文件内容写入到文件系统。

## 手撸 webpack

```javascript
const fs = require('fs'); // 引入node文件模块
const path = require('path');
const parser = require('@babel/parser'); // 将文件内容转为AST抽象语法树
const options = require('./webpack.config');
const traverse = require('@babel/traverse').default;
const { transformFromAst } = require('@babel/core');

const Parser = {
  // 转换ast抽象语法树
  getAst: (path) => {
    // 读取入口文件
    const content = fs.readFileSync(path, 'utf-8'); // 将文件内容转为AST抽象语法树
    return parser.parse(content, { sourceType: 'module' });
  },
  // 生成依赖关系
  getDependencies: (ast, filename) => {
    const dependencies = {};
    // 遍历所有的 import 模块,存入dependencies
    traverse(ast, {
      // 类型为 ImportDeclaration 的 AST 节点 (即为import 语句)
      ImportDeclaration({ node }) {
        const dirname = path.dirname(filename);
        // 保存依赖模块路径,之后生成依赖关系图需要用到
        const filepath = './' + path.join(dirname, node.source.value);
        dependencies[node.source.value] = filepath;
      }
    });
    return dependencies;
  },
  // AST转换为code
  getCode: (ast) => {
    const { code } = transformFromAst(ast, null, {
      presets: ['@babel/preset-env']
    });
    return code;
  }
};

class Compiler {
  constructor(options) {
    // webpack 配置
    const { entry, output } = options;
    this.entry = entry; // 入口
    this.output = output; // 出口
    this.modules = []; // 模块
  }

  // 构建启动
  run() {
    // 解析入口文件
    const info = this.build(this.entry);
    this.modules.push(info);
    for (let index = 0; index < this.modules.length; index++) {
      // 判断有依赖对象,递归解析所有依赖项
      console.log(this.modules);
      const dependencies = this.modules[index].dependencies;
      if (dependencies) {
        for (const dependency in dependencies) {
          this.modules.push(this.build(dependencies[dependency]));
        }
      }
    }
    // 生成依赖关系图
    const dependencyGraph = this.modules.reduce(
      (graph, item) => ({
        ...graph,
        // 使用文件路径作为每个模块的唯一标识符,保存对应模块的依赖对象和文件内容
        [item.filename]: { dependencies: item.dependencies, code: item.code }
      }),
      {}
    );
    this.generate(dependencyGraph);
  }
  // 返回模块信息
  build(filename) {
    const { getAst, getDependencies, getCode } = Parser;
    const ast = getAst(filename);
    const dependencies = getDependencies(ast, filename);
    const code = getCode(ast);
    return {
      // 文件路径,可以作为每个模块的唯一标识符
      filename,
      // 依赖对象,保存着依赖模块路径
      dependencies: dependencies,
      // 文件内容
      code
    };
  }
  // 重写 require函数,输出bundle
  generate(code) {
    // 输出文件路径
    const filePath = path.join(this.output.path, this.output.filename);
    const bundle = `(function(graph){    
                      function require(module){       
                        function localRequire(relativePath){        
                          return require(graph[module].dependencies[relativePath]) 
                        }      
                        var exports = {};    
                        (function(require,exports,code){       
                          eval(code)      
                        })(localRequire,exports,graph[module].code);   
                        return exports; 
                      }  
                      require('${this.entry}')  
                    })(${JSON.stringify(code)})`;
    // 把文件内容写入到文件系统
    fs.writeFileSync(filePath, bundle, 'utf-8');
  }
}

new Compiler(options).run();
```

## 通过 bundle 实例，读懂代码

```javascript
// 定义一个立即执行函数,传入生成的依赖关系图
(function (graph) {
  // 重写require函数
  function require(moduleId) {
    // 找到对应moduleId的依赖对象,调用require函数,eval执行,拿到exports对象
    function localRequire(relativePath) {
      return require(graph[moduleId].dependecies[relativePath]); // {__esModule: true, say: ƒ say(name)}
    } // 定义exports对象
    var exports = {};
    (function (require, exports, code) {
      // commonjs语法使用module.exports暴露实现,我们传入的exports对象会捕获依赖对象(hello.js)暴露的实现(exports.say = say)并写入
      eval(code);
    })(localRequire, exports, graph[moduleId].code); // 暴露exports对象,即暴露依赖对象对应的实现
    return exports;
  }
  debugger;
  // 从入口文件开始执行
  require('./src/index.js');
})({
  './src/index.js': {
    dependecies: { './hello.js': './src/hello.js' },
    code:
      '"use strict";\n\nvar _hello = require("./hello.js");\n\ndocument.write((0, _hello.say)("webpack"));'
  },
  './src/hello.js': {
    dependecies: {},
    code:
      '"use strict";\n\nObject.defineProperty(exports, "__esModule", {\n  value: true\n});\nexports.say = say;\n\nfunction say(name) {\n  return "hello ".concat(name);\n}'
  }
});
```
# 相关链接
原文链接：[webpack打包原理 ? 看完这篇你就懂了 !](https://juejin.cn/post/6844904038543130637?utm_source=gold_browser_extension?utm_source=gold_browser_extension)

github:[代码地址](https://github.com/Zaoei/webpack-principle)