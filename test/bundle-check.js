/* 成品结构自检：确认四个列表、语料池、生成函数都进了单文件产物
   用法： node test/bundle-check.js */
'use strict';
const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', '人文组.html');
const t = fs.readFileSync(file, 'utf8');

const checks = [
  ['四列表容器 #wmPanels', 'id="wmPanels"'],
  ['短语列表分组', "key: 'phrase'"],
  ['句子列表分组', "key: 'sentence'"],
  ['词汇列表分组', "key: 'vocab'"],
  ['自定义列表分组', "key: 'custom'"],
  ['子分类芯片渲染', 'wm__chips'],
  ['全选 / 全不选', 'wmSetAll'],
  ['句子池：论述整句', "id: 'senFrame'"],
  ['句子池：见闻陈述', "id: 'senSeen'"],
  ['句子池：抽象长句', "id: 'senAbstract'"],
  ['句子池：诗性句', "id: 'senPoetic'"],
  ['句子池：短句断句', "id: 'senShort'"],
  ['句子池：名句成句', "id: 'senQuote'"],
  ['词汇池：论述术语', "id: 'vocTerm'"],
  ['词汇池：意象词', "id: 'vocImage'"],
  ['句子生成器 makeSentence', 'function makeSentence'],
  ['随机拼诗跨列表取词', 'pickers.push'],
  ['自定义按空格拆词', 'customSplit'],
  ['纸纹自标定', 'hSd'],
  ['背景模板', 'BG_TEMPLATES'],
  ['质感预设', 'FX_PRESETS'],
  ['墨迹高光层', 'piece__ink-hi'],
  ['剪字抠图', 'estimateBg'],
  ['导出纹理绘制', 'paintTexture'],
  ['无外部依赖(无 http 引用)', null]
];

let bad = 0;
console.log('产物: ' + path.relative(path.resolve(__dirname, '..'), file) +
  '  (' + (Buffer.byteLength(t, 'utf8') / 1024).toFixed(1) + ' KB)\n');

const external = (t.match(/(src|href)="https?:\/\//g) || []).length;
checks.forEach(([name, needle]) => {
  let ok;
  if (needle === null) ok = external === 0;
  else ok = t.indexOf(needle) >= 0;
  if (!ok) bad++;
  console.log('  ' + (ok ? '✔' : '✘') + ' ' + name + (needle === null ? ('（外链 ' + external + ' 个）') : ''));
});

/* ---------------- 自包含检查 ----------------
   这一组是踩过坑之后加的：早先 build.js 只内联了 script.js，
   paper.js / corpus.js 以 <script src="src/xxx.js"> 的形式留在产物里，
   成品单独发给别人打开时 PaperLab / Corpus 会是 undefined，造词机与纸纹全废。
   所以这里逐项断言"不需要任何外部文件"。 */
console.log('\n自包含检查：');
const selfChecks = [
  ['无 src/ 外部引用', (t.match(/(?:src|href)="src\//g) || []).length === 0],
  ['无任何本地文件引用', (t.match(/(?:src|href)="(?!data:|https?:|#|mailto:)[^"]+"/g) || []).length === 0],
  ['三个脚本都已内联', (t.match(/\/\* ==== (?:paper|corpus|script)\.js ==== \*\//g) || []).length === 3],
  ['样式表已内联', t.indexOf('<style>') >= 0 && t.indexOf('src/styles.css') < 0],
  ['存在内联图片', (t.match(/src="data:image\//g) || []).length > 0],
  ['纸张引擎代码在产物内', t.indexOf('PaperLab') >= 0 && t.indexOf('TEXTURE_LIST') >= 0],
  ['语料库代码在产物内', t.indexOf('makeSentence') >= 0 && t.indexOf('POOLS') >= 0]
];
selfChecks.forEach(([name, ok]) => {
  if (!ok) bad++;
  console.log('  ' + (ok ? '✔' : '✘') + ' ' + name);
});

const imgCount = (t.match(/src="data:image\/jpeg;base64/g) || []).length;
const imgBytes = (t.match(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g) || [])
  .reduce((s, m) => s + Math.round(m.length * 0.75), 0);

/* 顺手统计一下语料规模 */
const Q = (t.match(/\{ t: '/g) || []).length;
console.log('\n  名句条目约 ' + Q + ' 条');
console.log('  内联图片 ' + imgCount + ' 张，原始约 ' + (imgBytes / 1024).toFixed(0) + ' KB（base64 后约 ' +
  ((Buffer.byteLength(t, 'utf8') - 0) / 1024).toFixed(0) + ' KB 总量）');
console.log(bad ? ('\n有 ' + bad + ' 项缺失 ✘') : '\n全部就位 ✔（产物可脱离 src/ 独立打开）');
process.exit(bad ? 1 : 0);
