export type RustItem = {
  shortname: string;
  name: string;
  category: string;
  stackSize: number;
};

export const ITEM_CATEGORIES = [
  "All",
  "Weapons",
  "Ammunition",
  "Explosives",
  "Medical",
  "Resources",
  "Components",
  "Attire",
  "Tools",
  "Building",
  "Food",
  "Misc",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const RUST_ITEMS: RustItem[] = [
  // Weapons
  { shortname: "rifle.ak",           name: "AK-47",                    category: "Weapons",    stackSize: 1 },
  { shortname: "rifle.bolt",         name: "Bolt Action Rifle",        category: "Weapons",    stackSize: 1 },
  { shortname: "rifle.lr300",        name: "LR-300 Assault Rifle",     category: "Weapons",    stackSize: 1 },
  { shortname: "rifle.m39",          name: "M39 Rifle",                category: "Weapons",    stackSize: 1 },
  { shortname: "rifle.semiauto",     name: "Semi-Auto Rifle",          category: "Weapons",    stackSize: 1 },
  { shortname: "lmg.m249",           name: "M249",                     category: "Weapons",    stackSize: 1 },
  { shortname: "smg.mp5",            name: "MP5A4",                    category: "Weapons",    stackSize: 1 },
  { shortname: "smg.thompson",       name: "Thompson",                 category: "Weapons",    stackSize: 1 },
  { shortname: "smg.2",              name: "Custom SMG",               category: "Weapons",    stackSize: 1 },
  { shortname: "shotgun.pump",       name: "Pump Shotgun",             category: "Weapons",    stackSize: 1 },
  { shortname: "shotgun.spas12",     name: "SPAS-12",                  category: "Weapons",    stackSize: 1 },
  { shortname: "shotgun.double",     name: "Double Barrel Shotgun",    category: "Weapons",    stackSize: 1 },
  { shortname: "shotgun.waterpipe",  name: "Waterpipe Shotgun",        category: "Weapons",    stackSize: 1 },
  { shortname: "pistol.m92",         name: "M92 Pistol",               category: "Weapons",    stackSize: 1 },
  { shortname: "pistol.python",      name: "Python Revolver",          category: "Weapons",    stackSize: 1 },
  { shortname: "pistol.revolver",    name: "Revolver",                 category: "Weapons",    stackSize: 1 },
  { shortname: "pistol.semiauto",    name: "Semi-Auto Pistol",         category: "Weapons",    stackSize: 1 },
  { shortname: "pistol.eoka",        name: "Eoka Pistol",              category: "Weapons",    stackSize: 1 },
  { shortname: "bow.hunting",        name: "Hunting Bow",              category: "Weapons",    stackSize: 1 },
  { shortname: "bow.compound",       name: "Compound Bow",             category: "Weapons",    stackSize: 1 },
  { shortname: "crossbow",           name: "Crossbow",                 category: "Weapons",    stackSize: 1 },
  { shortname: "rocket.launcher",    name: "Rocket Launcher",          category: "Weapons",    stackSize: 1 },
  { shortname: "multiplegrenadelauncher", name: "Multiple Grenade Launcher", category: "Weapons", stackSize: 1 },
  { shortname: "knife.combat",       name: "Combat Knife",             category: "Weapons",    stackSize: 1 },
  { shortname: "mace",               name: "Mace",                     category: "Weapons",    stackSize: 1 },
  { shortname: "axe.salvaged",       name: "Salvaged Axe",             category: "Weapons",    stackSize: 1 },
  { shortname: "spear.wooden",       name: "Wooden Spear",             category: "Weapons",    stackSize: 1 },
  { shortname: "spear.stone",        name: "Stone Spear",              category: "Weapons",    stackSize: 1 },
  { shortname: "flamethrower",       name: "Flame Thrower",            category: "Weapons",    stackSize: 1 },

  // Ammunition
  { shortname: "ammo.rifle",             name: "5.56 Rifle Ammo",              category: "Ammunition", stackSize: 128 },
  { shortname: "ammo.rifle.explosive",   name: "Explosive 5.56",               category: "Ammunition", stackSize: 64  },
  { shortname: "ammo.rifle.hv",          name: "HV 5.56 Rifle Ammo",           category: "Ammunition", stackSize: 128 },
  { shortname: "ammo.rifle.incendiary",  name: "Incendiary 5.56",              category: "Ammunition", stackSize: 64  },
  { shortname: "ammo.pistol",            name: "Pistol Bullet",                category: "Ammunition", stackSize: 128 },
  { shortname: "ammo.pistol.hv",         name: "HV Pistol Bullet",             category: "Ammunition", stackSize: 128 },
  { shortname: "ammo.pistol.fire",       name: "Incendiary Pistol Bullet",     category: "Ammunition", stackSize: 64  },
  { shortname: "ammo.shotgun",           name: "12 Gauge Buckshot",            category: "Ammunition", stackSize: 64  },
  { shortname: "ammo.shotgun.slug",      name: "12 Gauge Slug",                category: "Ammunition", stackSize: 32  },
  { shortname: "ammo.shotgun.fire",      name: "Incendiary Shotgun Shell",     category: "Ammunition", stackSize: 32  },
  { shortname: "ammo.handmade.shell",    name: "Handmade Shell",               category: "Ammunition", stackSize: 64  },
  { shortname: "arrow.wooden",           name: "Wooden Arrow",                 category: "Ammunition", stackSize: 64  },
  { shortname: "arrow.hv",              name: "HV Arrow",                     category: "Ammunition", stackSize: 64  },
  { shortname: "arrow.fire",            name: "Fire Arrow",                   category: "Ammunition", stackSize: 32  },
  { shortname: "ammo.rocket.basic",      name: "Rocket",                       category: "Ammunition", stackSize: 3   },
  { shortname: "ammo.rocket.hv",         name: "HV Rocket",                    category: "Ammunition", stackSize: 3   },
  { shortname: "ammo.rocket.fire",       name: "Incendiary Rocket",            category: "Ammunition", stackSize: 3   },
  { shortname: "40mm.grenade.he",        name: "40mm HE Grenade",              category: "Ammunition", stackSize: 6   },
  { shortname: "40mm.grenade.smoke",     name: "40mm Smoke Grenade",           category: "Ammunition", stackSize: 6   },

  // Explosives
  { shortname: "explosive.timed",   name: "Timed Explosive (C4)",  category: "Explosives", stackSize: 1  },
  { shortname: "explosive.satchel", name: "Satchel Charge",        category: "Explosives", stackSize: 1  },
  { shortname: "grenade.f1",        name: "F1 Grenade",            category: "Explosives", stackSize: 10 },
  { shortname: "grenade.beancan",   name: "Beancan Grenade",       category: "Explosives", stackSize: 10 },
  { shortname: "surveycharge",      name: "Survey Charge",         category: "Explosives", stackSize: 5  },
  { shortname: "gunpowder",         name: "Gun Powder",            category: "Explosives", stackSize: 1000 },
  { shortname: "explosives",        name: "Explosives",            category: "Explosives", stackSize: 20 },

  // Medical
  { shortname: "syringe.medical", name: "Medical Syringe",      category: "Medical", stackSize: 10 },
  { shortname: "bandage",         name: "Bandage",              category: "Medical", stackSize: 10 },
  { shortname: "largemedkit",     name: "Large Medkit",         category: "Medical", stackSize: 1  },
  { shortname: "antiradpills",    name: "Anti-Radiation Pills", category: "Medical", stackSize: 20 },

  // Resources
  { shortname: "wood",          name: "Wood",                 category: "Resources", stackSize: 1000 },
  { shortname: "stones",        name: "Stone",                category: "Resources", stackSize: 1000 },
  { shortname: "metal.ore",     name: "Metal Ore",            category: "Resources", stackSize: 1000 },
  { shortname: "sulfur.ore",    name: "Sulfur Ore",           category: "Resources", stackSize: 1000 },
  { shortname: "hq.metal.ore",  name: "HQ Metal Ore",         category: "Resources", stackSize: 1000 },
  { shortname: "metal.fragments", name: "Metal Fragments",   category: "Resources", stackSize: 1000 },
  { shortname: "sulfur",        name: "Sulfur",               category: "Resources", stackSize: 1000 },
  { shortname: "metal.refined", name: "High Quality Metal",  category: "Resources", stackSize: 50   },
  { shortname: "lowgradefuel",  name: "Low Grade Fuel",       category: "Resources", stackSize: 500  },
  { shortname: "fat.animal",    name: "Animal Fat",           category: "Resources", stackSize: 1000 },
  { shortname: "cloth",         name: "Cloth",                category: "Resources", stackSize: 1000 },
  { shortname: "leather",       name: "Leather",              category: "Resources", stackSize: 1000 },
  { shortname: "bone.fragments", name: "Bone Fragments",     category: "Resources", stackSize: 1000 },
  { shortname: "scrap",         name: "Scrap",                category: "Resources", stackSize: 1000 },
  { shortname: "charcoal",      name: "Charcoal",             category: "Resources", stackSize: 1000 },
  { shortname: "crude.oil",     name: "Crude Oil",            category: "Resources", stackSize: 1000 },

  // Components
  { shortname: "gears",        name: "Gears",               category: "Components", stackSize: 20  },
  { shortname: "metalblade",   name: "Metal Blade",         category: "Components", stackSize: 20  },
  { shortname: "metalspring",  name: "Metal Spring",        category: "Components", stackSize: 20  },
  { shortname: "roadsigns",    name: "Road Signs",          category: "Components", stackSize: 5   },
  { shortname: "rope",         name: "Rope",                category: "Components", stackSize: 20  },
  { shortname: "riflebody",    name: "Rifle Body",          category: "Components", stackSize: 2   },
  { shortname: "semibody",     name: "Semi Automatic Body", category: "Components", stackSize: 2   },
  { shortname: "smgbody",      name: "SMG Body",            category: "Components", stackSize: 2   },
  { shortname: "techparts",    name: "Tech Trash",          category: "Components", stackSize: 50  },
  { shortname: "tarp",         name: "Tarp",                category: "Components", stackSize: 1   },
  { shortname: "sewingkit",    name: "Sewing Kit",          category: "Components", stackSize: 25  },
  { shortname: "sheetmetal",   name: "Sheet Metal",         category: "Components", stackSize: 20  },
  { shortname: "propanetank",  name: "Propane Tank",        category: "Components", stackSize: 5   },
  { shortname: "piperifle",    name: "Pipe",                category: "Components", stackSize: 5   },
  { shortname: "cctv.camera",  name: "CCTV Camera",         category: "Components", stackSize: 1   },

  // Attire
  { shortname: "metal.facemask",    name: "Metal Face Mask",     category: "Attire", stackSize: 1 },
  { shortname: "metal.plate.torso", name: "Metal Chest Plate",   category: "Attire", stackSize: 1 },
  { shortname: "roadsign.jacket",   name: "Road Sign Jacket",    category: "Attire", stackSize: 1 },
  { shortname: "roadsign.kilt",     name: "Road Sign Kilt",      category: "Attire", stackSize: 1 },
  { shortname: "hoodie",            name: "Hoodie",              category: "Attire", stackSize: 1 },
  { shortname: "pants",             name: "Pants",               category: "Attire", stackSize: 1 },
  { shortname: "shoes.boots",       name: "Boots",               category: "Attire", stackSize: 1 },
  { shortname: "hat.helmet",        name: "Bucket Helmet",       category: "Attire", stackSize: 1 },
  { shortname: "riot.helmet",       name: "Riot Helmet",         category: "Attire", stackSize: 1 },
  { shortname: "hazmatsuit",        name: "Hazmat Suit",         category: "Attire", stackSize: 1 },
  { shortname: "attire.hide.boots", name: "Hide Boots",          category: "Attire", stackSize: 1 },
  { shortname: "attire.hide.helterneck", name: "Hide Halterneck", category: "Attire", stackSize: 1 },
  { shortname: "coffeecan.helmet",  name: "Coffee Can Helmet",   category: "Attire", stackSize: 1 },
  { shortname: "jacket",            name: "Jacket",              category: "Attire", stackSize: 1 },
  { shortname: "shirt.collared",    name: "Collared Shirt",      category: "Attire", stackSize: 1 },
  { shortname: "tactical.gloves",   name: "Tactical Gloves",     category: "Attire", stackSize: 1 },
  { shortname: "nightvisiongoggles", name: "NVGs",               category: "Attire", stackSize: 1 },

  // Tools
  { shortname: "hammer",            name: "Hammer",              category: "Tools", stackSize: 1 },
  { shortname: "building.planner",  name: "Building Plan",       category: "Tools", stackSize: 1 },
  { shortname: "torch",             name: "Torch",               category: "Tools", stackSize: 1 },
  { shortname: "flashlight.held",   name: "Flashlight",          category: "Tools", stackSize: 1 },
  { shortname: "jackhammer",        name: "Jackhammer",          category: "Tools", stackSize: 1 },
  { shortname: "chainsaw",          name: "Chainsaw",            category: "Tools", stackSize: 1 },
  { shortname: "tool.camera",       name: "Camera",              category: "Tools", stackSize: 1 },
  { shortname: "wiretool",          name: "Wire Tool",           category: "Tools", stackSize: 1 },
  { shortname: "hose.tool",         name: "Hose Tool",           category: "Tools", stackSize: 1 },
  { shortname: "rock",              name: "Rock",                category: "Tools", stackSize: 1 },
  { shortname: "stonehatchet",      name: "Stone Hatchet",       category: "Tools", stackSize: 1 },
  { shortname: "pickaxe",           name: "Pickaxe",             category: "Tools", stackSize: 1 },
  { shortname: "hatchet",           name: "Hatchet",             category: "Tools", stackSize: 1 },
  { shortname: "icepick.salvaged",  name: "Salvaged Icepick",    category: "Tools", stackSize: 1 },
  { shortname: "axe.salvaged",      name: "Salvaged Axe",        category: "Tools", stackSize: 1 },

  // Building
  { shortname: "door.hinged.wood",      name: "Wooden Door",        category: "Building", stackSize: 1 },
  { shortname: "door.hinged.metal",     name: "Sheet Metal Door",   category: "Building", stackSize: 1 },
  { shortname: "door.hinged.toptier",   name: "Armored Door",       category: "Building", stackSize: 1 },
  { shortname: "wall.frame.garagedoor", name: "Garage Door",        category: "Building", stackSize: 1 },
  { shortname: "furnace",               name: "Furnace",            category: "Building", stackSize: 1 },
  { shortname: "campfire",              name: "Camp Fire",          category: "Building", stackSize: 1 },
  { shortname: "workbench1",            name: "Work Bench Level 1", category: "Building", stackSize: 1 },
  { shortname: "workbench2",            name: "Work Bench Level 2", category: "Building", stackSize: 1 },
  { shortname: "workbench3",            name: "Work Bench Level 3", category: "Building", stackSize: 1 },
  { shortname: "box.wooden.large",      name: "Large Wood Box",     category: "Building", stackSize: 1 },
  { shortname: "lock.code",             name: "Code Lock",          category: "Building", stackSize: 1 },
  { shortname: "lock.key",              name: "Key Lock",           category: "Building", stackSize: 1 },
  { shortname: "furnace.large",         name: "Large Furnace",      category: "Building", stackSize: 1 },
  { shortname: "refinery.small",        name: "Small Oil Refinery", category: "Building", stackSize: 1 },
  { shortname: "electric.generator.small", name: "Small Generator", category: "Building", stackSize: 1 },
  { shortname: "turret",                name: "Auto Turret",        category: "Building", stackSize: 1 },
  { shortname: "sleepingbag",           name: "Sleeping Bag",       category: "Building", stackSize: 1 },
  { shortname: "bed",                   name: "Bed",                category: "Building", stackSize: 1 },

  // Food
  { shortname: "apple",              name: "Apple",             category: "Food", stackSize: 20 },
  { shortname: "blueberries",        name: "Blueberries",       category: "Food", stackSize: 20 },
  { shortname: "mushroom",           name: "Mushroom",          category: "Food", stackSize: 20 },
  { shortname: "corn",               name: "Corn",              category: "Food", stackSize: 20 },
  { shortname: "pumpkin",            name: "Pumpkin",           category: "Food", stackSize: 20 },
  { shortname: "chicken.cooked",     name: "Cooked Chicken",    category: "Food", stackSize: 20 },
  { shortname: "can.beans",          name: "Canned Beans",      category: "Food", stackSize: 3  },
  { shortname: "can.tuna",           name: "Canned Tuna",       category: "Food", stackSize: 3  },
  { shortname: "water.bottle",       name: "Water Bottle",      category: "Food", stackSize: 1  },
  { shortname: "water.jug",          name: "Water Jug",         category: "Food", stackSize: 1  },
  { shortname: "fish.cooked",        name: "Cooked Fish",       category: "Food", stackSize: 20 },
  { shortname: "bearmeat.cooked",    name: "Cooked Bear Meat",  category: "Food", stackSize: 20 },
  { shortname: "wolfmeat.cooked",    name: "Cooked Wolf Meat",  category: "Food", stackSize: 20 },

  // Misc
  { shortname: "key.card.green", name: "Green Keycard",  category: "Misc", stackSize: 1 },
  { shortname: "key.card.blue",  name: "Blue Keycard",   category: "Misc", stackSize: 1 },
  { shortname: "key.card.red",   name: "Red Keycard",    category: "Misc", stackSize: 1 },
  { shortname: "map",            name: "Map",            category: "Misc", stackSize: 1 },
  { shortname: "paper",          name: "Paper",          category: "Misc", stackSize: 50 },
  { shortname: "supply.signal",  name: "Supply Signal",  category: "Misc", stackSize: 1 },
  { shortname: "targeting.computer", name: "Targeting Computer", category: "Misc", stackSize: 1 },
  { shortname: "frankmachine",   name: "Frankie Machine",category: "Misc", stackSize: 1 },
  { shortname: "xmas.present.medium", name: "Present (Medium)", category: "Misc", stackSize: 1 },
  { shortname: "coal",           name: "Coal :(",        category: "Misc", stackSize: 1 },
  { shortname: "fun.guitar",     name: "Acoustic Guitar",category: "Misc", stackSize: 1 },
];

export function itemsByCategory(category: ItemCategory): RustItem[] {
  if (category === "All") return RUST_ITEMS;
  return RUST_ITEMS.filter((item) => item.category === category);
}

export function itemImageUrl(shortname: string): string {
  return `https://cdn.rusthelper.com/item/${shortname}/image`;
}
