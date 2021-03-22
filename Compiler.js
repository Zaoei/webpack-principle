const fs = require('fs');
const parser = require('@babel/parser');
const options = require('./webpack.config');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { transformFromAst } = require('@babel/core');

const Parser = {
  getAst: (path) => {
    // 读取入口文件
    const content = fs.readFileSync(path, 'utf-8'); // 将文件内容转为AST抽象语法树
    return parser.parse(content, { sourceType: 'module' });
  },
  getDependencies: (ast, filename) => {
    const dependencies = {}; // 遍历所有的 import 模块,存入dependecies
    traverse(ast, {
      // 类型为 ImportDeclaration 的 AST 节点 (即为import 语句)
      ImportDeclaration({ node }) {
        const dirname = path.dirname(filename); // 保存依赖模块路径,之后生成依赖关系图需要用到
        const filepath = './' + path.join(dirname, node.source.value);
        dependencies[node.source.value] = filepath;
      }
    });
    return dependencies;
  },
  getCode: (ast) => {
    // AST转换为code
    const { code } = transformFromAst(ast, null, {
      presets: ['@babel/preset-env']
    });
    return code;
  }
};

class Compiler {
  constructor(options) {
    // webpack 配置
    const { entry, output } = options; // 入口
    this.entry = entry; // 出口
    this.output = output; // 模块
    this.modules = [];
  } // 构建启动
  run() {
    // 解析入口文件
    const info = this.build(this.entry);
    this.modules.push(info);
    this.modules.forEach(({ dependecies: dependencies }) => {
      // 判断有依赖对象,递归解析所有依赖项
      if (dependencies) {
        for (const dependency in dependencies) {
          this.modules.push(this.build(dependencies[dependency]));
        }
      }
    }); // 生成依赖关系图
    const dependencyGraph = this.modules.reduce(
      (graph, item) => ({
        ...graph, // 使用文件路径作为每个模块的唯一标识符,保存对应模块的依赖对象和文件内容
        [item.filename]: { dependencies: item.dependencies, code: item.code }
      }),
      {}
    );
  }
  build(filename) {
    const { getAst, getDependencies: getDependencies, getCode } = Parser;
    const ast = getAst(filename);
    const dependencies = getDependencies(ast, filename);
    const code = getCode(ast);
    return {
      // 文件路径,可以作为每个模块的唯一标识符
      filename, // 依赖对象,保存着依赖模块路径
      dependecies: dependencies, // 文件内容
      code
    };
  } // 重写 require函数,输出bundle
  generate() {
    // 输出文件路径
    const filePath = path.join(this.output.path, this.output.filename); // 懵逼了吗? 没事,下一节我们捋一捋
    const bundle = `(function(graph){    
                      function require(module){       
                        function localRequire(relativePath){        
                          return require(graph[module].dependecies[relativePath]) 
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
