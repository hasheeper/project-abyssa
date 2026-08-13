import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { assembleApng } from "./lib/apng.mjs";

const run = promisify(execFile);

/**
 * 漫符(头顶气泡)素材构建 —— 把混合来源的 GIF / APNG 收敛成一套统一规格。
 *
 * ============ 为什么必须重新编码,不能直接改名了事 ============
 * 素材来自两批,规格完全不同:
 *   7 个 GIF (日文命名)  640~1024px  33.33fps  60~180 帧
 *   6 个 APNG            192px       14.93fps  27~30 帧
 * 尺寸差 5 倍、帧数差 6 倍。不统一的话,每加一个漫符就要单独调一次缩放和
 * 循环时长,逐角色位置表也会失去可比性 —— 那张表的全部价值就在于
 * 同一个数值在不同漫符上含义相同。
 *
 * ============ 输出为 .png 而非 .apng ============
 * APNG 靠文件内容识别而非扩展名,但 .apng 在 Vite 的静态资源 MIME 表里
 * 没有条目,dev server 会回 application/octet-stream,<img> 直接不显示。
 * 用 .png 则天然走 image/png,浏览器读到 acTL 块自动按 APNG 播放。
 *
 * ============ 两步编码而不是一条 filter 链 ============
 * 单条命令里 -vf fps=X 会同时决定「抽多少帧」和「输出帧延迟」,两者被绑死:
 * 源时长各不相同,抽到 30 帧所需的 fps 也各不相同,于是每个文件的播放
 * 速度就跟着源时长走了。拆成两步后,抽帧用源时长算,组装固定 67ms,
 * 两个旋钮互不干扰。
 */

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ROOT = join(PROJECT_ROOT, "src/assets/emote");
const CACHE_ROOT = join(PROJECT_ROOT, "node_modules/.cache/abyssa-emotes");

/** 统一帧数。 */
const FRAMES = 30;
/** 统一帧延迟(ms)。取自现有 6 个 APNG 的原始值,30 × 67 = 2.01s 一轮。 */
const DELAY_MS = 67;
/** 统一画布边长。沿用现有 APNG 的 192,GIF 一律降采样到此。 */
const SIZE = 192;

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const sourceArg = args.find((a) => a.startsWith("--source="));
const SOURCE_DIR =
  (sourceArg && resolve(sourceArg.slice("--source=".length))) ||
  process.env.EMOTE_SOURCE_DIR ||
  join(homedir(), "Downloads/emo");

/**
 * 源文件 → 英文 id 的对照表。
 *
 * id 必须是英文且语义化 —— 它会同时出现在文件名、TS 常量、CSS 选择器和
 * 逐角色位置表里,日文原名在这四处都不可用。
 *
 * label 取自日文原名的语义,不是意译发挥:
 * 面板上要能与源素材对上号,否则重新导入一批素材时无从核对。
 *
 * キラキラ 在两批素材里各出现一次(GIF 的「一部」版与 APNG 版),
 * 拆成 glitter / sparkle —— 同名会让后到的那个静默覆盖前一个。
 */
const SOURCES = [
  { file: "17はずかし_rend.gif", id: "blush", label: "害羞", origin: "はずかし" },
  { file: "23あせあせA_連続_rend.gif", id: "sweat", label: "冷汗", origin: "あせあせA 連続" },
  { file: "39キラキラA_一部_rend.gif", id: "glitter", label: "闪耀", origin: "キラキラA 一部" },
  { file: "43音符A2_1個_黄色_rend.gif", id: "note", label: "音符", origin: "音符A2 1個 黄色" },
  { file: "46ハートB_3連_rend.gif", id: "heart", label: "爱心", origin: "ハートB 3連" },
  { file: "52_がっかりB_ぐねぐね_GIF.gif", id: "gloom", label: "沮丧", origin: "がっかりB ぐねぐね" },
  { file: "62ねむけ_rend.gif", id: "sleepy", label: "困倦", origin: "ねむけ" },
  { file: "bikkuri_animan.apng", id: "exclaim", label: "惊讶", origin: "びっくり" },
  { file: "guruguru_anim.apng", id: "dizzy", label: "晕眩", origin: "ぐるぐる" },
  { file: "hatena_animan.apng", id: "question", label: "疑问", origin: "はてな" },
  { file: "kirakira_anim.apng", id: "sparkle", label: "星光", origin: "キラキラ" },
  { file: "pikon_anim.apng", id: "idea", label: "灵光", origin: "ぴこん" },

  // ---- v2 批次 ----
  // ellipsis 换成 v2 的三点版本,原 tenten.apng 不再使用:
  // 那个 APNG 只有 27 帧且首帧是全画布、后续是小矩形,是这批素材里
  // 最容易触发累积的一个(见 lib/apng.mjs 的说明)。
  { dir: "v2", prefix: "15", id: "ellipsis", label: "无言", origin: "てんてんてん" },
  // 文件名在传输中被转码坏了(“{‚č),按字节还原 Shift-JIS 是「怒」。
  // 所以这一条只能按前缀匹配 —— 把坏掉的名字写进源码,
  // 换一台机器或重新下载一次素材就对不上了。
  { dir: "v2", prefix: "10", id: "anger", label: "愤怒", origin: "怒" },
  // 与 sweat(あせあせA 連続)不是同一个:那个是连续多滴的「冷汗」,
  // 这个是单股「流汗」。两者语义和画面都不同,不能合并成一个 id。
  { dir: "v2", prefix: "22", id: "sweatdrop", label: "流汗", origin: "あせ" }
];

/**
 * 定位源文件。
 *
 * 优先用确切文件名;给了 prefix 的则在目录里按前缀查找。
 * 后者是为坏掉的文件名准备的 —— 但也因此必须确保**只匹配到一个**:
 * 静默取第一个的话,日后往同目录再放一个同前缀的素材,
 * 构建结果会悄悄换掉,而没有任何地方会报错。
 */
async function resolveSource(entry) {
  const dir = entry.dir ? join(SOURCE_DIR, entry.dir) : SOURCE_DIR;
  if (entry.file) {
    const path = join(dir, entry.file);
    return existsSync(path) ? path : null;
  }
  if (!existsSync(dir)) return null;
  const hits = (await readdir(dir)).filter((f) => f.startsWith(entry.prefix) && !f.startsWith("."));
  if (hits.length > 1) {
    throw new Error(`${entry.id}: 前缀 "${entry.prefix}" 在 ${dir} 命中 ${hits.length} 个文件`);
  }
  return hits.length ? join(dir, hits[0]) : null;
}

async function ffprobe(file, entries) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", entries,
    "-of", "default=nw=1:nk=1",
    file
  ]);
  return stdout.trim().split("\n");
}

/**
 * 源时长(秒)。
 *
 * GIF 有容器时长可直接读。APNG 没有 —— ffprobe 对它的 format.duration 返回
 * N/A,只能数帧再乘以帧延迟。所以这里按容器分流,不能统一走一条路径。
 */
async function sourceDuration(file) {
  if (file.endsWith(".gif")) {
    const { stdout } = await run("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file
    ]);
    const d = Number.parseFloat(stdout.trim());
    if (Number.isFinite(d) && d > 0) return d;
  }
  const [rate] = await ffprobe(file, "stream=r_frame_rate");
  const [num, den] = rate.split("/").map(Number);
  const fps = den ? num / den : num;
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-count_frames", "-select_streams", "v:0",
    "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", file
  ]);
  const count = Number.parseInt(stdout.trim(), 10);
  return count / fps;
}

async function countFrames(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-count_frames", "-select_streams", "v:0",
    "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", file
  ]);
  return Number.parseInt(stdout.trim(), 10);
}

/**
 * 抽帧 —— 把任意帧数的源均匀采样到恰好 FRAMES 张。
 *
 * fps = FRAMES / 时长,让采样点铺满整条时间轴。直接用 select='not(mod(n,K))'
 * 更省事,但只在源帧数是 30 的整数倍时才成立(这批里只有 60 帧那个满足),
 * 其余会在尾部截断,循环点对不上。
 *
 * 浮点取整可能少出一帧(实测 110 帧那个会给 29 张),所以留了重试:
 * 略微提高 fps 再抽一次。宁可多抽后截断,也不能少 —— 少一帧会让
 * 组装出的 APNG 循环时长与其它的差 67ms,并排播放时能看出不同步。
 */
async function extractFrames(src, dir, duration) {
  for (const bump of [0, 0.5, 1.5]) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const fps = (FRAMES + bump) / duration;
    await run("ffmpeg", [
      "-y", "-v", "error",
      "-i", src,
      "-vf", `fps=${fps.toFixed(6)},scale=${SIZE}:${SIZE}:flags=lanczos`,
      "-frames:v", String(FRAMES),
      "-pix_fmt", "rgba",
      join(dir, "%03d.png")
    ]);
    const got = (await readdir(dir)).filter((f) => f.endsWith(".png")).length;
    if (got >= FRAMES) return;
  }
  throw new Error(`抽帧不足 ${FRAMES} 张: ${src}`);
}

/**
 * 组装 APNG。
 *
 * ============ 不用 ffmpeg 的 apng 编码器 ============
 * 它会自动做帧间差分,只写变化的矩形并自行挑 dispose/blend。实测产物里
 * 出现过 `blend=OVER`(ellipsis 第 27–29 帧)—— 语义是「把本帧像素**叠加
 * 合成**到画布已有内容之上」,于是浏览器里符号会一层层堆积而不是逐帧播放。
 * dizzy 还混用了 `dispose=BACKGROUND`。
 *
 * 值得记下的是:用 ffmpeg 自己解码回来做 framehash,30 帧与输入帧**逐帧
 * 完全一致** —— 编解码器内部自洽,所以这个故障用 ffmpeg 验证不出来,
 * 只能去读 fcTL 块。而编码器也没有关掉差分的开关(只有 dpi/dpm/pred)。
 *
 * 自己写的组装器每帧都是全画布 + blend=SOURCE,不依赖前一帧,
 * 任何符合规范的解码器都不可能累积。详见 lib/apng.mjs。
 */
async function assemble(dir, out) {
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".png"))
    .sort()
    .slice(0, FRAMES)
    .map((f) => join(dir, f));
  await assembleApng(files, out, DELAY_MS);
}

/**
 * 静态首帧 —— 给 prefers-reduced-motion 用。
 *
 * APNG 的播放由解码器驱动,JS 拿不到控制权:没有 pause(),
 * animation-play-state 也管不到它,连 <img> 的 src 不变就无法重启。
 * 所以动效敏感者那条路径只能**换一张图**,不能「暂停动画」。
 *
 * 另一条路是干脆不显示,但那会连情绪本身一起丢掉 ——
 * 漫符是有信息量的(害羞 / 疑问 / 沮丧),不属于纯装饰,
 * 按 rp.css 全文一致的那条判据(状态标识保留、纯运动砍掉),应当留下静态版。
 */
async function stillFrame(dir, out) {
  // 首帧本身已经是 rgba 的普通 PNG,直接复制即可 ——
  // 过一遍 ffmpeg 只是重新编码同样的像素,没有意义。
  await copyFile(join(dir, "001.png"), out);
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`找不到素材目录: ${SOURCE_DIR}`);
    console.error("用 --source=<dir> 或 EMOTE_SOURCE_DIR 指定。");
    process.exit(1);
  }

  // 先把全部源文件定位好再动手,不要边转边找 ——
  // 缺一个就中途失败的话,产物目录会停在新旧混杂的状态。
  const resolved = [];
  const missing = [];
  for (const s of SOURCES) {
    const path = await resolveSource(s);
    if (path) resolved.push({ ...s, path });
    else missing.push(s);
  }
  if (missing.length) {
    console.error(`素材缺失 ${missing.length} 个:`);
    for (const m of missing) {
      const where = m.dir ? `${m.dir}/` : "";
      console.error(`  ${m.id}  ← ${where}${m.file ?? `${m.prefix}*`}`);
    }
    process.exit(1);
  }

  if (checkOnly) {
    const stale = [];
    for (const s of SOURCES) {
      const out = join(OUT_ROOT, `${s.id}.png`);
      if (!existsSync(out)) stale.push(`${s.id} 未生成`);
      else if ((await countFrames(out)) !== FRAMES) stale.push(`${s.id} 帧数不是 ${FRAMES}`);
      // 静帧缺失是静默故障:常态下看不出来,只有开了 reduced-motion
      // 才会显示为破图,所以必须在这里查。
      if (!existsSync(join(OUT_ROOT, `${s.id}-still.png`))) stale.push(`${s.id} 缺静帧`);
    }
    if (stale.length) {
      console.error(stale.join("\n"));
      process.exit(1);
    }
    console.log(`✓ ${SOURCES.length} 个漫符均为 ${FRAMES} 帧`);
    return;
  }

  await mkdir(OUT_ROOT, { recursive: true });
  await mkdir(CACHE_ROOT, { recursive: true });

  const manifest = [];
  for (const s of resolved) {
    const src = s.path;
    const dir = join(CACHE_ROOT, s.id);
    const out = join(OUT_ROOT, `${s.id}.png`);

    const duration = await sourceDuration(src);
    const srcFrames = await countFrames(src);
    await extractFrames(src, dir, duration);
    await assemble(dir, out);
    await stillFrame(dir, join(OUT_ROOT, `${s.id}-still.png`));

    const frames = await countFrames(out);
    const { size } = await stat(out);
    if (frames !== FRAMES) throw new Error(`${s.id} 组装后为 ${frames} 帧`);

    const speed = duration / (FRAMES * DELAY_MS / 1000);
    manifest.push({
      id: s.id,
      label: s.label,
      origin: s.origin,
      source: src.slice(SOURCE_DIR.length + 1),
      sourceFrames: srcFrames,
      sourceDuration: Number(duration.toFixed(3)),
      speed: Number(speed.toFixed(2)),
      bytes: size
    });

    const warn = speed >= 1.6 || speed <= 0.7 ? `  ⚠ 速度 ×${speed.toFixed(2)}` : "";
    console.log(
      `✓ ${s.id.padEnd(9)} ${String(srcFrames).padStart(3)}f/${duration.toFixed(2)}s → ` +
      `${FRAMES}f/${(FRAMES * DELAY_MS / 1000).toFixed(2)}s  ${(size / 1024).toFixed(0)}KB${warn}`
    );
  }

  await writeFile(
    join(OUT_ROOT, "manifest.json"),
    JSON.stringify({ frames: FRAMES, delayMs: DELAY_MS, size: SIZE, emotes: manifest }, null, 2) + "\n"
  );

  const total = manifest.reduce((n, m) => n + m.bytes, 0);
  console.log(`\n${manifest.length} 个漫符,合计 ${(total / 1024 / 1024).toFixed(1)}MB → src/assets/emote/`);

  const fast = manifest.filter((m) => m.speed >= 1.6);
  if (fast.length) {
    console.log("\n以下漫符因源时长远长于 2.01s 而被加速,若观感不对需单独处理:");
    for (const m of fast) console.log(`  ${m.id} ×${m.speed.toFixed(2)}  (源 ${m.sourceDuration}s)`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
