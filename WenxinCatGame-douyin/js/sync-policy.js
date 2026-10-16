function interval(data,lastActivity,now,failures=0){const paired=data&&data.paired&&data.role!=='guest',idle=now-lastActivity>=90000,base=paired?20000:idle?120000:60000;return Math.min(300000,base*Math.pow(2,Math.min(4,failures)));}
module.exports={interval};
