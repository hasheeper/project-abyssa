/** Catalogue episodes; individual authored scene IDs remain in each read receipt. */
export const OPENING_MEMORY_TITLES = {
  departure: "还没吃完的早饭",
  return: "赶在午餐前",
} as const;

/** Gemini 3.8 copy, checked against the authored scenes; no unread outcomes. */
export const OPENING_MEMORY_SUMMARIES = {
  departure: {
    ongoing: "清晨的洋馆里，艾比希斯好不容易才被从沙发上拖起来，正准备吃早饭。",
    complete: "早饭刚吃到一半，诺玛就撞门送来坏消息：班车被亡命徒劫走，艾比希斯送去修补的旧毛毯也在车上。宅邸里的黑泥威压眼看就要失控，勇者和四位同伴动身出门，前去追回失物。",
  },
  return: {
    ongoing: "翻覆的货车残骸旁留着明显的拖痕。诺玛顺着痕迹一路追踪，众人来到退潮的泥滩，线索笔直扎进了山壁下的海蚀洞。",
    complete: "众人进入退潮岩窟，突破哨位，沿着石阶来到货台，找回了包着旧毛毯的油纸包。随后全员按原路撤出洞穴返回洋馆，把毛毯交还给了艾比希斯。",
  },
} as const;
