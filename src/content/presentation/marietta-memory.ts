export type AuthoredLine = {id: string; characterId?: string; name?: string; text: string; expression?: string};

/** D5-A stable authored lines; no gameplay effects live in presentation content. */
export const mariettaMemoryScript: Record<"present-intro" | "history-opening" | "teaching" | "history-complete" | "return-pending", AuthoredLine[]> = {
  "present-intro": [
    {
      "id": "story.marietta.memory.present-intro.01",
      "name": "旁白",
      "text": "玛丽埃塔把庄园登记簿放进抽屉。指尖离开封皮时，没有带起一根线。"
    },
    {
      "id": "story.marietta.memory.present-intro.02",
      "name": "凯尔",
      "text": "下回去庄园，名单上给你留个位置？",
      "characterId": "kael"
    },
    {
      "id": "story.marietta.memory.present-intro.03",
      "name": "玛丽埃塔",
      "text": "如果您的意思是一起出门，请直接这么说。登记簿已经合上了。",
      "characterId": "marietta"
    },
    {
      "id": "story.marietta.memory.present-intro.04",
      "name": "凯尔",
      "text": "那就一起去。说起来，以前你可不肯让我们往前走。",
      "characterId": "kael"
    },
    {
      "id": "story.marietta.memory.present-intro.05",
      "name": "玛丽埃塔",
      "text": "您带着四位不肯擦靴子的客人，试图穿过我的回廊。",
      "characterId": "marietta"
    },
    {
      "id": "story.marietta.memory.present-intro.06",
      "name": "凯尔",
      "text": "那时先停下来擦靴子，未必还能站着。",
      "characterId": "kael"
    },
    {
      "id": "story.marietta.memory.present-intro.07",
      "name": "玛丽埃塔",
      "text": "至少，您还记得该在哪里停下。",
      "characterId": "marietta"
    },
    {
      "id": "story.marietta.memory.present-intro.08",
      "name": "旁白",
      "text": "她抬起手，整理了一下袖口。记忆里的红线从同一个动作中展开。"
    }
  ],
  "history-opening": [
    {
      "id": "story.marietta.memory.history-opening.01",
      "name": "旁白",
      "text": "回廊尽头的门紧闭着。白布垂在黑木陈设上，连褶皱都朝着同一个方向。"
    },
    {
      "id": "story.marietta.memory.history-opening.02",
      "name": "尤斯缇丝",
      "text": "保持距离。凯尔，看住后面。",
      "characterId": "eustice"
    },
    {
      "id": "story.marietta.memory.history-opening.03",
      "name": "诺玛",
      "text": "门缝里也有线。别指望我从旁边绕过去。",
      "characterId": "norma"
    },
    {
      "id": "story.marietta.memory.history-opening.04",
      "name": "艾洛拉",
      "text": "药和护符都在。需要的时候直接叫我。",
      "characterId": "elora"
    },
    {
      "id": "story.marietta.memory.history-opening.05",
      "name": "柯萝萝",
      "text": "……她连人偶之间的空隙都量过。",
      "characterId": "kororo"
    },
    {
      "id": "story.marietta.memory.history-opening.06",
      "name": "旁白",
      "text": "娇小的女仆立在前方。黑铁鸟笼裙撑纹丝不动，笼中细小的人影无声悬浮。她是整条回廊里唯一没有沾上灰尘的人。"
    },
    {
      "id": "story.marietta.memory.history-opening.07",
      "name": "玛丽埃塔",
      "text": "到这里为止。请勿越过红线。",
      "characterId": "marietta"
    },
    {
      "id": "story.marietta.memory.history-opening.08",
      "name": "凯尔",
      "text": "我们得去门后。",
      "characterId": "kael"
    },
    {
      "id": "story.marietta.memory.history-opening.09",
      "name": "玛丽埃塔",
      "text": "那就请各位证明，自己能走到那里。",
      "characterId": "marietta"
    }
  ],
  "teaching": [
    {
      "id": "story.marietta.memory.teaching.01",
      "name": "诺玛",
      "text": "看她的手。不是上面有什么东西在吊着她。",
      "characterId": "norma"
    },
    {
      "id": "story.marietta.memory.teaching.02",
      "name": "凯尔",
      "text": "线在她手里。",
      "characterId": "kael"
    },
    {
      "id": "story.marietta.memory.teaching.03",
      "name": "柯萝萝",
      "text": "靠着她的那只侍偶在替她挡力。它挪到哪里，护住的位置也跟着变。",
      "characterId": "kororo"
    },
    {
      "id": "story.marietta.memory.teaching.04",
      "name": "尤斯缇丝",
      "text": "先看清空隙。她会把空隙补回来。",
      "characterId": "eustice"
    },
    {
      "id": "story.marietta.memory.teaching.05",
      "name": "艾洛拉",
      "text": "真要接她一击，就提前准备好。别等落下来才想起护符。",
      "characterId": "elora"
    },
    {
      "id": "story.marietta.memory.teaching.06",
      "name": "玛丽埃塔",
      "text": "看明白了？那么，请站稳。",
      "characterId": "marietta"
    }
  ],
  "history-complete": [
    {
      "id": "story.marietta.memory.history-ending.01",
      "name": "旁白",
      "text": "防线中央终于露出了足够通行的空隙。玛丽埃塔的手停在半空，随后缓缓合拢。"
    },
    {
      "id": "story.marietta.memory.history-ending.02",
      "name": "旁白",
      "text": "红线向她指间退去。裙撑依旧完整，白金色的长发没有一丝凌乱。"
    },
    {
      "id": "story.marietta.memory.history-ending.03",
      "name": "玛丽埃塔",
      "text": "到此为止。",
      "characterId": "marietta"
    },
    {
      "id": "story.marietta.memory.history-ending.04",
      "name": "尤斯缇丝",
      "text": "我们还要往前。",
      "characterId": "eustice"
    },
    {
      "id": "story.marietta.memory.history-ending.05",
      "name": "玛丽埃塔",
      "text": "您已经越过了这条线。我看得见。",
      "characterId": "marietta"
    },
    {
      "id": "story.marietta.memory.history-ending.06",
      "name": "凯尔",
      "text": "收拢队伍。别把人留在回廊里。",
      "characterId": "kael"
    },
    {
      "id": "story.marietta.memory.history-ending.07",
      "name": "玛丽埃塔",
      "text": "门后不是宴会厅。没有人为各位备好座位。",
      "characterId": "marietta"
    },
    {
      "id": "story.marietta.memory.history-ending.08",
      "name": "凯尔",
      "text": "那就过去再说。",
      "characterId": "kael"
    },
    {
      "id": "story.marietta.memory.history-ending.09",
      "name": "旁白",
      "text": "回廊里的脚步声继续向前。这一次，红线没有重新横过他们面前。"
    }
  ],
  "return-pending": [
    {
      "id": "story.marietta.return.01",
      "name": "旁白",
      "text": "玛丽埃塔将一小碟布丁放到桌上。银匙轻碰碟沿，回廊里的声音散去了。"
    },
    {
      "id": "story.marietta.return.02",
      "name": "凯尔",
      "text": "当年没备好的座位，倒在这里补上了。",
      "characterId": "kael"
    },
    {
      "id": "story.marietta.return.03",
      "name": "玛丽埃塔",
      "text": "如果您还要把靴子放上椅子，也可以立刻收回。",
      "characterId": "marietta"
    },
    {
      "id": "story.marietta.return.04",
      "name": "凯尔",
      "text": "下回去庄园，路上也这么管？",
      "characterId": "kael"
    },
    {
      "id": "story.marietta.return.05",
      "name": "玛丽埃塔",
      "text": "地形、余下的规约，还有各位容易忽略的地方，我会一起看着。",
      "characterId": "marietta"
    },
    {
      "id": "story.marietta.return.06",
      "name": "凯尔",
      "text": "那就写上你的名字。",
      "characterId": "kael"
    },
    {
      "id": "story.marietta.return.07",
      "name": "玛丽埃塔",
      "text": "写在同行的人里。别再替我添一个值班栏。",
      "characterId": "marietta"
    },
    {
      "id": "story.marietta.return.08",
      "name": "旁白",
      "text": "她没有把簿册重新取出来，只把另一把椅子拉到桌边。"
    }
  ]
};
