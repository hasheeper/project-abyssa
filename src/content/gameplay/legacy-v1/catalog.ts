import type { BattleCatalog } from "../../../game-core/contracts";

/** Frozen legacy mechanics; new tactical content must use another version. */
export const LEGACY_CATALOG: BattleCatalog = {
  "catalogId": "abyssa.legacy",
  "contentVersion": 1,
  "rulesVersion": 1,
  "characters": {
    "kael": {
      "id": "kael",
      "name": "凯尔",
      "faces": [
        {
          "verb": "attack",
          "power": 1,
          "pip": 1,
          "label": "制服",
          "quality": "plain"
        },
        {
          "verb": "attack",
          "power": 1,
          "pip": 2,
          "label": "截击",
          "quality": "plain"
        },
        {
          "verb": "guard",
          "power": 1,
          "pip": 3,
          "label": "招架",
          "quality": "plain"
        },
        {
          "verb": "guard",
          "power": 1,
          "pip": 4,
          "label": "护卫",
          "quality": "plain"
        },
        {
          "verb": "heal",
          "power": 1,
          "pip": 5,
          "label": "包扎",
          "quality": "plain"
        },
        {
          "verb": "wild",
          "power": 1,
          "pip": 6,
          "wildPip": true,
          "label": "静谧之楔",
          "quality": "gild"
        }
      ]
    },
    "eustice": {
      "id": "eustice",
      "name": "尤斯缇丝",
      "faces": [
        {
          "verb": "attack",
          "power": 1,
          "pip": 1,
          "label": "剑击",
          "quality": "plain"
        },
        {
          "verb": "attack",
          "power": 2,
          "pip": 2,
          "label": "剑击",
          "quality": "plain"
        },
        {
          "verb": "attack",
          "power": 2,
          "pip": 3,
          "label": "剑击",
          "quality": "plain"
        },
        {
          "verb": "attack",
          "power": 3,
          "pip": 4,
          "label": "红莲突刺",
          "quality": "gild"
        },
        {
          "verb": "guard",
          "power": 2,
          "pip": 5,
          "label": "王权结阵",
          "quality": "plain"
        },
        {
          "verb": "blank",
          "power": 0,
          "pip": 6,
          "label": "气急败坏",
          "quality": "plain"
        }
      ]
    },
    "elora": {
      "id": "elora",
      "name": "艾洛拉",
      "faces": [
        {
          "verb": "heal",
          "power": 1,
          "pip": 1,
          "label": "圣光",
          "quality": "plain"
        },
        {
          "verb": "guard",
          "power": 1,
          "pip": 2,
          "label": "圣杖防卫",
          "quality": "plain"
        },
        {
          "verb": "heal",
          "power": 1,
          "pip": 3,
          "label": "圣光",
          "quality": "plain"
        },
        {
          "verb": "heal",
          "power": 1,
          "pip": 4,
          "label": "圣光",
          "quality": "plain"
        },
        {
          "verb": "heal",
          "power": 2,
          "pip": 5,
          "label": "越限奇迹",
          "effectDefinitionIds": [
            "action.expensive-heal"
          ],
          "quality": "gild"
        },
        {
          "verb": "blank",
          "power": 0,
          "pip": 6,
          "label": "心疼发呆",
          "quality": "plain"
        }
      ]
    },
    "kororo": {
      "id": "kororo",
      "name": "柯萝萝",
      "faces": [
        {
          "verb": "attack",
          "power": 4,
          "pip": 1,
          "label": "渊星重压",
          "quality": "plain"
        },
        {
          "verb": "attack",
          "power": 4,
          "pip": 2,
          "label": "渊星重压",
          "quality": "plain"
        },
        {
          "verb": "attack",
          "power": 5,
          "pip": 3,
          "label": "微缩极星",
          "quality": "gild"
        },
        {
          "verb": "blank",
          "power": 0,
          "pip": 4,
          "label": "摆烂",
          "quality": "plain"
        },
        {
          "verb": "blank",
          "power": 0,
          "pip": 5,
          "label": "摆烂",
          "quality": "plain"
        },
        {
          "verb": "blank",
          "power": 0,
          "pip": 6,
          "label": "不要——",
          "quality": "plain"
        }
      ]
    },
    "norma": {
      "id": "norma",
      "name": "诺玛",
      "faces": [
        {
          "verb": "coin",
          "power": 1,
          "pip": 1,
          "label": "顺手牵羊",
          "quality": "plain"
        },
        {
          "verb": "coin",
          "power": 2,
          "pip": 2,
          "label": "顺手牵羊",
          "quality": "rust"
        },
        {
          "verb": "attack",
          "power": 2,
          "pip": 3,
          "label": "毒刀",
          "quality": "plain"
        },
        {
          "verb": "guard",
          "power": 1,
          "pip": 4,
          "label": "拆解机关",
          "quality": "plain"
        },
        {
          "verb": "guard",
          "power": 2,
          "pip": 5,
          "label": "无音步",
          "quality": "plain"
        },
        {
          "verb": "blank",
          "power": 0,
          "pip": 6,
          "label": "咬碎糖",
          "quality": "plain"
        }
      ]
    }
  },
  "defaultParty": [
    "kael",
    "eustice",
    "elora",
    "kororo",
    "norma"
  ],
  "leaderId": "kael",
  "maxPartySize": 5,
  "balance": {
    "MAX_HP": 3,
    "DOWNED_RETURN_HP": 1,
    "MAX_LAYER": 5,
    "REROLLS_PER_ROUND": 2,
    "LAYER_MULTIPLIERS": [
      1,
      1.3,
      1.7,
      2.2,
      3
    ],
    "STALL_GRACE_ROUNDS": 2,
    "FRENZY_ATTACK_BONUS": 3
  },
  "enemies": {
    "legacy.enemy.1.0.0": {
      "id": "legacy.enemy.1.0.0",
      "kind": "brute",
      "name": "畸变魔物",
      "art": "amalgam",
      "hp": 2,
      "attack": 1,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.1.1.0": {
      "id": "legacy.enemy.1.1.0",
      "kind": "brute",
      "name": "裂隙爪兽",
      "art": "sentinel",
      "hp": 3,
      "attack": 2,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.2.0.0": {
      "id": "legacy.enemy.2.0.0",
      "kind": "brute",
      "name": "畸变魔物",
      "art": "amalgam",
      "hp": 3,
      "attack": 2,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.2.1.0": {
      "id": "legacy.enemy.2.1.0",
      "kind": "anomaly",
      "name": "瘴气异象",
      "art": "amalgam",
      "hp": 2,
      "attack": 0,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.2.1.1": {
      "id": "legacy.enemy.2.1.1",
      "kind": "trap",
      "name": "术式陷阱",
      "art": "choir",
      "hp": 2,
      "attack": 0,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.3.0.0": {
      "id": "legacy.enemy.3.0.0",
      "kind": "brute",
      "name": "裂隙爪兽",
      "art": "sentinel",
      "hp": 3,
      "attack": 2,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.3.1.0": {
      "id": "legacy.enemy.3.1.0",
      "kind": "summoner",
      "name": "裂隙之口",
      "art": "choir",
      "hp": 3,
      "attack": 0,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.3.2.0": {
      "id": "legacy.enemy.3.2.0",
      "kind": "anomaly",
      "name": "瘴气异象",
      "art": "amalgam",
      "hp": 2,
      "attack": 0,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.4.0.0": {
      "id": "legacy.enemy.4.0.0",
      "kind": "charger",
      "name": "蓄能异兽",
      "art": "choir",
      "hp": 4,
      "attack": 3,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.4.1.0": {
      "id": "legacy.enemy.4.1.0",
      "kind": "summoner",
      "name": "裂隙之口",
      "art": "choir",
      "hp": 3,
      "attack": 0,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.4.2.0": {
      "id": "legacy.enemy.4.2.0",
      "kind": "brute",
      "name": "畸变魔物",
      "art": "amalgam",
      "hp": 3,
      "attack": 2,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.5.0.0": {
      "id": "legacy.enemy.5.0.0",
      "kind": "brute",
      "name": "深渊噬兽",
      "art": "sentinel",
      "hp": 6,
      "attack": 3,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.5.1.0": {
      "id": "legacy.enemy.5.1.0",
      "kind": "charger",
      "name": "蓄能异兽",
      "art": "choir",
      "hp": 4,
      "attack": 4,
      "chargeReady": true,
      "countdown": 2
    },
    "legacy.enemy.5.2.0": {
      "id": "legacy.enemy.5.2.0",
      "kind": "anomaly",
      "name": "瘴气异象",
      "art": "amalgam",
      "hp": 3,
      "attack": 0,
      "chargeReady": false,
      "countdown": 2
    },
    "legacy.enemy.5.3.0": {
      "id": "legacy.enemy.5.3.0",
      "kind": "trap",
      "name": "术式陷阱",
      "art": "choir",
      "hp": 3,
      "attack": 0,
      "chargeReady": false,
      "countdown": 1
    },
    "legacy.enemy.summoned": {
      "id": "legacy.enemy.summoned",
      "kind": "brute",
      "name": "新生畸变物",
      "art": "amalgam",
      "hp": 2,
      "attack": 1
    }
  },
  "encounters": {
    "legacy.encounter.1": {
      "id": "legacy.encounter.1",
      "slots": [
        [
          "legacy.enemy.1.0.0"
        ],
        [
          "legacy.enemy.1.1.0"
        ]
      ]
    },
    "legacy.encounter.2": {
      "id": "legacy.encounter.2",
      "slots": [
        [
          "legacy.enemy.2.0.0"
        ],
        [
          "legacy.enemy.2.1.0",
          "legacy.enemy.2.1.1"
        ]
      ]
    },
    "legacy.encounter.3": {
      "id": "legacy.encounter.3",
      "slots": [
        [
          "legacy.enemy.3.0.0"
        ],
        [
          "legacy.enemy.3.1.0"
        ],
        [
          "legacy.enemy.3.2.0"
        ]
      ]
    },
    "legacy.encounter.4": {
      "id": "legacy.encounter.4",
      "slots": [
        [
          "legacy.enemy.4.0.0"
        ],
        [
          "legacy.enemy.4.1.0"
        ],
        [
          "legacy.enemy.4.2.0"
        ]
      ]
    },
    "legacy.encounter.5": {
      "id": "legacy.encounter.5",
      "slots": [
        [
          "legacy.enemy.5.0.0"
        ],
        [
          "legacy.enemy.5.1.0"
        ],
        [
          "legacy.enemy.5.2.0"
        ],
        [
          "legacy.enemy.5.3.0"
        ]
      ]
    }
  },
  "routes": {
    "legacy.rift": {
      "id": "legacy.rift",
      "name": "混沌领域",
      "encounters": [
        "legacy.encounter.1",
        "legacy.encounter.2",
        "legacy.encounter.3",
        "legacy.encounter.4",
        "legacy.encounter.5"
      ]
    }
  },
  "defaultRouteId": "legacy.rift",
  "summonEnemyId": "legacy.enemy.summoned",
  "effects": {
    "action.expensive-heal": {
      "definitionId": "action.expensive-heal",
      "modifiers": [],
      "reactions": []
    },
    "status.frenzy-warning": {
      "definitionId": "status.frenzy-warning",
      "modifiers": [],
      "reactions": []
    },
    "status.frenzy-active": {
      "definitionId": "status.frenzy-active",
      "modifiers": [],
      "reactions": []
    }
  },
  "actionEffects": {
    "action.expensive-heal": {
      "definitionId": "action.expensive-heal",
      "trigger": "heal",
      "effect": {
        "type": "resource-cost",
        "resource": "gold",
        "amount": 10,
        "reason": "healing-cost",
        "log": "越限奇迹消耗了价值 10G 的治疗材料。",
        "fact": "艾洛拉为了治疗同伴再次使用了昂贵材料，事后大概会心疼账单。"
      }
    }
  },
  "contentKinds": {
    "action.expensive-heal": "action",
    "status.frenzy-warning": "status",
    "status.frenzy-active": "status"
  },
  "frenzyWarningId": "status.frenzy-warning",
  "frenzyActiveId": "status.frenzy-active"
};
