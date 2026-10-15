/**
 * 打包：把 src/index.html + styles.css + script.js + 本地图片 合成一个自包含的单文件 HTML。
 * 用法： node tools/build.js
 * 产物： build/人文组-拼贴诗工作台.html、build/index.html、人文组.html
 *
 * 为什么要把图片内联成 data URI：
 *   build/index.html 是放在 build/ 目录里用的，`assets/photos/x.jpg` 这种相对路径到那儿就断了。
 *   内联之后三个产物都是"随便丢到哪都能双击打开"的单文件，不再依赖外部资源。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const outDir = path.join(root, 'build');
const OUT_NAME = '人文组-拼贴诗工作台.html';

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml'
};

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

/* 把 <img src="相对路径"> 换成内联 data URI（相对路径以项目根为基准） */
function inlineImages(html) {
  let count = 0;
  let bytes = 0;
  const out = html.replace(/(<img\b[^>]*?\bsrc=")([^"]+)(")/g, (whole, pre, url, post) => {
    /* 已经是 data: / http(s): 的跳过 */
    if (/^(data:|https?:|\/\/)/i.test(url)) return whole;
    const abs = path.resolve(root, url);
    if (!abs.startsWith(root) || !fs.existsSync(abs)) {
      throw new Error('内联图片失败，找不到：' + url);
    }
    const ext = path.extname(abs).toLowerCase();
    const mime = MIME[ext];
    if (!mime) throw new Error('内联图片失败，未知类型：' + url);
    const buf = fs.readFileSync(abs);
    count++;
    bytes += buf.length;
    return pre + 'data:' + mime + ';base64,' + buf.toString('base64') + post;
  });
  return { html: out, count, bytes };
}

function main() {
  let html = read(path.join(srcDir, 'index.html'));
  const css = read(path.join(srcDir, 'styles.css'));
  /* 需要内联的脚本（顺序与 index.html 里的标签一致；paper.js 必须在 script.js 之前） */
  const jsFiles = ['paper.js', 'corpus.js', 'script.js'];

  /* 顺手做一次安全检查：脚本里出现 </script> 会截断内联 */
  jsFiles.forEach((f) => {
    if (/<\/script>/i.test(read(path.join(srcDir, f)))) {
      throw new Error(f + ' 里出现了 </script>，会截断内联脚本');
    }
  });

  const before = html.length;

  html = html.replace(
    /<link rel="stylesheet" href="src\/styles\.css">/,
    () => '<style>\n' + css + '\n</style>'
  );

  /* index.html 里是三个独立的 <script src="src/xxx.js">，必须全部内联。
     早先只替换了 script.js，导致 paper.js / corpus.js 以外部引用留在产物里，
     成品并不是真正的单文件 —— 单独发给别人打开时 PaperLab / Corpus 会是 undefined。 */
  const jsTagRe = /<script src="src\/([a-z]+\.js)"><\/script>\s*/g;
  let inlineCount = 0;
  html = html.replace(jsTagRe, (whole, file) => {
    inlineCount++;
    return '<script>\n/* ==== ' + file + ' ==== */\n' + read(path.join(srcDir, file)) + '\n</script>\n';
  });
  if (inlineCount !== jsFiles.length) {
    throw new Error('内联脚本数量不对：预期 ' + jsFiles.length + ' 个，实际 ' + inlineCount +
      ' 个（检查 index.html 里的 script 标签）');
  }

  /* 兜底：任何 src/styles.css、src/xxx.js 的残留都算失败 */
  const stale = html.match(/(?:src|href)="src\/[^"]+"/g);
  if (stale) {
    throw new Error('内联失败：仍有 src/ 引用残留 —— ' + stale.join(', '));
  }
  if (html.length <= before) {
    throw new Error('内联失败：产物没有变大，检查 index.html 里的 link/script 标签');
  }

  /* 图片内联放在最后：上面两步都会改变 html 长度，不影响正则匹配 */
  const imgRes = inlineImages(html);
  html = imgRes.html;

  /* 再兜一次底：产物里不应再有任何指向本地文件的 src/href */
  const leftover = html.match(/(?:src|href)="(?!data:|https?:|#|mailto:)([^"]+)"/g);
  if (leftover) {
    throw new Error('产物里仍有外部引用：' + leftover.slice(0, 3).join(', '));
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, OUT_NAME);
  fs.writeFileSync(outPath, html, 'utf8');
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

  /* 项目根目录也放一份，方便直接取用（BBS 上只发这一个文件就够） */
  const rootCopy = path.join(root, '人文组.html');
  fs.writeFileSync(rootCopy, html, 'utf8');

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  const jsKb = jsFiles.reduce((s, f) => s + fs.statSync(path.join(srcDir, f)).size, 0) / 1024;
  console.log('✔ 已生成 ' + path.relative(root, outPath) + '  (' + kb + ' KB)');
  console.log('✔ 已同步 ' + path.relative(root, rootCopy));
  console.log('  css ' + (Buffer.byteLength(css, 'utf8') / 1024).toFixed(1) + ' KB · js ' +
    jsKb.toFixed(1) + ' KB（' + jsFiles.length + ' 个）· 图片内联 ' + imgRes.count +
    ' 张 ' + (imgRes.bytes / 1024).toFixed(0) + ' KB');
  console.log('  自包含检查：外部引用 ' +
    (html.match(/(?:src|href)="(?!data:|https?:|#|mailto:)[^"]+"/g) || []).length + ' 处（应为 0）');
}

main();

