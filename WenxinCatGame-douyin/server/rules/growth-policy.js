// Cumulative thresholds; revision marks prevent repeated conversion of existing cats.
const ADULT_GROWTH=800,MAX_GROWTH=1000,GROWTH_REVISION=2;
function migrateGrowth(cat){if(cat.growthRevision===GROWTH_REVISION)return cat;require('./cat-breeds').ensureLegacyBreed(cat);const g=Math.max(0,Number(cat.growth)||0);cat.growth=Math.min(MAX_GROWTH,Math.round(g<25?g*6:g<75?150+(g-25)*5:g<150?400+(g-75)*400/75:800+(g-150)*2));cat.growthRevision=GROWTH_REVISION;cat.milestones=(cat.milestones||[]).map(n=>n===25?150:n===75?400:n===150?800:n);return cat;}
module.exports={ADULT_GROWTH,MAX_GROWTH,GROWTH_REVISION,migrateGrowth};
