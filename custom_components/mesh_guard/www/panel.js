/* Mesh Guard 灯具守护 — Apple 风格面板（原生 WebComponent，零外部依赖）
 *
 * 关键实现说明：
 * - 本组件以 embed_iframe + Shadow DOM 方式嵌入 HA。Shadow DOM 内 :root / body
 *   选择器均不命中，因此所有 CSS 自定义属性一律定义在 :host 上，基础排版
 *   （背景、文字色、字体栈、min-height）也直接写在 :host。
 * - 暗色：prefers-color-scheme 媒体查询切换同一组变量；另提供 theme="dark|light"
 *   属性作为强制覆盖（与媒体查询共用同一份变量定义）。
 */
/* global customElements, HTMLElement */

const DOMAIN = "mesh_guard";

/* ---------------- 主题变量 ---------------- */
const VARS_LIGHT = `
  --bg:#f2f2f7; --card:#ffffff; --card2:#f6f6f9;
  --fill:rgba(120,120,128,.12); --fill2:rgba(120,120,128,.20);
  --text:#1c1c1e; --text2:rgba(60,60,67,.62); --text3:rgba(60,60,67,.38);
  --accent:#007aff; --accent-press:#0062d0; --accent-bg:rgba(0,122,255,.11);
  --green:#34c759; --green-bg:rgba(52,199,89,.14);
  --orange:#ff9500; --orange-bg:rgba(255,149,0,.14);
  --red:#ff3b30; --red-bg:rgba(255,59,48,.11);
  --purple:#af52de; --purple-bg:rgba(175,82,222,.13);
  --gray:#8e8e93; --gray-bg:rgba(120,120,128,.15);
  --sep:rgba(60,60,67,.10); --sep2:rgba(60,60,67,.18);
  --shadow:0 .5px 2px rgba(0,0,0,.04), 0 10px 28px rgba(0,0,0,.06);
  --shadow-pop:0 12px 44px rgba(0,0,0,.16);
  --toast-bg:rgba(28,28,30,.94); --toast-text:#f7f7f9;
`;
const VARS_DARK = `
  --bg:#000000; --card:#1c1c1e; --card2:#2c2c2e;
  --fill:rgba(120,120,128,.20); --fill2:rgba(120,120,128,.30);
  --text:#f2f2f7; --text2:rgba(235,235,245,.62); --text3:rgba(235,235,245,.36);
  --accent:#0a84ff; --accent-press:#3b9bff; --accent-bg:rgba(10,132,255,.20);
  --green:#30d158; --green-bg:rgba(48,209,88,.16);
  --orange:#ff9f0a; --orange-bg:rgba(255,159,10,.16);
  --red:#ff453a; --red-bg:rgba(255,69,58,.15);
  --purple:#bf5af2; --purple-bg:rgba(191,90,242,.18);
  --gray:#98989d; --gray-bg:rgba(120,120,128,.22);
  --sep:rgba(84,84,88,.42); --sep2:rgba(84,84,88,.60);
  --shadow:0 .5px 2px rgba(0,0,0,.5), 0 10px 28px rgba(0,0,0,.34);
  --shadow-pop:0 12px 44px rgba(0,0,0,.55);
  --toast-bg:rgba(238,238,243,.95); --toast-text:#1c1c1e;
`;

/* ---------------- 样式 ---------------- */
const CSS = `
:host { ${VARS_LIGHT}
  --r:18px; --r-s:12px; --nav-h:54px;
  display:block; min-height:100vh; background:var(--bg); color:var(--text);
  font-family:-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC",
    "HarmonyOS Sans SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  font-size:15px; line-height:1.5; -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
@media (prefers-color-scheme: dark) { :host { ${VARS_DARK} } }
:host([theme="dark"]) { ${VARS_DARK} }
:host([theme="light"]) { ${VARS_LIGHT} }

*, *:before, *:after { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
button { font:inherit; color:inherit; }
button:focus-visible, input:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
svg { display:block; }

.app { max-width:760px; margin:0 auto; padding:0 16px calc(var(--nav-h) + 36px + env(safe-area-inset-bottom)); }
@media (min-width:641px) { .app { padding-bottom:72px; } }

/* 顶部大标题 */
.hd { padding:26px 2px 4px; }
.hd-top { display:flex; align-items:center; gap:10px; }
.logo { width:38px; height:38px; border-radius:11px; color:#fff;
  background:linear-gradient(140deg,#2f9bff 0%,#0065e0 100%);
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 5px 14px rgba(0,110,255,.30); }
.logo svg { width:22px; height:22px; }
.hd-site { font-size:13px; font-weight:600; color:var(--text2);
  background:var(--fill); border-radius:999px; padding:5px 12px; }
.hd h1 { font-size:34px; font-weight:800; letter-spacing:.2px; margin:12px 0 2px; }
.hd .sub { color:var(--text2); font-size:13.5px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.hd .sub .ldot { width:7px; height:7px; border-radius:50%; background:var(--green); flex-shrink:0; }
.hd .sub .ldot.warn { background:var(--orange); }

/* 分段标签（桌面/平板） */
.tabs { display:flex; gap:3px; background:var(--fill); padding:3px; border-radius:14px;
  margin:18px auto 22px; width:max-content; max-width:100%; overflow-x:auto; }
.tabs button { border:0; background:transparent; color:var(--text2); font-weight:600; font-size:14px;
  min-height:38px; padding:7px 20px; border-radius:11px; cursor:pointer; white-space:nowrap;
  transition:background .16s, color .16s, box-shadow .16s; }
.tabs button.on { background:var(--card); color:var(--text); box-shadow:0 2px 8px rgba(0,0,0,.10), 0 .5px 1px rgba(0,0,0,.05); }

/* 底部导航（手机） */
.bnav { display:none; }
@media (max-width:640px) {
  .tabs { display:none; }
  .bnav { display:flex; position:fixed; left:0; right:0; bottom:0; z-index:40;
    height:calc(var(--nav-h) + env(safe-area-inset-bottom));
    padding:5px 6px calc(5px + env(safe-area-inset-bottom));
    background:var(--card); background:color-mix(in srgb, var(--card) 84%, transparent);
    backdrop-filter:blur(22px) saturate(160%); -webkit-backdrop-filter:blur(22px) saturate(160%);
    border-top:.5px solid var(--sep); }
  .bnav button { flex:1; border:0; background:none; color:var(--text3); cursor:pointer;
    font-size:10px; font-weight:500; display:flex; flex-direction:column; align-items:center;
    justify-content:center; gap:3px; min-height:44px; border-radius:12px; }
  .bnav button.on { color:var(--accent); }
  .bnav button:active { background:var(--fill); }
  .bnav svg { width:23px; height:23px; }
}

/* 视图切换淡入 */
.view.fade { animation:vin .3s ease both; }
@keyframes vin { from { opacity:0; transform:translateY(7px); } }

/* 卡片 */
.card { background:var(--card); border-radius:var(--r); box-shadow:var(--shadow);
  border:.5px solid var(--sep); padding:18px; margin-bottom:16px; }
.card h3 { margin:0 0 12px; font-size:17px; font-weight:700; letter-spacing:.1px; }
.card .hint { color:var(--text2); font-size:12.5px; margin-top:10px; line-height:1.5; }

/* 统计卡 */
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
@media (max-width:640px) { .stats { grid-template-columns:repeat(2,1fr); } }
.stat { background:var(--card); border-radius:var(--r); box-shadow:var(--shadow);
  border:.5px solid var(--sep); padding:14px 16px; }
.stat .ic { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; }
.stat .ic svg { width:19px; height:19px; }
.stat .num { font-size:28px; font-weight:800; letter-spacing:-.5px; margin-top:10px; line-height:1.1; }
.stat .lbl { color:var(--text2); font-size:12.5px; margin-top:2px; }
.ic-blue { background:var(--accent-bg); color:var(--accent); }
.ic-green { background:var(--green-bg); color:var(--green); }
.ic-orange { background:var(--orange-bg); color:var(--orange); }
.ic-red { background:var(--red-bg); color:var(--red); }
.ic-purple { background:var(--purple-bg); color:var(--purple); }
.ic-gray { background:var(--gray-bg); color:var(--gray); }

/* 徽标 */
.bd { display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600;
  padding:4px 10px; border-radius:999px; white-space:nowrap; line-height:1.35; }
.bd .d { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0; }
.bd.pulse .d { animation:pulse 1.15s ease-in-out infinite; }
@keyframes pulse { 50% { opacity:.35; transform:scale(.8); } }
.b-green { background:var(--green-bg); color:var(--green); }
.b-orange { background:var(--orange-bg); color:var(--orange); }
.b-red { background:var(--red-bg); color:var(--red); }
.b-blue { background:var(--accent-bg); color:var(--accent); }
.b-purple { background:var(--purple-bg); color:var(--purple); }
.b-gray { background:var(--gray-bg); color:var(--gray); }

/* 按钮 */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:6px;
  border:0; font-weight:600; font-size:14px; min-height:40px; padding:8px 20px;
  border-radius:999px; background:var(--accent); color:#fff; cursor:pointer;
  transition:transform .12s ease, background .15s, opacity .15s; user-select:none; }
.btn:hover { background:var(--accent-press); }
.btn:active { transform:scale(.96); }
.btn[disabled] { opacity:.4; pointer-events:none; }
.btn svg { width:16px; height:16px; }
.btn.tint { background:var(--accent-bg); color:var(--accent); }
.btn.tint:hover { background:color-mix(in srgb, var(--accent) 20%, transparent); }
.btn.gray { background:var(--fill); color:var(--text); }
.btn.gray:hover { background:var(--fill2); }
.btn.red { background:var(--red-bg); color:var(--red); }
.btn.red:hover { background:color-mix(in srgb, var(--red) 20%, transparent); }
.btn.redsolid { background:var(--red); color:#fff; }
.btn.redsolid:hover { background:color-mix(in srgb, var(--red) 85%, #000); }
.btn.sm { min-height:36px; padding:6px 15px; font-size:13px; }
.btn.sm svg { width:14px; height:14px; }
.btn.block { width:100%; min-height:50px; font-size:16px; }
.btn.xl { min-height:46px; font-size:15px; }

/* 列表行 */
.li { display:flex; align-items:center; gap:12px; padding:12px 0;
  border-bottom:.5px solid var(--sep); min-height:44px; }
.li:last-child { border-bottom:0; }
.li .main { flex:1; min-width:0; }
.li .tt { font-weight:600; font-size:14.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.li .ds { color:var(--text2); font-size:12.5px; margin-top:1px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.acts { display:flex; gap:8px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end; }

/* 表单控件 */
.inp { width:100%; font:inherit; font-size:15px; color:var(--text);
  background:var(--card2); border:1px solid var(--sep2); border-radius:var(--r-s);
  padding:10px 14px; min-height:44px; outline:none;
  transition:border-color .15s, box-shadow .15s, background .15s; }
.inp::placeholder { color:var(--text3); }
.inp:focus { border-color:var(--accent); background:var(--card);
  box-shadow:0 0 0 3.5px var(--accent-bg); }
input[type="number"].inp { text-align:center; }
input[type="time"].inp { text-align:center; padding:10px 8px; }
.f-lb { display:block; margin:14px 0 6px; font-size:13px; color:var(--text2); font-weight:600; }

/* iOS 开关 */
.sw { position:relative; width:52px; height:32px; flex-shrink:0; cursor:pointer; display:inline-block; }
.sw input { position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
.sw i { position:absolute; inset:0; border-radius:999px; background:var(--fill2); transition:background .2s; pointer-events:none; }
.sw i:before { content:""; position:absolute; width:28px; height:28px; left:2px; top:2px;
  background:#fff; border-radius:50%; transition:transform .2s;
  box-shadow:0 2px 6px rgba(0,0,0,.22), 0 .5px 1px rgba(0,0,0,.1); }
.sw input:checked + i { background:var(--green); }
.sw input:checked + i:before { transform:translateX(20px); }

/* 大号分段控件 */
.seg { display:flex; background:var(--fill); border-radius:16px; padding:4px; gap:4px; }
.seg button { flex:1; min-height:56px; border:0; border-radius:12px; background:transparent;
  color:var(--text2); font-weight:600; font-size:14px; cursor:pointer; padding:8px 6px;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
  transition:background .16s, color .16s, box-shadow .16s, transform .12s; }
.seg button:active { transform:scale(.97); }
.seg button.on { background:var(--card); color:var(--text); box-shadow:0 2px 10px rgba(0,0,0,.12); }
.seg button small { font-size:11px; font-weight:500; color:var(--text3); }
.seg button.on small { color:var(--text2); }

/* 分类 chips 按钮组 */
.chips { display:flex; flex-wrap:wrap; gap:8px; }
.chip-b { min-height:36px; padding:6px 15px; border-radius:999px; cursor:pointer;
  border:1px solid var(--sep2); background:var(--card); color:var(--text2);
  font:inherit; font-size:13px; font-weight:600; transition:all .13s; }
.chip-b:hover { border-color:var(--accent); color:var(--accent); }
.chip-b:active { transform:scale(.95); }
.chip-b.on { background:var(--accent); border-color:var(--accent); color:#fff; }
.chip-b.on-auto { background:var(--fill2); border-color:transparent; color:var(--text); }

/* 组标题（可折叠） */
.gt { display:flex; align-items:center; gap:8px; margin:22px 2px 10px; padding:6px 2px;
  font-size:13px; font-weight:700; color:var(--text2); letter-spacing:.3px;
  min-height:36px; border:0; background:none; width:100%; cursor:pointer; text-align:left; }
.gt .cnt { background:var(--fill); border-radius:999px; padding:2px 10px; font-size:11.5px; font-weight:600; }
.gt .chev { margin-left:auto; color:var(--text3); transition:transform .18s; }
.gt .chev svg { width:16px; height:16px; }
.gt.closed .chev { transform:rotate(-90deg); }
div.gt { cursor:default; }

/* 设备卡 */
.dev { padding:16px 18px; }
.dev .top { display:flex; gap:12px; align-items:flex-start; }
.dev .dic { width:42px; height:42px; border-radius:12px; display:flex; align-items:center;
  justify-content:center; flex-shrink:0; }
.dev .dic svg { width:22px; height:22px; }
.dev .nm { font-weight:700; font-size:15.5px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.dev .meta { color:var(--text2); font-size:12.5px; margin-top:2px; }
.dev .rsn { color:var(--text3); font-size:12px; margin-top:3px; line-height:1.45; }
.dev .cls-row { margin-top:14px; padding-top:12px; border-top:.5px solid var(--sep);
  display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.dev .cls-lb { font-size:12px; color:var(--text3); font-weight:600; }

/* 回路卡 */
.ckt .ckt-top { display:flex; gap:12px; align-items:flex-start; }
.ckt .cic { width:42px; height:42px; border-radius:12px; display:flex; align-items:center;
  justify-content:center; flex-shrink:0; background:var(--accent-bg); color:var(--accent); }
.ckt .cic svg { width:22px; height:22px; }
.ckt .nm { font-weight:700; font-size:16px; }
.ckt .meta { color:var(--text2); font-size:12.5px; margin-top:3px; }
.ckt .lights { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
.lchip { display:inline-flex; align-items:center; gap:5px; background:var(--card2);
  border:.5px solid var(--sep); border-radius:999px; padding:5px 11px; font-size:12.5px; color:var(--text2); }
.lchip svg { width:13px; height:13px; color:var(--text3); }
.ckt .ft { display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  border-top:.5px solid var(--sep); margin-top:14px; padding-top:13px; }
.ckt .ft .acts { flex-shrink:1; }
.ckt .urg { display:flex; align-items:center; gap:9px; margin-right:auto; min-height:36px; }
.ckt .urg span { font-size:13px; font-weight:600; color:var(--text2); }

/* 向导步骤条 */
.steps { display:flex; align-items:center; gap:6px; margin:4px 0 18px; }
.stp { display:flex; align-items:center; gap:7px; color:var(--text3);
  font-size:12px; font-weight:600; white-space:nowrap; }
.stp .n { width:24px; height:24px; border-radius:50%; background:var(--fill);
  color:var(--text2); display:flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:700; flex-shrink:0; transition:all .18s; }
.stp.cur { color:var(--text); }
.stp.cur .n { background:var(--accent); color:#fff; }
.stp.done .n { background:var(--green); color:#fff; }
.stp .bar { width:100%; min-width:10px; height:2px; border-radius:2px; background:var(--fill); }
@media (max-width:520px) { .stp .slbl { display:none; } }

/* 选择行（向导 radio / checkbox） */
.pick { display:flex; align-items:center; gap:12px; padding:13px 14px; border-radius:14px;
  cursor:pointer; min-height:56px; border:1px solid var(--sep2); background:var(--card);
  margin-bottom:9px; transition:border-color .13s, background .13s, transform .12s; width:100%; text-align:left; }
.pick:active { transform:scale(.985); }
.pick.on { border-color:var(--accent); background:var(--accent-bg); }
.pick .box { width:24px; height:24px; border-radius:50%; border:1.5px solid var(--sep2);
  display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; transition:all .13s; }
.pick .box svg { width:13px; height:13px; opacity:0; }
.pick.on .box { background:var(--accent); border-color:var(--accent); }
.pick.on .box svg { opacity:1; }
.pick .pm { flex:1; min-width:0; }
.pick .pt { display:block; font-weight:600; font-size:14.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pick .pd { display:block; color:var(--text2); font-size:12px; margin-top:1px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pick .pic { width:34px; height:34px; border-radius:10px; background:var(--fill);
  color:var(--text2); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.pick .pic svg { width:18px; height:18px; }
.pick.on .pic { background:var(--card); color:var(--accent); }

/* 设置行 */
.setrow { display:flex; align-items:center; gap:14px; padding:13px 0; border-bottom:.5px solid var(--sep); }
.setrow:last-child { border-bottom:0; }
.setrow .st { flex:1; min-width:0; }
.setrow .st b { font-size:14.5px; font-weight:600; display:block; }
.setrow .st span { font-size:12px; color:var(--text2); display:block; margin-top:2px; line-height:1.45; }
.setrow .uw { display:flex; align-items:center; gap:7px; flex-shrink:0; }
.setrow .uw .inp { width:92px; min-height:40px; }
.setrow .unit { font-size:12.5px; color:var(--text3); width:16px; }

/* 时间窗编辑 */
.winrow { display:flex; align-items:center; gap:8px; padding:7px 0; }
.winrow .inp { flex:1; min-width:0; }
.winrow .dash { color:var(--text3); font-weight:600; }
.winrow .del { width:38px; height:38px; border-radius:50%; background:var(--red-bg); color:var(--red);
  border:0; flex-shrink:0; display:flex; align-items:center; justify-content:center; cursor:pointer;
  transition:transform .12s; }
.winrow .del:active { transform:scale(.9); }
.winrow .del svg { width:15px; height:15px; }

/* 空态 / 提示 */
.empty { text-align:center; padding:40px 22px; color:var(--text2); }
.empty .eic { width:64px; height:64px; border-radius:20px; background:var(--fill);
  color:var(--text3); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
.empty .eic svg { width:30px; height:30px; }
.empty h4 { margin:0 0 6px; color:var(--text); font-size:16.5px; font-weight:700; }
.empty p { margin:0 auto 18px; font-size:13.5px; max-width:420px; line-height:1.6; }
.notice { border-radius:14px; padding:12px 15px; font-size:13.5px; margin-bottom:16px;
  background:var(--accent-bg); color:var(--accent); display:flex; gap:9px; align-items:flex-start; line-height:1.5; }
.notice svg { width:17px; height:17px; flex-shrink:0; margin-top:2px; }
.notice.warn { background:var(--orange-bg); color:var(--orange); }
.notice.err { background:var(--red-bg); color:var(--red); }

/* 骨架屏 */
.sk { border-radius:var(--r); border:.5px solid var(--sep); margin-bottom:16px;
  background:linear-gradient(100deg, var(--card) 30%, var(--card2) 50%, var(--card) 70%);
  background-size:200% 100%; animation:sh 1.4s infinite; }
@keyframes sh { to { background-position:-200% 0; } }

/* 弹层 */
.sheet { position:fixed; inset:0; z-index:60; display:flex; align-items:flex-end; justify-content:center; }
.sheet .mask { position:absolute; inset:0; background:rgba(0,0,0,.38); animation:fin .2s ease; border:0; padding:0; cursor:default; }
.sheet .sbox { position:relative; width:100%; max-width:600px; max-height:88vh; overflow-y:auto;
  background:var(--bg); border-radius:24px 24px 0 0;
  padding:12px 18px calc(22px + env(safe-area-inset-bottom));
  animation:up .3s cubic-bezier(.2,.9,.3,1); box-shadow:var(--shadow-pop); }
@media (min-width:641px) {
  .sheet { align-items:center; padding:24px; }
  .sheet .sbox { border-radius:24px; max-height:84vh; padding:20px 22px 24px; }
}
@keyframes up { from { transform:translateY(44px); opacity:.3; } }
@keyframes fin { from { opacity:0; } }
.grabber { width:38px; height:5px; border-radius:999px; background:var(--text3); margin:2px auto 14px; }
@media (min-width:641px) { .grabber { display:none; } }
.sheet h2 { margin:0 0 4px; font-size:20px; font-weight:800; }
.sheet .sheet-sub { color:var(--text2); font-size:13px; margin-bottom:14px; }
.sheet .ft-btns { display:flex; gap:10px; margin-top:16px; }
.sheet .ft-btns .btn { flex:1; }

/* 确认框 */
.cf .sbox { max-width:330px; text-align:center; padding:24px 20px 16px; background:var(--card); }
.cf h2 { font-size:17px; }
.cf .cf-body { color:var(--text2); font-size:13.5px; margin:8px 0 18px; line-height:1.55; }
.cf .cf-btns { display:flex; gap:10px; }
.cf .cf-btns .btn { flex:1; }

/* 修复流水 */
.logline { display:flex; gap:10px; padding:9px 2px; border-bottom:.5px solid var(--sep);
  font-size:13px; align-items:flex-start; }
.logline:last-child { border-bottom:0; }
.logline .ln { width:20px; height:20px; border-radius:50%; background:var(--fill); color:var(--text2);
  font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center;
  flex-shrink:0; margin-top:1px; }
.res-banner { border-radius:14px; padding:13px 15px; display:flex; align-items:center; gap:10px;
  font-weight:700; font-size:14.5px; margin-bottom:12px; }
.res-banner svg { width:20px; height:20px; }
.res-banner.ok { background:var(--green-bg); color:var(--green); }
.res-banner.err { background:var(--red-bg); color:var(--red); }
.res-banner.warn { background:var(--orange-bg); color:var(--orange); }
.res-banner small { margin-left:auto; font-weight:600; font-size:12.5px; opacity:.85; }

/* 小号 chips（设备卡分类组 / 筛选行） */
.chip-b.xs { min-height:32px; padding:4px 11px; font-size:12px; }
.frow { display:flex; gap:8px; flex-wrap:wrap; margin:2px 0 6px; }
.link-b { border:0; background:none; color:var(--accent); font:inherit; font-size:13px;
  font-weight:600; cursor:pointer; padding:6px 4px; display:inline-flex; align-items:center; gap:4px; }
.link-b svg { width:14px; height:14px; }

/* 自定义分类（灰蓝） */
:host { --steel:#6d7f96; --steel-bg:rgba(109,127,150,.16); }
.ic-steel { background:var(--steel-bg); color:var(--steel); }
.b-steel { background:var(--steel-bg); color:var(--steel); }

/* 房间分组标题（加强层级） */
.gt.room { background:var(--fill); border-radius:12px; padding:8px 12px;
  font-size:14px; color:var(--text); margin:18px 2px 10px; }
.gt.room .cnt { background:var(--card); }

/* 全局控制下的禁用开关 */
.sw input:disabled + i { opacity:.55; }
.ckt .urg em { font-style:normal; color:var(--text3); font-size:11px; margin-left:2px; }

/* 任务运行徽标的计时数字 */
[data-el] { font-variant-numeric:tabular-nums; font-weight:700; }

/* 配方库 */
.prow { display:flex; align-items:flex-start; gap:12px; padding:13px 0; border-bottom:.5px solid var(--sep); }
.prow:last-child { border-bottom:0; }
.prow .pm { flex:1; min-width:0; }
.prow .pmodel { font-weight:700; font-size:14.5px; word-break:break-all; }
.prow .pnote { color:var(--text2); font-size:12px; margin-top:3px; line-height:1.5; }
.prow .pparams { color:var(--text3); font-size:12px; margin-top:3px; line-height:1.5; word-break:break-all; }
.mrow { display:flex; gap:10px; padding:10px 0; border-bottom:.5px solid var(--sep); align-items:flex-start; }
.mrow:last-child { border-bottom:0; }
.mrow .mb { flex-shrink:0; margin-top:1px; }
.mrow .mf { color:var(--text2); font-size:13px; line-height:1.55; }

/* 选择行禁用态（上电状态页不支持的灯具） */
.pick[disabled] { opacity:.58; cursor:default; }
.pick[disabled]:active { transform:none; }
.pick .cur-v { font-weight:600; color:var(--text2); }

/* 长任务进度 / 结论卡 */
.tprog { text-align:center; padding:20px 10px 10px; }
.tprog .bigspin { width:44px; height:44px; border-width:4px; }
.tprog .els { font-size:36px; font-weight:800; letter-spacing:-.5px; margin-top:16px;
  font-variant-numeric:tabular-nums; }
.tprog .cap { color:var(--text2); font-size:13px; margin-top:8px; line-height:1.65; }
.vd { border-radius:16px; padding:15px 16px; margin-bottom:12px; }
.vd.ok { background:var(--green-bg); }
.vd.warn { background:var(--orange-bg); }
.vd .vh { display:flex; align-items:center; gap:9px; font-weight:800; font-size:16px; }
.vd.ok .vh { color:var(--green); }
.vd.warn .vh { color:var(--orange); }
.vd .vh svg { width:22px; height:22px; flex-shrink:0; }
.vd .vh .vel { margin-left:auto; font-size:12px; font-weight:700; opacity:.85; white-space:nowrap; }
.vd .vm { color:var(--text2); font-size:13px; margin-top:8px; line-height:1.6; }
.logline.reveal { animation:vin .3s ease both; }

/* toast */
.toast { position:fixed; left:50%; transform:translateX(-50%); z-index:90;
  bottom:calc(var(--nav-h) + 18px + env(safe-area-inset-bottom));
  background:var(--toast-bg); color:var(--toast-text); padding:11px 20px; border-radius:999px;
  font-size:13.5px; font-weight:600; box-shadow:var(--shadow-pop); animation:tin .25s ease;
  max-width:88vw; text-align:center; display:flex; align-items:center; gap:7px; }
.toast svg { width:15px; height:15px; flex-shrink:0; }
.toast.ok { background:var(--green); color:#fff; }
.toast.err { background:var(--red); color:#fff; }
@media (min-width:641px) { .toast { bottom:32px; } }
@keyframes tin { from { opacity:0; transform:translate(-50%,10px); } }

/* 其他 */
.spin { display:inline-block; width:16px; height:16px; border:2px solid var(--fill2);
  border-top-color:var(--accent); border-radius:50%; animation:rot .8s linear infinite; }
@keyframes rot { to { transform:rotate(360deg); } }
.mono { font-family:ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size:.92em; }
.his .hic { width:30px; height:30px; border-radius:50%; display:flex; align-items:center;
  justify-content:center; flex-shrink:0; }
.his .hic svg { width:15px; height:15px; }
.his .rt { text-align:right; flex-shrink:0; }
.his .dur { font-size:12.5px; font-weight:600; color:var(--text2); }
.his .mtag { font-size:10.5px; color:var(--text3); }
`;

/* ---------------- 图标（内联 SVG，stroke 风格统一） ---------------- */
const _s = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  dash: _s('<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="12" width="7.5" height="9" rx="2"/><rect x="3" y="15.5" width="7.5" height="5.5" rx="2"/>'),
  dev: _s('<path d="M9 2v3M15 2v3M9 19v3M15 19v3M5 9H2M5 15H2M22 9h-3M22 15h-3"/><rect x="6" y="6" width="12" height="12" rx="2.5"/>'),
  link: _s('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  bolt: _s('<path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z"/>'),
  gear: _s('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/>'),
  shield: _s('<path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3z"/><path d="m9 11.6 2.1 2.1 4-4.3"/>'),
  bulb: _s('<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.7.5 1.1 1.3 1.3 2.1h4.4c.2-.8.6-1.6 1.3-2.1A6 6 0 0 0 12 3z"/>'),
  swt: _s('<rect x="3" y="7" width="18" height="10" rx="5"/><circle cx="8.5" cy="12" r="2.3"/>'),
  plug: _s('<path d="M9 7V3.5M15 7V3.5"/><path d="M7 7h10v3.5a5 5 0 0 1-10 0V7z"/><path d="M12 15.5V21"/>'),
  help: _s('<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.9c-.6.3-.9.8-.9 1.5"/><path d="M12 16.9v.1"/>'),
  minus: _s('<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>'),
  search: _s('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>'),
  plus: _s('<path d="M12 5v14M5 12h14"/>'),
  chevR: _s('<path d="m9 6 6 6-6 6"/>'),
  chevD: _s('<path d="m6 9 6 6 6-6"/>'),
  check: _s('<path d="m4.5 12.5 5 5 10-11"/>'),
  x: _s('<path d="M6 6l12 12M18 6 6 18"/>'),
  trash: _s('<path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12"/><path d="M10 11v6M14 11v6"/>'),
  edit: _s('<path d="M4 20h4.2L19.7 8.5a2.05 2.05 0 0 0-2.9-2.9L5.3 17.1 4 20z"/><path d="m13.8 7.5 2.9 2.9"/>'),
  wrench: _s('<path d="M14.9 6.1a4.3 4.3 0 0 0-5.7 5.3L3.6 17a2.4 2.4 0 0 0 3.4 3.4l5.6-5.6a4.3 4.3 0 0 0 5.3-5.7l-2.9 2.9-2.6-2.6 2.5-3.2z"/>'),
  pulse: _s('<path d="M3 12h4l2.5-6.5 4 13L16 12h5"/>'),
  clock: _s('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 1.9"/>'),
  alert: _s('<path d="M12 3.5 2.8 19.5h18.4L12 3.5z"/><path d="M12 10v4.2M12 17.4v.1"/>'),
  refresh: _s('<path d="M20 12a8 8 0 1 1-2.34-5.66M20 3.5V8h-4.5"/>'),
  info: _s('<circle cx="12" cy="12" r="8.5"/><path d="M12 11.2V16M12 7.9v.1"/>'),
  bell: _s('<path d="M6.2 9.2a5.8 5.8 0 1 1 11.6 0c0 4.6 1.9 5.8 1.9 5.8H4.3s1.9-1.2 1.9-5.8"/><path d="M10.2 19a1.9 1.9 0 0 0 3.6 0"/>'),
  okc: _s('<circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.4 2.6 2.6 5-5.4"/>'),
  errc: _s('<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>'),
  curtain: _s('<path d="M4 3.5h16"/><path d="M5.5 3.5v17M18.5 3.5v17"/><path d="M5.5 3.5c2.8 2 2.8 15 0 17M18.5 3.5c-2.8 2-2.8 15 0 17"/>'),
  sensor: _s('<circle cx="12" cy="13" r="2"/><path d="M8 9a5.6 5.6 0 0 0 0 8M16 9a5.6 5.6 0 0 1 0 8M5 6a9.6 9.6 0 0 0 0 14M19 6a9.6 9.6 0 0 1 0 14"/>'),
  tv: _s('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M9 21h6"/>'),
  speaker: _s('<rect x="7" y="3" width="10" height="18" rx="2.5"/><circle cx="12" cy="14.5" r="3"/><path d="M12 7.2v.1"/>'),
  ac: _s('<rect x="3" y="4" width="18" height="8" rx="2"/><path d="M7 8h7"/><path d="M7 16c0 1.4-.8 1.8-.8 3.2M12 16c0 1.4-.8 1.8-.8 3.2M17 16c0 1.4-.8 1.8-.8 3.2"/>'),
  appliance: _s('<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M5 8.5h14"/><circle cx="12" cy="14.5" r="3.2"/><path d="M8 5.8h2"/>'),
  wand: _s('<path d="m6 21 9.5-9.5M14 4l1 2.5L17.5 7 15 8l-1 2.5L13 8l-2.5-1L13 5.5 14 4zM19 11l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z"/>'),
  tag: _s('<path d="M3.5 12.5V5a1.5 1.5 0 0 1 1.5-1.5h7.5a2 2 0 0 1 1.4.6l6.5 6.5a2 2 0 0 1 0 2.8l-5.6 5.6a2 2 0 0 1-2.8 0l-6.5-6.5a2 2 0 0 1-.5-1.4z"/><circle cx="8.5" cy="8.5" r="1.4"/>'),
  book: _s('<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17.5H7.5A2.5 2.5 0 0 0 5 22V4.5z"/><path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H19"/><path d="M9 7h6"/>'),
};

/* ---------------- 常量 ---------------- */
const TABS = [
  ["dash", "总览", "总览", I.dash],
  ["devices", "设备识别", "识别", I.dev],
  ["circuits", "接线映射", "映射", I.link],
  ["poweron", "上电状态", "上电", I.bolt],
  ["profiles", "配方库", "配方", I.book],
  ["settings", "设置", "设置", I.gear],
];

const CLASS_LABEL = {
  light: "灯具", wall_switch: "墙开", actuator: "执行器", uncertain: "待确认",
  curtain: "窗帘", sensor: "传感器", tv: "电视", speaker: "音箱",
  ac: "空调", appliance: "家用电器", ignore: "忽略",
};
const CLASS_ORDER = ["light", "wall_switch", "actuator", "uncertain", "curtain", "sensor", "tv", "speaker", "ac", "appliance", "ignore"];
const OTHER_CLASSES = ["curtain", "sensor", "tv", "speaker", "ac", "appliance", "ignore"];
const CLS_FILTERS = [["all", "全部"], ["light", "灯具"], ["wall_switch", "墙开"], ["actuator", "执行器"], ["uncertain", "待确认"], ["other", "其他"]];
const CLASS_ICON = {
  light: I.bulb, wall_switch: I.swt, actuator: I.plug, uncertain: I.help,
  curtain: I.curtain, sensor: I.sensor, tv: I.tv, speaker: I.speaker,
  ac: I.ac, appliance: I.appliance, ignore: I.minus,
};
const CLASS_IC = {
  light: "ic-blue", wall_switch: "ic-purple", actuator: "ic-orange", uncertain: "ic-red",
  curtain: "ic-orange", sensor: "ic-green", tv: "ic-gray", speaker: "ic-purple",
  ac: "ic-blue", appliance: "ic-gray", ignore: "ic-gray",
};
const METHOD_LABEL = { direct: "直断法", select: "模式切换法", number: "参数法" };
const GU_MODES = [
  ["follow", "跟随单回路", "默认"],
  ["on", "全部开启", "掉线立即修复"],
  ["off", "全部关闭", "仅排队等时间窗"],
];

const STATE_META = {
  ok: ["正常", "b-green", false],
  offline: ["已掉线", "b-red", false],
  queued: ["排队修复", "b-orange", false],
  repairing: ["修复中", "b-blue", true],
  failed: ["需人工", "b-red", false],
};
const CONF_META = { high: ["高置信", "b-green"], medium: ["中置信", "b-orange"], low: ["低置信", "b-gray"] };
const HIST_META = {
  success: ["恢复成功", "ic-green", I.okc],
  failed: ["恢复失败", "ic-red", I.errc],
  mode_restore_failed: ["已恢复·模式还原失败", "ic-orange", I.alert],
};
const POWER_MODES = [
  ["断电记忆", "推荐 · 修复无感"],
  ["来电开灯", "复电即点亮"],
  ["来电关灯", "复电保持熄灭"],
];
const WIZ_STEPS = ["选开关", "选按键", "选灯具", "命名保存"];

/* ---------------- 工具 ---------------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const splitWin = (w) => { const p = String(w || "").split("-"); return [p[0] || "13:00", p[1] || "14:00"]; };

/* ================= 组件 ================= */
class MeshGuardPanel extends HTMLElement {
  constructor() {
    super();
    this._tab = "dash";
    this._devices = null;
    this._circuits = null;
    this._scheduler = null;
    this._history = [];
    this._settings = null;
    this._scanning = false;
    this._search = "";
    this._collapsed = {};
    this._pmode = "断电记忆";
    this._pResults = null;
    this._pBusy = false;
    this._lamps = null;        // 上电状态清单
    this._lampsLoading = false;
    this._lampSel = new Set(); // 上电状态页勾选的 device_id
    this._clsFilter = "all";   // 设备识别分类筛选
    this._tasks = [];          // 后台维护任务（verify/probe）
    this._tasksInit = false;
    this._dismissed = new Set();  // 已见过的终态任务 id
    this._doneCards = {};      // circuit_id -> 任务结论卡
    this._profiles = null;     // {switch_profiles, lamp_profiles}
    this._customClasses = [];  // [{key,label}]
    this._clsMgr = false;      // 分类管理弹层
    this._prof = null;         // 配方编辑弹层
    this._wiz = null;        // 回路向导（新建/编辑）
    this._log = null;        // 修复执行流水
    this._cf = null;         // 确认框
    this._toast = null;      // {msg, kind}
    this._setDraft = {};     // 设置页未保存草稿
    this._wins = null;       // 时间窗草稿
    this._unsub = null;
    this._fade = false;
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
      this.shadowRoot.addEventListener("input", (e) => this._onInput(e));
      this.shadowRoot.addEventListener("change", (e) => this._onChange(e));
    }
    this._render();
    this._boot();
  }
  disconnectedCallback() {
    if (this._elt) { clearInterval(this._elt); this._elt = null; }
    if (this._unsub) { try { this._unsub(); } catch (_) {} }
  }

  async _boot() {
    if (this._scheduler) return;
    if (!this.hass) { this._bt = setTimeout(() => this._boot(), 300); return; }
    clearTimeout(this._bt);
    await this._refreshAll();
    this._subscribe();
    this._loadProfiles();
  }

  _call(payload) { return this.hass.callWS(payload); }

  async _refreshAll() {
    await Promise.all([this._loadStatus(), this._loadCircuits(), this._loadSettings()]);
    this._render();
  }
  async _loadStatus() {
    try {
      const r = await this._call({ type: `${DOMAIN}/status` });
      this._scheduler = r.scheduler; this._history = r.history || [];
      if (r.circuits) this._circuits = r.circuits;
      this._syncTasks(r.tasks || []);
    } catch (e) { console.warn("mesh_guard status:", e); }
  }
  async _loadCircuits() {
    try {
      const r = await this._call({ type: `${DOMAIN}/get_circuits` });
      this._circuits = r.circuits || [];
      if (r.scheduler) this._scheduler = r.scheduler;
    } catch (e) { console.warn("mesh_guard circuits:", e); }
  }
  async _loadSettings() {
    try {
      this._settings = await this._call({ type: `${DOMAIN}/get_settings` });
      if (!this._wins) this._wins = [...(this._settings.repair_windows || [])];
      this._customClasses = Array.isArray(this._settings.custom_classes) ? this._settings.custom_classes : [];
    } catch (e) { console.warn("mesh_guard settings:", e); }
  }
  async _loadProfiles() {
    try {
      const r = await this._call({ type: `${DOMAIN}/profiles_list` });
      this._profiles = { switch: r.switch_profiles || {}, lamp: r.lamp_profiles || {} };
      this._render();
    } catch (e) { console.warn("mesh_guard profiles:", e); }
  }

  /* ---------------- 后台任务（verify/probe） ---------------- */
  _syncTasks(list) {
    const now = Date.now();
    for (const t of list) {
      if (t.status === "running") { t._elBase = t.elapsed || 0; t._elAt = now; }
    }
    this._tasks = list;
    if (!this._tasksInit) {  // 首次同步：终态任务不弹结论卡
      this._tasksInit = true;
      for (const t of list) if (t.status !== "running") this._dismissed.add(t.id);
    } else {
      for (const t of list) {
        if (t.status !== "running" && !this._dismissed.has(t.id)) {
          this._dismissed.add(t.id);
          this._doneCards[t.circuit_id] = { kind: t.kind, status: t.status, result: t.result || {} };
        }
      }
    }
    this._ensureElTimer();
  }
  _upsertTask(t) {
    if (!t) return;
    const i = this._tasks.findIndex((x) => x.id === t.id);
    if (i >= 0) this._tasks[i] = t; else this._tasks.unshift(t);
    if (t.status === "running") { t._elBase = t.elapsed || 0; t._elAt = Date.now(); }
    this._ensureElTimer();
  }
  _runningTask(cid) {
    return (this._tasks || []).find((t) => t.circuit_id === cid && t.status === "running");
  }
  _ensureElTimer() {
    const running = (this._tasks || []).some((t) => t.status === "running");
    if (running && !this._elt) {
      this._elt = setInterval(() => this._tickElapsed(), 1000);
    } else if (!running && this._elt) {
      clearInterval(this._elt); this._elt = null;
    }
  }
  _tickElapsed() {
    // 仅更新计时文本节点，不做整页重绘（消除频闪）
    const now = Date.now();
    for (const t of this._tasks || []) {
      if (t.status !== "running") continue;
      const el = Math.floor((t._elBase || 0) + (now - (t._elAt || now)) / 1000);
      const txt = `${Math.floor(el / 60)}:${String(el % 60).padStart(2, "0")}`;
      this.shadowRoot.querySelectorAll(`[data-el="${t.id}"]`).forEach((n) => { n.textContent = txt; });
    }
  }
  async _scan(silent) {
    if (this._scanning) return;
    this._scanning = true; if (!silent) this._render(); else this._render();
    try {
      const r = await this._call({ type: `${DOMAIN}/scan` });
      this._devices = r.devices || [];
    } catch (e) { this._toastMsg("扫描失败：" + (e.message || e), "err"); }
    this._scanning = false; this._render();
  }

  _subscribe() {
    try {
      this.hass.connection.subscribeMessage(
        (ev) => {
          if (!ev) return;
          if (ev.scheduler) { this._scheduler = ev.scheduler; }
          if (ev.tasks) this._syncTasks(ev.tasks);
          this._maybeRender();
        },
        { type: `${DOMAIN}/subscribe` }
      ).then((unsub) => { this._unsub = unsub; }).catch(() => {});
    } catch (_) {}
  }

  _toastMsg(msg, kind) {
    // 纯 DOM 挂载/更新 toast，不触发整页重绘（消灭闪烁）
    clearTimeout(this._tt);
    let el = this.shadowRoot.querySelector(":scope > .toast");
    if (!el) { el = document.createElement("div"); this.shadowRoot.appendChild(el); }
    el.className = `toast ${kind || ""}`;
    el.innerHTML = `${kind === "ok" ? I.check : kind === "err" ? I.alert : ""}${esc(msg)}`;
    this._tt = setTimeout(() => { el.remove(); }, 2800);
  }

  _maybeRender() {
    // 弹层（向导/配方/分类管理/确认框/流水）打开期间，推送仅静默更新数据；
    // 弹层关闭时各 close 路径会立即 _render，自然应用最新数据。
    if (this._wiz || this._prof || this._clsMgr || this._cf || this._log) { this._dirty = true; return; }
    this._render();
  }

  _confirm({ title, body, okText = "确认", danger = false, hideCancel = false }) {
    return new Promise((res) => {
      this._cf = { title, body, okText, danger, hideCancel, res };
      this._render();
    });
  }
  _cfDone(v) {
    const cf = this._cf; this._cf = null;
    this._render();
    if (cf) cf.res(v);
  }

  _setTab(t) {
    if (t === this._tab) return;
    this._tab = t;
    this._fade = true;
    if (t === "devices" && !this._devices && !this._scanning) this._scan();
    if (t === "circuits" && !this._devices && !this._scanning) this._scan(true);
    if (t === "poweron" && !this._lamps && !this._lampsLoading) this._loadLamps();
    if (t === "profiles" && !this._profiles) this._loadProfiles();
    this._render();
  }

  async _loadLamps() {
    if (this._lampsLoading) return;
    this._lampsLoading = true; this._render();
    try {
      const r = await this._call({ type: `${DOMAIN}/poweron_list` });
      this._lamps = r.lamps || [];
      const valid = new Set(this._lamps.filter((l) => l.supported).map((l) => l.device_id));
      this._lampSel = new Set([...this._lampSel].filter((id) => valid.has(id)));
    } catch (e) { this._toastMsg("加载灯具清单失败：" + (e.message || e), "err"); }
    this._lampsLoading = false; this._render();
  }

  /* ================= 渲染 ================= */
  _render() {
    if (!this.shadowRoot) return;
    // 重绘前记录焦点，绘后恢复（避免推送刷新打断输入）
    const ae = this.shadowRoot.activeElement;
    const fk = ae && ae.dataset && ae.dataset.k ? ae.dataset.k : null;
    const sel = fk && ae.setSelectionRange ? [ae.selectionStart, ae.selectionEnd] : null;

    const fade = this._fade; this._fade = false;
    const site = (this._settings && this._settings.site_name) || "";
    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <div class="app">
        <header class="hd">
          <div class="hd-top">
            <div class="logo">${I.shield}</div>
            ${site ? `<span class="hd-site">${esc(site)}</span>` : ""}
          </div>
          <h1>灯具守护</h1>
          <div class="sub">${this._subLine()}</div>
        </header>
        <nav class="tabs">${TABS.map(([id, lb]) =>
          `<button data-tab="${id}" class="${this._tab === id ? "on" : ""}">${lb}</button>`).join("")}
        </nav>
        <main class="view${fade ? " fade" : ""}">${this._view()}</main>
      </div>
      <nav class="bnav">${TABS.map(([id, , slb, icon]) =>
        `<button data-tab="${id}" class="${this._tab === id ? "on" : ""}">${icon}<span>${slb}</span></button>`).join("")}
      </nav>
      ${this._wiz ? this._wizardSheet() : ""}
      ${this._log ? this._logSheet() : ""}
      ${this._clsMgr ? this._clsMgrSheet() : ""}
      ${this._prof ? this._profSheet() : ""}
      ${this._cf ? this._cfSheet() : ""}`;

    if (fk) {
      const el = this.shadowRoot.querySelector(`[data-k="${fk}"]`);
      if (el) { el.focus(); if (sel) { try { el.setSelectionRange(sel[0], sel[1]); } catch (_) {} } }
    }
  }

  _subLine() {
    const sch = this._scheduler;
    if (!sch) return `<span class="ldot warn"></span>正在连接 Home Assistant…`;
    const bad = Object.values(sch.states || {}).filter((s) => ["offline", "failed"].includes(s)).length;
    const q = (sch.queue || []).length;
    const parts = [`${(this._circuits || []).length} 条回路`];
    if (bad) parts.push(`${bad} 条异常`);
    if (q) parts.push(`${q} 条排队`);
    return `<span class="ldot${bad ? " warn" : ""}"></span>米家 BLE Mesh 掉线自愈 · ${parts.join(" · ") || "运行正常"}`;
  }

  _view() {
    switch (this._tab) {
      case "devices": return this._vDevices();
      case "circuits": return this._vCircuits();
      case "poweron": return this._vPowerOn();
      case "profiles": return this._vProfiles();
      case "settings": return this._vSettings();
      default: return this._vDash();
    }
  }

  _skeleton() {
    return `<div class="sk" style="height:96px"></div><div class="sk" style="height:64px"></div>
      <div class="sk" style="height:140px"></div><div class="sk" style="height:140px"></div>`;
  }

  /* ---------------- 总览 ---------------- */
  _vDash() {
    if (!this._scheduler) return this._skeleton();
    const sch = this._scheduler;
    const circuits = this._circuits || [];
    const states = sch.states || {};
    const nLights = circuits.reduce((a, c) => a + (c.lights || []).length, 0);
    const nBad = Object.values(states).filter((s) => ["offline", "failed"].includes(s)).length;
    const nQueue = (sch.queue || []).length;
    const inWin = !!sch.in_window;
    const stat = (ic, icon, num, lbl, numStyle = "") => `
      <div class="stat"><div class="ic ${ic}">${icon}</div>
        <div class="num" style="${numStyle}">${num}</div><div class="lbl">${lbl}</div></div>`;
    return `
      <div class="stats">
        ${stat("ic-blue", I.bulb, nLights, "监测灯具")}
        ${stat("ic-purple", I.link, circuits.length, "供电回路")}
        ${stat(nBad ? "ic-red" : "ic-green", nBad ? I.alert : I.okc, nBad, "异常回路", nBad ? "color:var(--red)" : "")}
        ${stat(nQueue ? "ic-orange" : "ic-gray", I.clock, nQueue, "修复队列")}
      </div>
      ${nQueue && !inWin ? `<div class="notice warn">${I.clock}<div>${nQueue} 条修复排队中，将在 ${esc(sch.next_window || "下一时间窗")} 自动执行。点亮「随时修复」的回路不受时间窗限制。</div></div>` : ""}
      <div class="card">
        <div class="li" style="padding-top:2px">
          <div class="stat" style="padding:0;border:0;box-shadow:none;background:none">
            <div class="ic ${inWin ? "ic-green" : "ic-gray"}">${I.clock}</div>
          </div>
          <div class="main" style="flex:1;min-width:0">
            <div class="tt">修复时间窗</div>
            <div class="ds">${(sch.windows || []).length ? (sch.windows || []).map(esc).join("　·　") : "未设置"}</div>
          </div>
          <span class="bd ${inWin ? "b-green pulse" : "b-gray"}"><span class="d"></span>${inWin ? "窗口进行中" : "窗口外"}</span>
        </div>
        <div class="li" style="padding-bottom:2px">
          <div class="main"><div class="tt" style="font-weight:500;color:var(--text2)">下一窗口</div></div>
          <span style="font-weight:600;font-size:14px">${esc(sch.next_window || "-")}</span>
        </div>
      </div>
      <div id="cktwrap">${this._cktSection()}</div>
      <div class="gt" as="div"><span>最近修复记录</span>
        ${(this._history || []).length ? `<span style="margin-left:auto"><button class="btn gray sm" data-act="clearhist">${I.trash} 清空</button></span>` : ""}
      </div>
      <div class="card his" style="padding-top:6px;padding-bottom:6px">
        ${(this._history || []).length ? this._history.slice().reverse().map((h) => this._histRow(h)).join("") : `
          <div class="empty" style="padding:28px 12px">
            <div class="eic" style="width:52px;height:52px">${I.clock}</div>
            <p style="margin:0">暂无修复记录</p>
          </div>`}
      </div>`;
  }

  _cktSection() {
    const circuits = this._circuits || [];
    const states = (this._scheduler || {}).states || {};
    return `<button class="gt${this._collapsed["dash-ckts"] ? " closed" : ""}" data-act="fold" data-id="dash-ckts">
        <span>回路状态</span><span class="cnt">${circuits.length}</span><span class="chev">${I.chevD}</span>
      </button>
      ${this._collapsed["dash-ckts"] ? this._cktsSummary(circuits, states) :
        circuits.length ? circuits.map((c) => this._circuitCard(c, states[c.id], "dash")).join("") : `
        <div class="card empty">
          <div class="eic">${I.link}</div>
          <h4>还没有供电回路</h4>
          <p>前往「接线映射」，把灯具指派给控制它供电的开关按键，守护才能生效。</p>
          <button class="btn" data-act="goto-circuits">${I.plus} 去建回路</button>
        </div>`}`;
  }

  _cktsSummary(circuits, states) {
    const cnt = { ok: 0, queued: 0, repairing: 0, bad: 0 };
    for (const c of circuits) {
      const s = states[c.id] || "ok";
      if (s === "ok") cnt.ok++;
      else if (s === "queued") cnt.queued++;
      else if (s === "repairing") cnt.repairing++;
      else cnt.bad++;
    }
    return `<div class="card" style="display:flex;gap:8px;flex-wrap:wrap;padding:13px 16px">
      <span class="bd b-green"><span class="d"></span>正常 ${cnt.ok}</span>
      <span class="bd b-orange"><span class="d"></span>排队 ${cnt.queued}</span>
      <span class="bd b-blue"><span class="d"></span>修复中 ${cnt.repairing}</span>
      <span class="bd b-red"><span class="d"></span>异常 ${cnt.bad}</span>
      ${!circuits.length ? '<span style="color:var(--text3);font-size:12.5px">暂无回路</span>' : ""}
    </div>`;
  }

  _histRow(h) {
    const [lb, ic, icon] = HIST_META[h.status] || [h.status, "ic-gray", I.info];
    return `<div class="li">
      <div class="hic ${ic}">${icon}</div>
      <div class="main">
        <div class="tt">${esc(h.circuit)} <span style="font-weight:500;color:var(--text2);font-size:12.5px">· ${lb}</span></div>
        <div class="ds">${esc(h.ts)}${h.manual ? " · 手动触发" : ""}</div>
      </div>
      <div class="rt"><div class="dur">${Math.round(h.duration || 0)}s</div>${h.manual ? `<div class="mtag">手动</div>` : ""}</div>
    </div>`;
  }

  _methodBadge(model) {
    const p = (this._profiles?.switch || {})[model];
    if (!p) return [`未探型`, "b-gray", ""];
    const bd = { direct: "b-green", select: "b-purple", number: "b-orange" }[p.method] || "b-blue";
    return [METHOD_LABEL[p.method] || p.method, bd, p.note || ""];
  }

  _circuitCard(c, state, ctx) {
    const [lb, badge, pulse] = STATE_META[state || "ok"] || STATE_META.ok;
    const lampNames = (c.lights || []).map((le) => this._lampName(le));
    const rt = this._runningTask(c.id);
    const rtBadge = rt ? `<span class="bd b-blue pulse"><span class="d"></span>${rt.kind === "verify" ? "验证中" : "探型中"}&nbsp;<span data-el="${rt.id}">-:--</span></span>` : "";
    const rtStop = rt ? `<button class="btn sm red" data-act="task-stop" data-id="${rt.id}">${I.x} 停止</button>` : "";
    const [mLb, mBd, mNote] = this._methodBadge(c.switch_model);
    const gu = (this._scheduler || {}).global_urgent || "follow";
    const forced = gu !== "follow";
    const urgOn = forced ? gu === "on" : !!c.urgent;
    const urgSwitch = `<label class="urg">
        <span class="sw"><input type="checkbox" data-urgent="${esc(c.id)}" ${urgOn ? "checked" : ""} ${forced ? "disabled" : ""}><i></i></span>
        <span>随时修复${forced ? "<em>由全局设置控制</em>" : ""}</span>
      </label>`;
    const methodRow = `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap">
        <span class="bd ${mBd}" style="font-size:11px;padding:3px 9px">${esc(mLb)}</span>
        ${mNote ? `<span style="color:var(--text3);font-size:11.5px">${esc(mNote)}</span>` : ""}
      </div>`;
    let card;
    if (ctx === "dash") {
      card = `<div class="card ckt">
        <div class="ckt-top">
          <div class="cic">${I.link}</div>
          <div class="main" style="flex:1;min-width:0">
            <div class="nm">${esc(c.name)}</div>
            <div class="meta">${(c.lights || []).length} 个灯具 · ${esc(c.relay_entity || "")}</div>
            ${methodRow}
          </div>
          <span class="bd ${badge}${pulse ? " pulse" : ""}"><span class="d"></span>${lb}</span>
        </div>
        <div class="acts" style="justify-content:flex-start;margin-top:12px">
          ${rtBadge}${rtStop}
          <button class="btn sm" data-act="repair" data-id="${esc(c.id)}" ${state === "repairing" || rt ? "disabled" : ""}>${I.wrench} 立即修复</button>
          <button class="btn sm tint" data-act="verify" data-id="${esc(c.id)}" ${rt ? "disabled" : ""}>${I.pulse} 验证通断</button>
          <button class="btn sm gray" data-act="edit" data-id="${esc(c.id)}">${I.edit} 编辑</button>
        </div>
      </div>`;
    } else {
      card = `<div class="card ckt">
        <div class="ckt-top">
          <div class="cic">${I.link}</div>
          <div class="main" style="flex:1;min-width:0">
            <div class="nm">${esc(c.name)}</div>
            <div class="meta">${esc(c.switch_model || "")} · 按键${c.button ?? "-"} · <span class="mono">${esc(c.relay_entity || "")}</span></div>
            ${methodRow}
          </div>
          <span class="bd ${badge}${pulse ? " pulse" : ""}"><span class="d"></span>${lb}</span>
        </div>
        <div class="lights">${lampNames.map((n) => `<span class="lchip">${I.bulb}${esc(n)}</span>`).join("")}</div>
        <div class="ft">
          ${urgSwitch}
          <div class="acts">
            ${rtBadge}${rtStop}
            <button class="btn sm tint" data-act="verify" data-id="${esc(c.id)}" ${rt ? "disabled" : ""}>${I.pulse} 验证通断</button>
            <button class="btn sm tint" data-act="probe" data-id="${esc(c.id)}" ${rt ? "disabled" : ""}>${I.wand} 探型</button>
            <button class="btn sm gray" data-act="edit" data-id="${esc(c.id)}">${I.edit} 编辑</button>
            <button class="btn sm red" data-act="del" data-id="${esc(c.id)}">${I.trash}</button>
          </div>
        </div>
      </div>`;
    }
    return card + this._taskCard(c);
  }

  _taskCard(c) {
    const d = this._doneCards[c.id];
    if (!d) return "";
    const r = d.result || {};
    const close = `<button class="btn gray sm" data-act="dcard" data-id="${esc(c.id)}">关闭</button>`;
    let inner;
    if (d.status === "stopped") {
      inner = `<div class="vd" style="background:var(--gray-bg)">
        <div class="vh" style="color:var(--gray)">${I.minus}已手动停止</div>
        <div class="vm">${esc(r.msg || "继电器与模式已自动恢复")}</div></div>
        <div class="acts" style="justify-content:flex-end">${close}</div>`;
    } else if (d.status === "error") {
      inner = `<div class="vd warn">
        <div class="vh">${I.alert}任务出错</div>
        <div class="vm">${esc(r.msg || "未知错误")}</div></div>
        <div class="acts" style="justify-content:flex-end">${close}</div>`;
    } else if (d.kind === "verify") {
      const good = r.ok && r.verdict === "success";
      inner = `<div class="vd ${good ? "ok" : "warn"}">
        <div class="vh">${good ? I.okc : I.alert}${good ? "验证通过：映射与直断均有效" : "断电后灯具未失联"}
          <span class="vel">耗时 ${Math.round(r.elapsed || 0)}s</span></div>
        <div class="vm">${esc(r.msg || "")}</div></div>
        <div class="acts" style="justify-content:flex-end">
          ${good ? "" : `<button class="btn sm" data-act="probe" data-id="${esc(c.id)}">${I.wand} 自动探型</button>`}${close}
        </div>`;
    } else {
      inner = `<div class="vd ${r.ok ? "ok" : "warn"}">
        <div class="vh">${r.ok ? I.okc : I.alert}${r.ok ? `探型完成：习得【${METHOD_LABEL[r.method] || r.method}】` : "自动探型未成功"}</div>
        ${r.ok ? "" : `<div class="vm">建议使用「学习模式」或联系支持。</div>`}</div>
        ${(r.steps || []).length ? `<div class="card" style="box-shadow:none;background:var(--card2);margin:0 0 10px;padding:6px 14px">
          ${r.steps.map((s, i) => `<div class="logline"><span class="ln">${i + 1}</span><span>${esc(s)}</span></div>`).join("")}
        </div>` : ""}
        <div class="acts" style="justify-content:flex-end">${close}</div>`;
    }
    return `<div class="card" style="padding:14px 16px">${inner}</div>`;
  }

  _lampName(le) {
    const d = (this._devices || []).find((x) => x.light_entity === le);
    return d ? d.name : le;
  }

  /* ---------------- 设备识别 ---------------- */
  _vDevices() {
    if (this._scanning && !this._devices) {
      return `<div class="card empty"><div class="eic"><span class="spin" style="width:26px;height:26px;border-width:3px"></span></div>
        <h4>正在扫描设备</h4><p style="margin-bottom:0">从 xiaomi_home 拉取全部 BLE Mesh 设备并自动分类…</p></div>`;
    }
    if (!this._devices) {
      return `<div class="card empty">
        <div class="eic">${I.search}</div>
        <h4>先扫描一次设备</h4>
        <p>扫描 xiaomi_home 接入的全部设备，按「灯具 / 墙开 / 执行器 / 忽略」自动分类，人工可再校正。</p>
        <button class="btn xl" data-act="scan">${I.search} 开始扫描</button>
      </div>`;
    }
    return `
      <div style="display:flex;gap:10px;margin-bottom:8px;align-items:stretch">
        <div style="position:relative;flex:1">
          <span style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--text3);width:16px;height:16px">${I.search}</span>
          <input class="inp" style="padding-left:38px" type="text" data-k="search" placeholder="搜索名称 / 型号 / 厂商 / 房间" value="${esc(this._search)}">
        </div>
        <button class="btn tint" data-act="scan" ${this._scanning ? "disabled" : ""}>${this._scanning ? '<span class="spin"></span>' : I.refresh} 重扫</button>
      </div>
      <div class="frow">${CLS_FILTERS.map(([v, lb]) =>
        `<button class="chip-b${this._clsFilter === v ? " on" : ""}" data-filter="${v}">${lb}</button>`).join("")}
        <span style="margin-left:auto"></span>
        <button class="link-b" data-act="clsmgr-open">${I.gear} 管理分类</button>
      </div>
      <div id="devwrap">${this._devGroups()}</div>`;
  }

  _clsLabel(cls) {
    if (CLASS_LABEL[cls]) return CLASS_LABEL[cls];
    const cc = this._customClasses.find((x) => x.key === cls);
    return cc ? cc.label : cls;
  }
  _clsOrderIdx(cls) {
    const i = CLASS_ORDER.indexOf(cls);
    if (i >= 0) return i;
    const j = this._customClasses.findIndex((x) => x.key === cls);
    return j >= 0 ? 100 + j : 999;
  }
  _clsIcon(cls) {
    if (CLASS_ICON[cls]) return CLASS_ICON[cls];
    return this._customClasses.some((x) => x.key === cls) ? I.tag : I.help;
  }
  _clsIc(cls) {
    if (CLASS_IC[cls]) return CLASS_IC[cls];
    return this._customClasses.some((x) => x.key === cls) ? "ic-steel" : "ic-gray";
  }

  _matchDev(d, q, f) {
    if (q && !`${d.name} ${d.model} ${d.manufacturer} ${d.area_name || ""}`.toLowerCase().includes(q)) return false;
    if (f === "all") return true;
    if (f === "other") return OTHER_CLASSES.includes(d.classification) || !CLASS_LABEL[d.classification];
    return d.classification === f;
  }

  _devGroups() {
    const q = this._search.trim().toLowerCase();
    if (!q && this._clsFilter === "all" && !(this._devices || []).length) {
      return `<div class="card empty"><div class="eic">${I.search}</div><h4>没有扫描到设备</h4>
        <p style="margin-bottom:0">请确认 xiaomi_home 集成已接入米家 BLE Mesh 设备，然后重新扫描。</p></div>`;
    }
    const rooms = {};
    for (const d of this._devices || []) {
      if (!this._matchDev(d, q, this._clsFilter)) continue;
      const r = d.area_name || "未分配房间";
      (rooms[r] = rooms[r] || []).push(d);
    }
    const names = Object.keys(rooms).sort((a, b) =>
      (a === "未分配房间") - (b === "未分配房间") || a.localeCompare(b, "zh-Hans-CN"));
    if (!names.length) {
      return `<div class="card empty"><div class="eic">${I.search}</div><h4>没有匹配的设备</h4><p style="margin-bottom:0">换个关键词或分类筛选试试</p></div>`;
    }
    return names.map((r) => {
      const devs = rooms[r].sort((a, b) =>
        (a.online === false) - (b.online === false) ||
        this._clsOrderIdx(a.classification) - this._clsOrderIdx(b.classification) ||
        String(a.name).localeCompare(String(b.name), "zh-Hans-CN"));
      const key = `rm:${r}`;
      const closed = !!this._collapsed[key];
      return `<button class="gt room${closed ? " closed" : ""}" data-act="fold" data-id="${esc(key)}">
          <span>${esc(r)}</span><span class="cnt">${devs.length}</span>
          <span class="chev">${I.chevD}</span>
        </button>
        ${closed ? "" : devs.map((d) => this._devCard(d)).join("")}`;
    }).join("");
  }

  _devCard(d) {
    const [confLb, confBd] = CONF_META[d.confidence] || ["", "b-gray"];
    const cur = d.manual ? d.classification : "auto";
    const chip = (val, lb) => `<button class="chip-b xs${cur === val ? " on" : ""}${val === "auto" && cur === "auto" ? " on-auto" : ""}"
      data-cls-dev="${esc(d.device_id)}" data-cls-val="${val}">${lb}</button>`;
    return `<div class="card dev">
      <div class="top">
        <div class="dic ${this._clsIc(d.classification)}">${this._clsIcon(d.classification)}</div>
        <div class="main" style="flex:1;min-width:0">
          <div class="nm">${esc(d.name)}
            <span class="bd ${CLASS_LABEL[d.classification] ? (CLASS_IC[d.classification] === "ic-gray" ? "b-gray" : "b-blue") : "b-steel"}" style="font-size:10.5px;padding:2px 8px">${esc(this._clsLabel(d.classification))}</span>
            ${d.manual ? `<span class="bd b-blue" style="font-size:10.5px;padding:2px 8px">人工</span>` : ""}
            ${d.online === false ? `<span class="bd b-gray" style="font-size:10.5px;padding:2px 8px"><span class="d"></span>离线</span>` : ""}
          </div>
          <div class="meta mono">${esc(d.model)} · ${esc(d.manufacturer)}</div>
          ${(d.reasons || []).length ? `<div class="rsn">${d.reasons.map(esc).join("；")}</div>` : ""}
        </div>
        <span class="bd ${confBd}">${confLb}</span>
      </div>
      <div class="cls-row">
        <span class="cls-lb">分类</span>
        ${CLASS_ORDER.map((c) => chip(c, CLASS_LABEL[c])).join("")}${this._customClasses.map((c) => chip(c.key, c.label)).join("")}${chip("auto", "自动")}
      </div>
    </div>`;
  }

  /* ---------------- 接线映射 ---------------- */
  _vCircuits() {
    if (!this._circuits) return this._skeleton();
    const circuits = this._circuits;
    const states = (this._scheduler || {}).states || {};
    const gu = (this._scheduler || {}).global_urgent || "follow";
    return `
      <div class="notice">${I.info}<div>把灯具指派给「控制它供电的开关按键」形成回路。建好后请用「验证通断」现场确认接线关系，守护才会准确断电修复。</div></div>
      <div class="card">
        <h3>随时修复（全局）</h3>
        <div class="seg">
          ${GU_MODES.map(([v, lb, sub]) => `<button data-gu="${v}" class="${gu === v ? "on" : ""}">${lb}<small>${sub}</small></button>`).join("")}
        </div>
        <div class="hint">全局设置优先于各回路下方的「随时修复」开关。</div>
      </div>
      ${circuits.map((c) => this._circuitCard(c, states[c.id], "map")).join("")}
      ${!circuits.length ? `
        <div class="card empty">
          <div class="eic">${I.bulb}</div>
          <h4>从第一条回路开始</h4>
          <p>例如：玄关射灯 1、玄关射灯 2 →「玄关四开 · 按键 1」。向导会带你四步完成。</p>
        </div>` : ""}
      <button class="btn block" data-act="new">${I.plus} 新建回路</button>`;
  }

  /* ---------------- 上电状态 ---------------- */
  _vPowerOn() {
    const lamps = this._lamps;
    if (this._lampsLoading && !lamps) {
      return `<div class="card empty"><div class="eic"><span class="spin" style="width:26px;height:26px;border-width:3px"></span></div>
        <h4>正在加载灯具清单</h4><p style="margin-bottom:0">逐个探测灯具的上电状态属性…</p></div>`;
    }
    if (!lamps) {
      return `<div class="card empty"><div class="eic">${I.bolt}</div><h4>尚未加载灯具清单</h4>
        <p>加载全部灯具的上电状态支持度与当前值。</p>
        <button class="btn xl" data-act="lamps-reload">${I.refresh} 加载清单</button></div>`;
    }
    const r = this._pResults;
    const sup = lamps.filter((l) => l.supported);
    const selCount = this._lampSel.size;
    return `
      <div class="notice">${I.info}<div>批量设置灯具「断电恢复后」的行为。<b>断电记忆</b>（默认）让守护修复过程对客户完全无感。</div></div>
      <div class="card">
        <h3>目标模式</h3>
        <div class="seg">
          ${POWER_MODES.map(([m, sub]) => `<button data-pmode="${m}" class="${this._pmode === m ? "on" : ""}">${m}<small>${sub}</small></button>`).join("")}
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="btn" style="flex:1;min-width:160px" data-act="apply-sel" ${!selCount || this._pBusy ? "disabled" : ""}>
            ${this._pBusy ? '<span class="spin" style="border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>' : I.check} 应用到选中（${selCount}）</button>
          <button class="btn tint" style="flex:1;min-width:160px" data-act="apply" ${this._pBusy ? "disabled" : ""}>${I.bolt} 应用到全部灯具</button>
          <button class="btn gray" data-act="restore" ${this._pBusy ? "disabled" : ""}>${I.refresh} 还原上次</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin:2px 2px 10px">
        <span data-pcount style="font-size:13px;color:var(--text2);font-weight:600">已选 ${selCount} / ${sup.length} 个可设置灯具</span>
        <span style="margin-left:auto"></span>
        <button class="btn gray sm" data-act="lamp-all">全选</button>
        <button class="btn gray sm" data-act="lamp-none">清空</button>
        <button class="btn gray sm" data-act="lamps-reload" ${this._lampsLoading ? "disabled" : ""}>${I.refresh} 刷新</button>
      </div>
      <div id="powrap">${this._lampGroups()}</div>
      ${r ? `
        <div class="gt" as="div"><span>执行结果</span><span class="cnt">${r.length}</span></div>
        <div class="card" style="padding-top:6px;padding-bottom:6px">
          ${r.map((x) => {
            const meta = { success: ["成功", "b-green"], failed: ["失败", "b-red"], unsupported: ["无此类选项", "b-gray"] }[x.status] || [x.status, "b-gray"];
            return `<div class="li">
              <div class="main">
                <div class="tt">${esc(x.name)}</div>
                <div class="ds">${esc(x.detail || "")}${x.current_before !== undefined && x.current_after !== undefined ?
                  ` · <span class="mono">${esc(String(x.current_before))} → ${esc(String(x.current_after))}</span>` : ""}</div>
              </div>
              <span class="bd ${meta[1]}">${meta[0]}</span>
            </div>`;
          }).join("")}
        </div>` : ""}`;
  }

  _lampGroups() {
    const lamps = this._lamps || [];
    const rooms = {};
    for (const l of lamps) { const k = l.area_name || "未分配房间"; (rooms[k] = rooms[k] || []).push(l); }
    const roomNames = Object.keys(rooms).sort((a, b) =>
      (a === "未分配房间") - (b === "未分配房间") || a.localeCompare(b, "zh-Hans-CN"));
    if (!roomNames.length) {
      return `<div class="card empty"><div class="eic">${I.bulb}</div><h4>没有灯具</h4><p style="margin-bottom:0">请先在「设备识别」扫描并确认灯具分类。</p></div>`;
    }
    return roomNames.map((rm) => {
      const key = `po:${rm}`;
      const closed = !!this._collapsed[key];
      const list = rooms[rm].slice().sort((a, b) =>
        (a.online === false) - (b.online === false) ||
        String(a.name).localeCompare(String(b.name), "zh-Hans-CN"));
      return `<button class="gt room${closed ? " closed" : ""}" data-act="fold" data-id="${esc(key)}">
          <span>${esc(rm)}</span><span class="cnt">${list.length}</span><span class="chev">${I.chevD}</span>
        </button>
        ${closed ? "" : list.map((l) => this._lampRow(l)).join("")}`;
    }).join("");
  }

  _lampSelSyncDOM() {
    // 勾选变化只同步行高亮 / 计数文本 / 应用按钮，不整页重绘
    const n = this._lampSel.size;
    const supN = (this._lamps || []).filter((l) => l.supported).length;
    this.shadowRoot.querySelectorAll("[data-lamp-sel]").forEach((el) =>
      el.classList.toggle("on", this._lampSel.has(el.dataset.lampSel)));
    const cnt = this.shadowRoot.querySelector("[data-pcount]");
    if (cnt) cnt.textContent = `已选 ${n} / ${supN} 个可设置灯具`;
    const ab = this.shadowRoot.querySelector('[data-act="apply-sel"]');
    if (ab && !this._pBusy) {
      ab.disabled = !n;
      ab.innerHTML = `${I.check} 应用到选中（${n}）`;
    }
  }

  _lampRow(l) {
    const on = this._lampSel.has(l.device_id);
    const cur = l.current === null || l.current === undefined ? "—" : String(l.current);
    return `<button class="pick${on ? " on" : ""}" data-lamp-sel="${esc(l.device_id)}" ${l.supported ? "" : "disabled"}>
      <span class="pic">${I.bulb}</span>
      <span class="pm">
        <span class="pt">${esc(l.name)}${l.supported ? "" : ' <span class="bd b-gray" style="font-size:10.5px;padding:2px 8px">可能不支持上电状态</span>'}${l.online === false ? ' <span class="bd b-gray" style="font-size:10.5px;padding:2px 8px">离线</span>' : ""}</span>
        <span class="pd"><span class="mono">${esc(l.model)}</span> · 当前: <span class="cur-v">${esc(cur)}</span></span>
      </span>
      <span class="box">${I.check}</span>
    </button>`;
  }

  /* ---------------- 自定义分类管理 ---------------- */
  _clsMgrSheet() {
    return `<div class="sheet">
      <button class="mask" data-act="clsmgr-close" aria-label="关闭"></button>
      <div class="sbox"><div class="grabber"></div>
        <h2>管理自定义分类</h2>
        <div class="sheet-sub">自定义分类会出现在每台设备的「分类」胶囊组中（内置 11 类之后）</div>
        ${(this._customClasses || []).length ? `<div class="card" style="box-shadow:none;background:var(--card2);margin:0 0 12px;padding:6px 14px">
          ${this._customClasses.map((c) => `<div class="li">
            <span class="bd b-steel">${esc(c.label)}</span>
            <span class="main"><span class="ds mono" style="margin-left:6px">${esc(c.key)}</span></span>
            <button class="btn red sm" data-act="cls-del" data-id="${esc(c.key)}">${I.trash}</button>
          </div>`).join("")}
        </div>` : `<div class="empty" style="padding:20px 12px"><p style="margin:0">还没有自定义分类</p></div>`}
        <label class="f-lb" style="margin-top:0">新增分类名称</label>
        <div style="display:flex;gap:10px">
          <input class="inp" style="flex:1" type="text" data-k="clsnew" placeholder="如：氛围灯组" maxlength="12">
          <button class="btn" data-act="cls-add">${I.plus} 新增</button>
        </div>
        <div class="hint" style="margin-top:8px">名称即分组标签，键名自动生成；删除分类不会改动已归类设备（其分类标签将回退显示为键名）。</div>
        <div class="ft-btns"><button class="btn gray" data-act="clsmgr-close">完成</button></div>
      </div></div>`;
  }

  async _saveCustomClasses(arr, msg) {
    this._customClasses = arr;
    this._render();
    try {
      await this._call({ type: `${DOMAIN}/set_settings`, settings: { custom_classes: arr } });
      if (msg) this._toastMsg(msg, "ok");
    } catch (e) { this._toastMsg("保存失败：" + (e.message || e), "err"); await this._loadSettings(); }
    this._render();
  }

  /* ---------------- 配方库 ---------------- */
  _vProfiles() {
    if (!this._profiles) return this._skeleton();
    const sw = this._profiles.switch || {};
    const lamp = this._profiles.lamp || {};
    const methods = [
      ["direct", "直断法", "不断模式，直接 断 → 等 → 通。适用于无线模式下继电器仍响应的开关。"],
      ["select", "模式切换法", "切无线 → 切普通 → 断 → 等 → 通 → 还原无线。适用于直断无效的 select 型开关。"],
      ["number", "参数法", "写普通魔数 → 断 → 等 → 通 → 写回无线魔数（回读校验）。适用于 select 仅显示、写参数才生效的开关。"],
    ];
    const rows = (obj, scope) => Object.keys(obj).sort().map((model) => {
      const p = obj[model];
      const [lb, bd] = scope === "switch"
        ? [METHOD_LABEL[p.method] || p.method || "未知", { direct: "b-green", select: "b-purple", number: "b-orange" }[p.method] || "b-gray"]
        : ["上电属性", "b-blue"];
      let params = "";
      if (scope === "switch") {
        if (p.method === "select") params = `普通:${p.normal_option ?? "-"} / 无线:${p.wireless_option ?? "-"}`;
        else if (p.method === "number") params = `魔数 ${p.normal_value ?? "-"} ↔ ${p.wireless_value ?? "-"}`;
        else params = "无需参数";
      } else {
        params = `关键词:${p.entity_keyword ?? "-"} · 断电记忆=${p.modes?.["断电记忆"] ?? "-"} · 开灯=${p.modes?.["来电开灯"] ?? "-"} · 关灯=${p.modes?.["来电关灯"] ?? "-"}`;
      }
      return `<div class="prow">
        <div class="pm">
          <div class="pmodel mono">${esc(model)}</div>
          ${p.note ? `<div class="pnote">${esc(p.note)}</div>` : ""}
          <div class="pparams">${esc(params)}</div>
        </div>
        <span class="bd ${bd}" style="flex-shrink:0;margin-top:2px">${esc(lb)}</span>
        <div class="acts">
          <button class="btn gray sm" data-act="prof-edit" data-scope="${scope}" data-id="${esc(model)}">${I.edit}</button>
          <button class="btn red sm" data-act="prof-del" data-scope="${scope}" data-id="${esc(model)}">${I.trash}</button>
        </div>
      </div>`;
    }).join("");
    return `
      <div class="card">
        <h3>恢复方法说明</h3>
        ${methods.map(([m, lb, flow]) => `<div class="mrow">
          <span class="bd ${({ direct: "b-green", select: "b-purple", number: "b-orange" })[m]} mb">${lb}</span>
          <span class="mf">${flow}</span>
        </div>`).join("")}
        <div class="hint">同型号开关建的回路会自动继承这里的配方；现场「自动探型」习得的方法也会入库并注明来源回路。</div>
      </div>
      <div class="gt" as="div"><span>开关配方</span><span class="cnt">${Object.keys(sw).length}</span>
        <span style="margin-left:auto"><button class="btn tint sm" data-act="prof-new" data-scope="switch">${I.plus} 新增配方</button></span>
      </div>
      <div class="card" style="padding-top:6px;padding-bottom:6px">
        ${Object.keys(sw).length ? rows(sw, "switch") : `<div class="empty" style="padding:24px 12px"><p style="margin:0">暂无开关配方</p></div>`}
      </div>
      <div class="gt" as="div"><span>灯具配方</span><span class="cnt">${Object.keys(lamp).length}</span>
        <span style="margin-left:auto"><button class="btn tint sm" data-act="prof-new" data-scope="lamp">${I.plus} 新增配方</button></span>
      </div>
      <div class="card" style="padding-top:6px;padding-bottom:6px">
        ${Object.keys(lamp).length ? rows(lamp, "lamp") : `<div class="empty" style="padding:24px 12px"><p style="margin:0">暂无灯具配方</p></div>`}
      </div>`;
  }

  _openProf(scope, model) {
    const exist = model ? (this._profiles?.[scope] || {})[model] : null;
    this._prof = {
      scope, editModel: model || null,
      model: model || "", method: exist?.method || "direct",
      normal_option: exist?.normal_option ?? "", wireless_option: exist?.wireless_option ?? "",
      normal_value: exist?.normal_value ?? "", wireless_value: exist?.wireless_value ?? "",
      entity_keyword: exist?.entity_keyword || "",
      m1: exist?.modes?.["断电记忆"] ?? "", m2: exist?.modes?.["来电开灯"] ?? "", m3: exist?.modes?.["来电关灯"] ?? "",
      note: exist?.note || "",
    };
    this._render();
  }

  _profSheet() {
    const p = this._prof;
    const isSw = p.scope === "switch";
    const fld = (k, lb, ph, type = "text") => `
      <label class="f-lb">${lb}</label>
      <input class="inp" type="${type}" data-prof="${k}" value="${esc(p[k])}" placeholder="${esc(ph || "")}">`;
    let body = "";
    if (isSw) {
      body = `
        ${fld("model", "开关型号", "如 090615.switch.aikw3")}
        <label class="f-lb">恢复方法</label>
        <div class="seg">
          ${[["direct", "直断法"], ["select", "模式切换法"], ["number", "参数法"]].map(([m, lb]) =>
            `<button data-profmethod="${m}" class="${p.method === m ? "on" : ""}">${lb}</button>`).join("")}
        </div>
        ${p.method === "select" ? fld("normal_option", "普通选项", "如 有线和无线开关") + fld("wireless_option", "无线选项", "如 无线开关") : ""}
        ${p.method === "number" ? fld("normal_value", "普通魔数（十进制）", "如 83918848", "number") + fld("wireless_value", "无线魔数（十进制）", "如 1426096128", "number") : ""}
        ${p.method === "direct" ? `<div class="hint">直断法无需额外参数。</div>` : ""}
        ${fld("note", "备注（可选）", "如 PTX AE三开：现场自动探型习得")}`;
    } else {
      body = `
        ${fld("model", "灯具型号", "如 lemesh.light.wy0c15")}
        ${fld("entity_keyword", "实体关键词", "如 default_power_on_state")}
        ${fld("m1", "「断电记忆」选项值", "如 断电记忆")}
        ${fld("m2", "「来电开灯」选项值", "如 上电打开")}
        ${fld("m3", "「来电关灯」选项值", "如 上电关闭")}
        ${fld("note", "备注（可选）", "如 乐式泛光灯（实测实体形态）")}`;
    }
    return `<div class="sheet">
      <button class="mask" data-act="prof-close" aria-label="关闭"></button>
      <div class="sbox"><div class="grabber"></div>
        <h2>${p.editModel ? "编辑配方" : "新增配方"}</h2>
        <div class="sheet-sub">${isSw ? "开关恢复配方（断电重启的方法与参数）" : "灯具上电状态属性配方"}</div>
        ${body}
        <div class="ft-btns">
          <button class="btn gray" data-act="prof-close">取消</button>
          <button class="btn" data-act="prof-save">${I.check} 保存配方</button>
        </div>
      </div></div>`;
  }

  async _saveProf() {
    const p = this._prof;
    p.model = (p.model || "").trim();
    if (!p.model) return this._toastMsg("请填写型号", "err");
    let profile;
    if (p.scope === "switch") {
      profile = { method: p.method };
      if (p.method === "select") {
        if (!p.normal_option || !p.wireless_option) return this._toastMsg("请填写普通/无线选项", "err");
        profile.normal_option = p.normal_option; profile.wireless_option = p.wireless_option;
      } else if (p.method === "number") {
        if (p.normal_value === "" || p.wireless_value === "") return this._toastMsg("请填写两个魔数", "err");
        profile.normal_value = Number(p.normal_value); profile.wireless_value = Number(p.wireless_value);
      }
    } else {
      if (!p.entity_keyword) return this._toastMsg("请填写实体关键词", "err");
      profile = { entity_keyword: p.entity_keyword,
        modes: { "断电记忆": p.m1, "来电开灯": p.m2, "来电关灯": p.m3 } };
    }
    if (p.note) profile.note = p.note;
    try {
      await this._call({ type: `${DOMAIN}/profile_set`, scope: p.scope, model: p.model, profile });
      this._prof = null;
      await this._loadProfiles();
      this._toastMsg("配方已保存", "ok");
    } catch (e) { this._toastMsg("保存失败：" + (e.message || e), "err"); }
    this._render();
  }

  /* ---------------- 设置 ---------------- */
  _vSettings() {
    if (!this._settings) return this._skeleton();
    const s = { ...this._settings, ...this._setDraft };
    const wins = this._wins || [];
    const tm = (k, lb, ds, unit) => `
      <div class="setrow">
        <div class="st"><b>${lb}</b><span>${ds}</span></div>
        <div class="uw"><input class="inp" type="number" min="0" data-k="set_${k}" data-set="${k}" value="${esc(s[k] ?? "")}"><span class="unit">${unit}</span></div>
      </div>`;
    return `
      <div class="card">
        <h3>站点与告警</h3>
        <label class="f-lb" style="margin-top:2px">站点名称</label>
        <input class="inp" type="text" data-k="set_site_name" data-set="site_name" value="${esc(s.site_name || "")}" placeholder="如：杭州·云栖小筑">
        <label class="f-lb">企业微信机器人 Webhook</label>
        <input class="inp mono" type="url" data-k="set_hook" data-set="wework_webhook" value="${esc(s.wework_webhook || "")}" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…">
        <div class="hint">掉线排队、修复成功/失败都会推送到该群机器人；留空则不推送。</div>
      </div>
      <div class="card">
        <h3>修复时间窗</h3>
        <div id="wins">
          ${wins.length ? wins.map((w, i) => { const [a, b] = splitWin(w); return `
            <div class="winrow">
              <input class="inp" type="time" data-win="${i}" data-which="0" value="${esc(a)}">
              <span class="dash">–</span>
              <input class="inp" type="time" data-win="${i}" data-which="1" value="${esc(b)}">
              <button class="del" data-act="delwin" data-id="${i}" title="删除该时间窗">${I.x}</button>
            </div>`; }).join("") : `
            <div class="hint" style="margin:0 0 6px">尚未设置时间窗。窗口外的掉线会排队并推送通知，到点自动执行。</div>`}
        </div>
        <button class="btn tint sm" data-act="addwin" style="margin-top:10px">${I.plus} 添加时间窗</button>
        <div class="hint">建议设在客户不在场或午休时段（如 13:00–14:00）；点亮「随时修复」的回路不受时间窗限制。</div>
      </div>
      <div class="card">
        <h3>时序参数</h3>
        ${tm("offline_confirm", "掉线确认时长", "持续离线超过该时长才判定掉线，防止抖动误报", "秒")}
        ${tm("power_off_wait", "断电保持时长", "修复时继电器断开后，等待该时长再复电", "秒")}
        ${tm("rejoin_window", "回网等待窗口", "复电后等待灯具重新入网的最长时间", "秒")}
        ${tm("cut_observe_window", "断电观察窗口", "探测接线关系时断电后等待离线标记（米家离线标记延迟约 440 秒，须留足）", "秒")}
        ${tm("max_retry", "最大重试次数", "单次掉线自动修复失败后的最大重试次数", "次")}
        ${tm("cooldown", "修复冷却", "同一回路两次自动修复之间的最小间隔", "秒")}
      </div>
      <button class="btn block" data-act="saveset">保存设置</button>`;
  }

  /* ---------------- 回路向导 ---------------- */
  _openWiz(circuit) {
    this._wiz = circuit
      ? { step: 0, id: circuit.id, device_id: circuit.device_id || "", button: circuit.button ?? null,
          name: circuit.name || "", nameDirty: true, lights: [...(circuit.lights || [])], urgent: !!circuit.urgent }
      : { step: 0, id: null, device_id: "", button: null, name: "", nameDirty: false, lights: [], urgent: false };
    if (!this._devices && !this._scanning) this._scan(true);
    this._render();
  }

  _wizRooms(list, keyPfx, renderItem) {
    const rooms = {};
    for (const d of list) { const r = d.area_name || "未分配房间"; (rooms[r] = rooms[r] || []).push(d); }
    const names = Object.keys(rooms).sort((a, b) =>
      (a === "未分配房间") - (b === "未分配房间") || a.localeCompare(b, "zh-Hans-CN"));
    return names.map((r) => {
      const key = keyPfx + r;
      const closed = !!this._collapsed[key];
      const items = rooms[r].slice().sort((a, b) =>
        (a.online === false) - (b.online === false) ||
        String(a.name).localeCompare(String(b.name), "zh-Hans-CN"));
      return `<button class="gt room${closed ? " closed" : ""}" style="margin:12px 2px 6px" data-act="fold" data-id="${esc(key)}">
          <span>${esc(r)}</span><span class="cnt">${items.length}</span><span class="chev">${I.chevD}</span>
        </button>
        ${closed ? "" : items.map(renderItem).join("")}`;
    }).join("");
  }

  _wizAutoName() {
    const w = this._wiz;
    if (!w || w.nameDirty) return;
    const dev = (this._devices || []).find((d) => d.device_id === w.device_id);
    const lamps = w.lights.map((le) => (this._devices || []).find((d) => d.light_entity === le)).filter(Boolean);
    if (!dev || w.button === null || !lamps.length) return;
    const room = (x) => (x && x.area_name && x.area_name !== "未分配房间") ? x.area_name : "";
    const sRoom = room(dev), lRoom = room(lamps[0]);
    const same = sRoom && sRoom === lRoom;
    const sPart = `${same ? "" : (sRoom ? sRoom + "·" : "")}${dev.name}·按键${w.button}`;
    const lNames = lamps.length === 1 ? lamps[0].name : `${lamps[0].name} 等${lamps.length}个`;
    w.name = `${sPart} → 控制 ${lRoom ? lRoom + "·" : ""}${lNames}`;
  }

  _wizardSheet() {
    return `<div class="sheet">
      <button class="mask" data-act="wiz-close" aria-label="关闭"></button>
      <div class="sbox"><div class="grabber"></div>
        <div id="wizbody">${this._wizBodyHTML()}</div>
      </div></div>`;
  }

  _renderWizBody() {
    // 弹层内部局部重绘：步骤切换/房间折叠时只重渲染向导内容，不碰整页
    const el = this.shadowRoot.querySelector("#wizbody");
    if (el) el.innerHTML = this._wizBodyHTML();
  }

  _wizBodyHTML() {
    const w = this._wiz;
    const devs = this._devices;
    const switches = (devs || []).filter((d) => ["wall_switch", "actuator"].includes(d.classification) && (d.buttons || []).length);
    const dev = (devs || []).find((d) => d.device_id === w.device_id);
    const lamps = (devs || []).filter((d) => d.classification === "light" && d.light_entity)
      .slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-Hans-CN"));
    const sub = [
      "选择控制这组灯具供电的开关设备",
      "选择开关上对应的按键（继电器）",
      "勾选挂在这个按键下的灯具（可多选）",
      "起个名字，保存后请现场「验证通断」",
    ][w.step];
    const stepsBar = `<div class="steps">${WIZ_STEPS.map((lb, i) => `
      ${i ? '<span class="bar"></span>' : ""}
      <span class="stp${i === w.step ? " cur" : ""}${i < w.step ? " done" : ""}">
        <span class="n">${i < w.step ? I.check : i + 1}</span><span class="slbl">${lb}</span>
      </span>`).join("")}</div>`;

    let body = "";
    if (w.step === 0) {
      if (!devs) {
        body = `<div class="empty" style="padding:24px 12px"><div class="eic"><span class="spin" style="width:24px;height:24px"></span></div>
          <p style="margin-bottom:12px">正在加载设备列表…若尚未扫描过，请先扫描。</p>
          <button class="btn tint" data-act="wiz-scan">${I.search} 立即扫描</button></div>`;
      } else if (!switches.length) {
        body = `<div class="empty" style="padding:24px 12px"><div class="eic">${I.swt}</div>
          <h4>没有可用的开关设备</h4><p style="margin-bottom:0">请先在「设备识别」中确认墙开/执行器的分类。</p></div>`;
      } else {
        body = this._wizRooms(switches, "wz0:", (d) => `<button class="pick${w.device_id === d.device_id ? " on" : ""}" data-wpick="dev" data-v="${esc(d.device_id)}">
            <span class="pic">${d.classification === "actuator" ? I.plug : I.swt}</span>
            <span class="pm"><span class="pt">${esc(d.name)}${d.online === false ? ' <span class="bd b-gray" style="font-size:10.5px;padding:2px 8px">离线</span>' : ""}</span>
              <span class="pd mono">${esc(d.model)} · ${(d.buttons || []).length} 个按键</span></span>
            <span class="box">${I.check}</span>
          </button>`);
      }
    } else if (w.step === 1) {
      body = (dev && (dev.buttons || []).length ? dev.buttons.map((b) => `
          <button class="pick${w.button === b.index ? " on" : ""}" data-wpick="btn" data-v="${b.index}">
            <span class="pic">${I.bolt}</span>
            <span class="pm"><span class="pt">按键 ${b.index} · ${esc(b.label || "")}</span>
              <span class="pd mono">${esc(b.relay)}${b.mode_entity ? " · 支持模式切换" : ""}</span></span>
            <span class="box">${I.check}</span>
          </button>`).join("")
        : `<div class="empty" style="padding:24px 12px"><p style="margin:0">该开关没有可用的按键信息</p></div>`);
    } else if (w.step === 2) {
      body = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span data-wcount style="font-size:13px;color:var(--text2);font-weight:600">已选 ${w.lights.length} 个</span>
          <span style="margin-left:auto"></span>
          <button class="btn gray sm" data-act="wiz-all">全选</button>
          <button class="btn gray sm" data-act="wiz-none">清空</button>
        </div>
        ${lamps.length ? this._wizRooms(lamps, "wz2:", (l) => `
          <button class="pick${w.lights.includes(l.light_entity) ? " on" : ""}" data-wpick="light" data-v="${esc(l.light_entity)}">
            <span class="pic">${I.bulb}</span>
            <span class="pm"><span class="pt">${esc(l.name)}${l.online === false ? ' <span class="bd b-gray" style="font-size:10.5px;padding:2px 8px">离线</span>' : ""}</span><span class="pd mono">${esc(l.light_entity)}</span></span>
            <span class="box">${I.check}</span>
          </button>`)
        : `<div class="empty" style="padding:24px 12px"><p style="margin:0">暂无灯具，请先在「设备识别」扫描并确认灯具分类</p></div>`}`;
    } else {
      const btn = dev && (dev.buttons || []).find((b) => b.index === w.button);
      body = `
        <label class="f-lb" style="margin-top:0">回路名称</label>
        <input class="inp" type="text" data-k="wizname" value="${esc(w.name)}" placeholder="如：玄关射灯回路">
        <div class="hint" style="margin-top:6px">名称已按「开关·按键 → 灯具」自动预填，可手动修改。</div>
        <div class="setrow" style="margin-top:14px">
          <div class="st"><b>随时修复（例外）</b><span>开启后此回路掉线立即修复，不等待时间窗</span></div>
          <label class="sw"><input type="checkbox" data-k="wizurgent" ${w.urgent ? "checked" : ""}><i></i></label>
        </div>
        <div class="card" style="background:var(--card2);box-shadow:none;margin:14px 0 0;padding:14px 16px">
          <div class="li" style="padding:6px 0"><div class="main"><div class="ds">供电开关</div><div class="tt">${esc(dev ? dev.name : "-")}</div></div></div>
          <div class="li" style="padding:6px 0"><div class="main"><div class="ds">按键</div><div class="tt">${btn ? `按键 ${btn.index} · ${esc(btn.label || "")}` : "-"}</div></div></div>
          <div class="li" style="padding:6px 0"><div class="main"><div class="ds">灯具（${w.lights.length}）</div>
            <div class="lights" style="margin-top:6px">${w.lights.map((le) => `<span class="lchip">${I.bulb}${esc(this._lampName(le))}</span>`).join("")}</div>
          </div></div>
        </div>`;
    }

    return `<h2>${w.id ? "编辑回路" : "新建回路"}</h2>
      <div class="sheet-sub">${sub}</div>
      ${stepsBar}
      <div style="min-height:120px">${body}</div>
      <div class="ft-btns">
        ${w.step ? `<button class="btn gray" data-act="wiz-prev">上一步</button>` : `<button class="btn gray" data-act="wiz-close">取消</button>`}
        ${w.step < 3 ? `<button class="btn" data-act="wiz-next">下一步</button>` : `<button class="btn" data-act="wiz-save">${I.check} ${w.id ? "保存修改" : "保存回路"}</button>`}
      </div>`;
  }

  _wizPick(t) {
    // 纯 DOM 局部更新：只切换行高亮与计数文本，零整页重绘
    const w = this._wiz, kind = t.dataset.wpick, v = t.dataset.v;
    if (kind === "dev") {
      w.device_id = v; w.button = null;
      this.shadowRoot.querySelectorAll('[data-wpick="dev"]').forEach((n) => n.classList.toggle("on", n === t));
    } else if (kind === "btn") {
      w.button = Number(v);
      this.shadowRoot.querySelectorAll('[data-wpick="btn"]').forEach((n) => n.classList.toggle("on", n === t));
    } else if (kind === "light") {
      const i = w.lights.indexOf(v);
      if (i >= 0) w.lights.splice(i, 1); else w.lights.push(v);
      t.classList.toggle("on", i < 0);
      this._wizCountSync();
    }
    this._wizAutoName();
    const ni = this.shadowRoot.querySelector('[data-k="wizname"]');
    if (ni && !w.nameDirty) ni.value = w.name;
  }

  _wizCountSync() {
    const cnt = this.shadowRoot.querySelector("[data-wcount]");
    if (cnt) cnt.textContent = `已选 ${this._wiz.lights.length} 个`;
  }

  _wizNext() {
    const w = this._wiz;
    if (w.step === 0 && !w.device_id) return this._toastMsg("请先选择一个开关设备", "err");
    if (w.step === 1 && w.button === null) return this._toastMsg("请选择一个按键", "err");
    if (w.step === 2 && !w.lights.length) return this._toastMsg("请至少勾选一个灯具", "err");
    this._wizAutoName();
    w.step += 1;
    this._renderWizBody();
  }

  async _saveCircuit() {
    const w = this._wiz;
    w.name = (w.name || "").trim();
    if (!w.name) return this._toastMsg("请填写回路名称", "err");
    const dev = (this._devices || []).find((d) => d.device_id === w.device_id);
    const btn = dev && (dev.buttons || []).find((b) => b.index === w.button);
    const circuit = {
      name: w.name, device_id: w.device_id, switch_model: dev ? dev.model : "",
      button: w.button, relay_entity: btn ? btn.relay : "", mode_entity: btn ? (btn.mode_entity || null) : null,
      lights: w.lights, urgent: w.urgent,
    };
    if (w.id) circuit.id = w.id;
    try {
      await this._call({ type: `${DOMAIN}/save_circuit`, circuit });
      this._wiz = null;
      await this._loadCircuits();
      this._toastMsg(w.id ? "回路已更新" : "回路已保存，建议立即「验证通断」", "ok");
    } catch (e) { this._toastMsg("保存失败：" + (e.message || e), "err"); }
    this._render();
  }

  /* ---------------- 修复流水 / 确认框 ---------------- */
  _logSheet() {
    const l = this._log;
    const ok = l.status === "success", warn = l.status === "mode_restore_failed";
    return `<div class="sheet">
      <button class="mask" data-act="log-close" aria-label="关闭"></button>
      <div class="sbox"><div class="grabber"></div>
        <h2>修复执行流水</h2>
        <div class="sheet-sub">回路断电重启自愈的完整过程</div>
        <div class="res-banner ${ok ? "ok" : warn ? "warn" : "err"}">
          ${ok ? I.okc : warn ? I.alert : I.errc}
          ${ok ? "修复成功，灯具已恢复在线" : warn ? "已恢复，但模式还原失败，请现场检查" : "修复失败，需人工处理"}
          <small>耗时 ${Math.round(l.duration || 0)}s</small>
        </div>
        <div class="card" style="box-shadow:none;background:var(--card2);margin:0 0 4px;padding:8px 14px">
          ${(l.steps || []).map((s, i) => `<div class="logline"><span class="ln">${i + 1}</span><span>${esc(s)}</span></div>`).join("")}
        </div>
        <div class="ft-btns"><button class="btn" data-act="log-close">关闭</button></div>
      </div></div>`;
  }

  _cfSheet() {
    const c = this._cf;
    return `<div class="sheet cf">
      <button class="mask" data-act="cf-cancel" aria-label="取消"></button>
      <div class="sbox">
        <h2>${esc(c.title)}</h2>
        ${c.body ? `<div class="cf-body">${esc(c.body)}</div>` : ""}
        <div class="cf-btns">
          ${c.hideCancel ? "" : `<button class="btn gray" data-act="cf-cancel">取消</button>`}
          <button class="btn ${c.danger ? "redsolid" : ""}" data-act="cf-ok">${esc(c.okText)}</button>
        </div>
      </div></div>`;
  }

  /* ================= 事件 ================= */
  _onClick(e) {
    const t = e.target.closest("[data-tab],[data-act],[data-cls-dev],[data-pmode],[data-wpick],[data-filter],[data-gu],[data-lamp-sel],[data-profmethod]");
    if (!t || !this.shadowRoot.contains(t)) return;
    if (t.dataset.tab) return this._setTab(t.dataset.tab);
    if (t.dataset.clsDev) return this._setClass(t.dataset.clsDev, t.dataset.clsVal);
    if (t.dataset.pmode) { this._pmode = t.dataset.pmode; return this._render(); }
    if (t.dataset.wpick) return this._wizPick(t);
    if (t.dataset.profmethod) { if (this._prof) { this._prof.method = t.dataset.profmethod; this._render(); } return; }
    if (t.dataset.filter) {
      this._clsFilter = t.dataset.filter;
      const w = this.shadowRoot.querySelector("#devwrap");
      if (w) { w.innerHTML = this._devGroups(); this.shadowRoot.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("on", b.dataset.filter === this._clsFilter)); }
      return;
    }
    if (t.dataset.gu) return this._setGU(t.dataset.gu);
    if (t.dataset.lampSel) {
      const id2 = t.dataset.lampSel;
      if (this._lampSel.has(id2)) this._lampSel.delete(id2); else this._lampSel.add(id2);
      return this._lampSelSyncDOM();
    }

    const act = t.dataset.act, id = t.dataset.id;
    const A = {
      "scan": () => this._scan(),
      "fold": () => {
        this._collapsed[id] = !this._collapsed[id];
        // 折叠只做局部更新，不整页重绘
        if (id.startsWith("wz")) return this._renderWizBody();
        if (id.startsWith("rm:")) { const w = this.shadowRoot.querySelector("#devwrap"); if (w) w.innerHTML = this._devGroups(); return; }
        if (id.startsWith("po:")) { const w = this.shadowRoot.querySelector("#powrap"); if (w) w.innerHTML = this._lampGroups(); return; }
        if (id === "dash-ckts") { const w = this.shadowRoot.querySelector("#cktwrap"); if (w) w.innerHTML = this._cktSection(); return; }
        this._render();
      },
      "goto-circuits": () => this._setTab("circuits"),
      "new": () => this._openWiz(),
      "edit": () => { const c = (this._circuits || []).find((x) => x.id === id); if (c) this._openWiz(c); },
      "wiz-close": () => { this._wiz = null; this._render(); },
      "wiz-prev": () => { this._wiz.step -= 1; this._renderWizBody(); },
      "wiz-next": () => this._wizNext(),
      "wiz-save": () => this._saveCircuit(),
      "wiz-scan": () => this._scan(),
      "wiz-all": () => {
        this._wiz.lights = (this._devices || []).filter((d) => d.classification === "light" && d.light_entity).map((d) => d.light_entity);
        this._wizAutoName();
        this.shadowRoot.querySelectorAll('[data-wpick="light"]').forEach((n) => n.classList.add("on"));
        this._wizCountSync();
      },
      "wiz-none": () => {
        this._wiz.lights = [];
        this._wizAutoName();
        this.shadowRoot.querySelectorAll('[data-wpick="light"]').forEach((n) => n.classList.remove("on"));
        this._wizCountSync();
      },
      "repair": () => this._repair(id),
      "verify": () => this._verify(id),
      "probe": () => this._probe(id),
      "task-stop": async () => {
        const ok = await this._confirm({ title: "停止该任务？", body: "停止后开关的继电器与模式将由后端自动恢复。", okText: "停止任务", danger: true });
        if (!ok) return;
        try {
          await this._call({ type: `${DOMAIN}/task_stop`, task_id: id });
          this._toastMsg("已发送停止指令", "ok");
        } catch (e2) { this._toastMsg("停止失败：" + (e2.message || e2), "err"); }
        this._render();
      },
      "dcard": () => { delete this._doneCards[id]; this._render(); },
      "clsmgr-open": () => { this._clsMgr = true; this._render(); },
      "clsmgr-close": () => { this._clsMgr = false; this._render(); },
      "cls-add": () => {
        const inp = this.shadowRoot.querySelector('[data-k="clsnew"]');
        const label = (inp?.value || "").trim();
        if (!label) return this._toastMsg("请输入分类名称", "err");
        if (CLASS_LABEL[label] || this._customClasses.some((c) => c.label === label)) return this._toastMsg("该名称已存在", "err");
        const key = `cc_${Date.now().toString(36)}`;
        if (inp) inp.value = "";
        return this._saveCustomClasses([...this._customClasses, { key, label }], "分类已新增");
      },
      "cls-del": async () => {
        const cc = this._customClasses.find((c) => c.key === id);
        const ok = await this._confirm({ title: `删除分类「${cc ? cc.label : id}」？`, body: "已归类为该类别的设备不受影响，但分类标签将回退显示为键名。", okText: "删除", danger: true });
        if (!ok) return;
        return this._saveCustomClasses(this._customClasses.filter((c) => c.key !== id), "分类已删除");
      },
      "prof-new": () => this._openProf(t.dataset.scope, null),
      "prof-edit": () => this._openProf(t.dataset.scope, id),
      "prof-close": () => { this._prof = null; this._render(); },
      "prof-save": () => this._saveProf(),
      "prof-del": async () => {
        const ok = await this._confirm({ title: `删除配方「${id}」？`, body: "同型号开关的回路将回退为「未探型」。", okText: "删除", danger: true });
        if (!ok) return;
        try {
          await this._call({ type: `${DOMAIN}/profile_delete`, scope: t.dataset.scope, model: id });
          await this._loadProfiles();
          this._toastMsg("配方已删除", "ok");
        } catch (e2) { this._toastMsg("删除失败：" + (e2.message || e2), "err"); }
        this._render();
      },
      "del": () => this._delCircuit(id),
      "clearhist": async () => {
        const ok = await this._confirm({ title: "清空修复记录？", body: "全部历史修复记录将被删除，不可恢复。", okText: "清空", danger: true });
        if (!ok) return;
        try {
          await this._call({ type: `${DOMAIN}/clear_history` });
          this._history = [];
          this._toastMsg("记录已清空", "ok");
          await this._loadStatus();
        } catch (e2) { this._toastMsg("清空失败：" + (e2.message || e2), "err"); }
        this._render();
      },
      "apply": () => this._powerApply(),
      "apply-sel": () => this._powerApply([...this._lampSel]),
      "restore": () => this._powerRestore(),
      "lamp-all": () => { this._lampSel = new Set((this._lamps || []).filter((l) => l.supported).map((l) => l.device_id)); this._lampSelSyncDOM(); },
      "lamp-none": () => { this._lampSel.clear(); this._lampSelSyncDOM(); },
      "lamps-reload": () => this._loadLamps(),
      "addwin": () => { this._wins = [...(this._wins || []), "13:00-14:00"]; this._render(); },
      "delwin": () => { this._wins = (this._wins || []).filter((_, i) => i !== Number(id)); this._render(); },
      "saveset": () => this._saveSettings(),
      "cf-ok": () => this._cfDone(true),
      "cf-cancel": () => this._cfDone(false),
      "log-close": () => { this._log = null; this._render(); },
    };
    if (A[act]) return A[act]();
  }

  _onInput(e) {
    const t = e.target;
    if (!t.dataset) return;
    if (t.dataset.k === "search") {
      this._search = t.value;
      const w = this.shadowRoot.querySelector("#devwrap");
      if (w) w.innerHTML = this._devGroups();
      return;
    }
    if (t.dataset.k === "wizname" && this._wiz) { this._wiz.name = t.value; this._wiz.nameDirty = true; return; }
    if (t.dataset.prof && this._prof) { this._prof[t.dataset.prof] = t.value; return; }
    if (t.dataset.set !== undefined) {
      this._setDraft[t.dataset.set] = t.type === "number" ? (t.value === "" ? "" : Number(t.value)) : t.value;
    }
  }

  _onChange(e) {
    const t = e.target;
    if (!t.dataset) return;
    if (t.dataset.urgent !== undefined) return this._toggleUrgent(t.dataset.urgent, t.checked);
    if (t.dataset.win !== undefined) {
      const i = Number(t.dataset.win);
      const [a, b] = splitWin((this._wins || [])[i]);
      const v = t.value || "00:00";
      this._wins[i] = t.dataset.which === "0" ? `${v}-${b}` : `${a}-${v}`;
      return;
    }
    if (t.dataset.k === "wizurgent" && this._wiz) { this._wiz.urgent = t.checked; return; }
    if (t.dataset.set !== undefined) {
      this._setDraft[t.dataset.set] = t.type === "number" ? (t.value === "" ? "" : Number(t.value)) : t.value;
    }
  }

  async _setClass(devId, val) {
    const d = (this._devices || []).find((x) => x.device_id === devId);
    if (!d) return;
    if ((d.manual ? d.classification : "auto") === val) return;
    try {
      await this._call({ type: `${DOMAIN}/set_class`, device_id: devId, classification: val });
      d.manual = val !== "auto";
      if (val !== "auto") d.classification = val;
      // 仅局部刷新该设备卡的分类胶囊高亮，不整页重绘
      const cur = d.manual ? d.classification : "auto";
      this.shadowRoot.querySelectorAll(`[data-cls-dev="${CSS.escape(devId)}"]`).forEach((n) => {
        n.classList.toggle("on", n.dataset.clsVal === cur && cur !== "auto");
        n.classList.toggle("on-auto", cur === "auto" && n.dataset.clsVal === "auto");
      });
      this._toastMsg("分类已更新", "ok");
      this._scan(true); // 静默同步后端重新归类的结果
    } catch (e) { this._toastMsg("更新失败：" + (e.message || e), "err"); }
  }

  async _toggleUrgent(cid, val) {
    const c = (this._circuits || []).find((x) => x.id === cid);
    if (!c) return;
    try {
      await this._call({ type: `${DOMAIN}/save_circuit`, circuit: { ...c, urgent: val } });
      c.urgent = val;
      this._toastMsg(val ? "已开启随时修复" : "已关闭随时修复", "ok");
    } catch (e) { this._toastMsg("保存失败：" + (e.message || e), "err"); }
    this._render();
  }

  async _repair(id) {
    const c = (this._circuits || []).find((x) => x.id === id);
    if (!c) return;
    const ok = await this._confirm({
      title: `立即修复「${c.name}」？`,
      body: "对应灯具将短暂断电约 5 秒后自动复电，全程约 1 分钟，期间请勿手动操作开关。",
      okText: "立即修复", danger: true,
    });
    if (!ok) return;
    this._toastMsg("修复执行中，请稍候…");
    try {
      const r = await this._call({ type: `${DOMAIN}/repair_now`, circuit_id: id });
      if (r.result) this._log = r.result;
      else this._toastMsg("正在修复或处于冷却期，未重复执行");
    } catch (e) { this._toastMsg("修复失败：" + (e.message || e), "err"); }
    await this._loadStatus();
    this._render();
  }

  /* ---------------- 长任务：验证通断 / 自动探型（后台运行） ---------------- */
  async _startTask(kind, id) {
    const c = (this._circuits || []).find((x) => x.id === id);
    if (!c) return;
    if (this._runningTask(id)) return this._toastMsg("该回路已有任务在运行", "err");
    const mins = Math.round((this._settings?.cut_observe_window || 540) / 60);
    const isV = kind === "verify";
    const ok = await this._confirm({
      title: `${isV ? "验证" : "自动探型"}「${c.name}」？`,
      body: isV
        ? `将断电并轮询观察灯具是否失联（米家离线标记有延迟，最长约 ${mins} 分钟），随后自动复电。任务在后台运行，可随时停止。`
        : `将依次尝试「直断法」与「模式切换法」，以灯具失联做裁判，每步最长约 ${mins} 分钟。任务在后台运行，可随时停止。`,
      okText: isV ? "开始验证" : "开始探型",
    });
    if (!ok) return;
    try {
      const r = await this._call({ type: `${DOMAIN}/${isV ? "verify_circuit" : "probe_circuit"}`, circuit_id: id });
      this._upsertTask(r.task);
      this._toastMsg(isV ? "验证任务已启动" : "探型任务已启动", "ok");
      delete this._doneCards[id];
    } catch (e) { this._toastMsg("启动失败：" + (e.message || e), "err"); }
    this._render();
  }
  _verify(id) { return this._startTask("verify", id); }
  _probe(id) { return this._startTask("probe", id); }

  async _delCircuit(id) {
    const c = (this._circuits || []).find((x) => x.id === id);
    if (!c) return;
    const ok = await this._confirm({
      title: "删除该回路？",
      body: `「${c.name}」的接线映射将被移除，守护不再覆盖这些灯具。`,
      okText: "删除", danger: true,
    });
    if (!ok) return;
    try {
      await this._call({ type: `${DOMAIN}/delete_circuit`, circuit_id: id });
      await this._loadCircuits();
      this._toastMsg("回路已删除", "ok");
    } catch (e) { this._toastMsg("删除失败：" + (e.message || e), "err"); }
    this._render();
  }

  async _powerApply(deviceIds) {
    const isSel = Array.isArray(deviceIds);
    if (isSel && !deviceIds.length) return;
    const ok = await this._confirm({
      title: `应用「${this._pmode}」？`,
      body: isSel
        ? `将写入选中的 ${deviceIds.length} 个灯具的上电状态。`
        : "将批量写入全部灯具的上电状态；不支持的设备会标记为「无此类选项」，不影响其他灯具。",
      okText: "开始应用",
    });
    if (!ok) return;
    this._pBusy = true; this._render();
    try {
      const payload = { type: `${DOMAIN}/power_on_apply`, target_label: this._pmode };
      if (isSel) payload.device_ids = deviceIds;
      const r = await this._call(payload);
      this._pResults = r.results || [];
      this._toastMsg("应用完成", "ok");
      this._loadLamps();
    } catch (e) { this._toastMsg("执行失败：" + (e.message || e), "err"); }
    this._pBusy = false; this._render();
  }

  async _setGU(v) {
    const cur = (this._scheduler || {}).global_urgent || "follow";
    if (cur === v) return;
    if (this._scheduler) this._scheduler.global_urgent = v;
    this._render();
    try {
      await this._call({ type: `${DOMAIN}/set_settings`, settings: { global_urgent: v } });
      this._toastMsg("全局随时修复已更新", "ok");
    } catch (e) {
      if (this._scheduler) this._scheduler.global_urgent = cur;
      this._toastMsg("保存失败：" + (e.message || e), "err");
    }
    this._render();
  }

  async _powerRestore() {
    const ok = await this._confirm({
      title: "还原上电状态？",
      body: "将按备份把上次批量修改前的上电状态写回各灯具。",
      okText: "还原",
    });
    if (!ok) return;
    this._pBusy = true; this._render();
    try {
      const r = await this._call({ type: `${DOMAIN}/power_on_restore` });
      this._toastMsg(`已还原 ${r.restored} 个灯具`, "ok");
    } catch (e) { this._toastMsg("还原失败：" + (e.message || e), "err"); }
    this._pBusy = false; this._render();
  }

  async _saveSettings() {
    const s = { ...this._setDraft };
    ["offline_confirm", "power_off_wait", "rejoin_window", "cut_observe_window", "max_retry", "cooldown"]
      .forEach((k) => { if (s[k] !== undefined) s[k] = Number(s[k]) || 0; });
    const wins = (this._wins || []).map((w) => String(w).trim()).filter(Boolean);
    s.repair_windows = wins.length ? wins : ["13:00-14:00"];
    try {
      await this._call({ type: `${DOMAIN}/set_settings`, settings: s });
      this._setDraft = {};
      this._wins = [...s.repair_windows];
      await this._loadSettings();
      this._toastMsg("设置已保存", "ok");
    } catch (e) { this._toastMsg("保存失败：" + (e.message || e), "err"); }
    this._render();
  }
}

customElements.define("mesh-guard-panel", MeshGuardPanel);
