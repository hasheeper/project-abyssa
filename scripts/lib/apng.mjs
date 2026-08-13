import { readFile, writeFile } from "node:fs/promises";

/**
 * APNG 组装器 —— 逐帧独立,不做帧间差分。
 *
 * ============ 为什么不用 ffmpeg 的 apng 编码器 ============
 * ffmpeg 会自动做帧间差分:只写变化的矩形区域,并按它认为更省的方式挑
 * dispose_op / blend_op。实测产物里出现过
 *   fcTL#27  26x25+125+80  dispose=NONE  blend=OVER
 * blend=OVER 的语义是「把本帧的像素**叠加合成**到画布已有内容之上」。
 * 对半透明像素来说,这要求解码器与编码器对「画布上原本是什么」的理解
 * 完全一致 —— ffmpeg 自己解码能对上(framehash 逐帧相同),但实际浏览器里
 * 就会看到符号一层层堆积而不是逐帧播放。
 *
 * 差分本身也没有开关可关:ffmpeg 的 apng 编码器只暴露 dpi / dpm / pred,
 * 没有「每帧都写全画布」的选项。所以这里自己写。
 *
 * 代价是文件变大(没有帧间压缩)。换来的是**任何符合规范的解码器都不可能
 * 累积**:每帧都是全画布 + blend=SOURCE(直接覆盖),不依赖前一帧的内容。
 * 对 192×192 的漫符来说这个代价可以接受,而重影是不能接受的。
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** dispose_op:本帧显示完后把区域清成透明。全画布 + SOURCE 时其实无关紧要,
 *  但循环回到第一帧时它保证画布是干净的。 */
const DISPOSE_BACKGROUND = 1;
/** blend_op:直接覆盖,不做 alpha 合成 —— 这一条是不产生累积的关键。 */
const BLEND_SOURCE = 0;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * 读一个 PNG,取出 IHDR 与合并后的 IDAT。
 *
 * 多个 IDAT 分块在规范上是**一条连续的 zlib 流**被切开,所以必须先拼接
 * 再当作整体使用 —— 逐块搬运会把流切在任意位置,解码即失败。
 */
async function readPng(path) {
  const buf = await readFile(path);
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error(`不是 PNG: ${path}`);

  let ihdr = null;
  const idat = [];
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") ihdr = Buffer.from(data);
    else if (type === "IDAT") idat.push(Buffer.from(data));
    else if (type === "IEND") break;
    off += 12 + len;
  }

  if (!ihdr) throw new Error(`缺 IHDR: ${path}`);
  if (!idat.length) throw new Error(`缺 IDAT: ${path}`);
  return { ihdr, idat: Buffer.concat(idat) };
}

/**
 * 把一组同尺寸 PNG 组装成 APNG。
 *
 * @param {string[]} framePaths 逐帧 PNG,顺序即播放顺序
 * @param {string} out 输出路径
 * @param {number} delayMs 每帧延迟(ms)
 */
export async function assembleApng(framePaths, out, delayMs) {
  if (!framePaths.length) throw new Error("没有帧");

  const frames = [];
  for (const p of framePaths) frames.push(await readPng(p));

  // IHDR 必须逐字节一致 —— APNG 只有一个 IHDR,所有帧共用它描述的
  // 尺寸/位深/颜色类型。混入一张规格不同的会静默产出坏文件。
  const base = frames[0].ihdr;
  for (let i = 1; i < frames.length; i++) {
    if (!frames[i].ihdr.equals(base)) {
      throw new Error(`第 ${i + 1} 帧的 IHDR 与首帧不一致: ${framePaths[i]}`);
    }
  }

  const width = base.readUInt32BE(0);
  const height = base.readUInt32BE(4);

  const acTL = Buffer.alloc(8);
  acTL.writeUInt32BE(frames.length, 0);
  acTL.writeUInt32BE(0, 4); // num_plays = 0 → 无限循环

  // 延迟写成分数 delayMs/1000 而不是约成 num/den ——
  // 67/1000 是精确值,而 1/15 会让 30 帧累积出 -10ms 的偏差。
  const fcTL = (seq) => {
    const d = Buffer.alloc(26);
    d.writeUInt32BE(seq, 0);
    d.writeUInt32BE(width, 4);
    d.writeUInt32BE(height, 8);
    d.writeUInt32BE(0, 12); // x_offset —— 全画布,恒为 0
    d.writeUInt32BE(0, 16); // y_offset
    d.writeUInt16BE(delayMs, 20);
    d.writeUInt16BE(1000, 22);
    d.writeUInt8(DISPOSE_BACKGROUND, 24);
    d.writeUInt8(BLEND_SOURCE, 25);
    return chunk("fcTL", d);
  };

  const parts = [SIGNATURE, chunk("IHDR", base), chunk("acTL", acTL)];

  // 序号在 fcTL 与 fdAT 之间连续递增,且必须全局唯一、严格有序。
  let seq = 0;

  // 第一帧走 IDAT(它同时是这个 PNG 的静态默认图像)。
  // 前面加 fcTL 才能让它参与动画 —— 不加的话它只是「不支持 APNG 时的回退图」,
  // 动画会从第二帧开始,循环时第一帧被跳过。
  parts.push(fcTL(seq++), chunk("IDAT", frames[0].idat));

  // 其余帧走 fdAT:数据格式与 IDAT 相同,只是前面多 4 字节序号。
  for (let i = 1; i < frames.length; i++) {
    parts.push(fcTL(seq++));
    const seqBuf = Buffer.alloc(4);
    seqBuf.writeUInt32BE(seq++);
    parts.push(chunk("fdAT", Buffer.concat([seqBuf, frames[i].idat])));
  }

  parts.push(chunk("IEND", Buffer.alloc(0)));
  await writeFile(out, Buffer.concat(parts));
}
