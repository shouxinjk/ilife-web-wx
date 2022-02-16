//搜索结果排序及高亮显示
var helper = new Object();

helper.debug = false;
helper.weight={
  need:{},//各类need的权重，按照倒数设置
  category:2,//meta.category类目权重为2
  source:1//source平台权重为1
};
helper.counter={
  need:{},//需要计数器
  category:{},//类目计数器
  source:{}//平台计数器
};

//设置单个need权重
//needs:need列表 {xxx:0.2,yyy:0.1}
//weight:默认权重
helper.setNeeds = function(needs,weight=0){
  console.log("start set needs weight.",needs);
  //清空原有设置
  helper.weight.need={};
  //设置needs权重
  Object.keys(needs).forEach(key => {
    helper.weight.need[key] = needs[key];//默认直接设置为权重。均为小数。
    //TODO:按照占比倒数计算权重
  });  
}

//单分页权重计算及排序
//输入：待排序列表；输出：完成排序的列表
helper.sort = function(items){
  if(!items || items.length==0){
    console.log("items is null.skipped.");
    return [];
  }

  console.log("try to sort items.",items);
  //逐条计算权重
  var weightedItems = [];//临时存储完成权重计算的item
  items.forEach(item => { 
    var count = {
      need:0,category:0,source:0
    };
    if(item.tagging2 && item.tagging2.satisify && helper.counter.need[item.tagging2.satisify]){
      count.need = helper.counter.need[item.tagging2.satisify];
      helper.counter.need[item.tagging2.satisify] = count.need+1;//计数器累加
    }
    if(item.meta && item.meta.category && helper.counter.category[item.meta.category]){
      count.category = helper.counter.category[item.meta.category];
      helper.counter.category[item.meta.category] = count.category+1;//计数器累加
    }
    if(item.source && helper.counter.source[item.source]){
      count.source = helper.counter.source[item.source];
      helper.counter.source[item.source] = count.source+1;//计数器累加
    }

    //计算权重
    var weight = 0;
    if(item.tagging2 && item.tagging2.satisify && helper.weight.need[item.tagging2.satisify]){
      weight += helper.weight.need[item.tagging2.satisify]*count.need;
    }
    if(item.meta && item.meta.category){
      weight += helper.weight.category * count.category;
    }
    weight += helper.weight.source * count.source;
    //将权重直接设置到item，便于排序
    item.weight = weight;
    weightedItems.push(item);
  });

  //按照权重排序：升序
  weightedItems.sort(function (s1, s2) {
      x1 = s1.weight;
      x2 = s2.weight;
      if (x1 < x2) {
          return -1;
      }
      if (x1 > x2) {
          return 1;
      }
      return 0;
  });
  //搞定了 
  console.log("items sorted.",weightedItems);
  return weightedItems;
}

//计算标签：通过相似度计算得到标签
//person:{a:xx,b:xx,c:xx,d:xx,e:xx,x:aa,y:aa,z:aa}
//item:{a:xx,b:xx,c:xx,d:xx,e:xx,x:aa,y:aa,z:aa}
helper.tagging = function(person,item){
  var tags = [];//是一个数组，每一项均包含标签、类别、权重：{label:xxx,class:xx,weight:xxx}，其中class决定显示风格。
  //检查数据是否满足要求，如果不满足则直接返回
  if(!helper.debug || !item.performance || !item.cost || !person.alpha){
    console.log("invalid input data. skipped.");
    return tags;
  }
  //计算vals匹配度：余弦相似
  var personIndex = "alpha,beta,gamma,delte,epsilon".split(",");
  var itemIndex = "a,b,c,d,e".split(",");
  var vecPerson = [];
  var vecItem = [];
  for(var i=0;i<personIndex.length;i++){
    vecPerson.push(person[personIndex[i]]?person[personIndex[i]]:0.2);
    vecItem.push(item.performance&&item.performance[itemIndex[i]]?item.performance[itemIndex[i]]:0.2);
  }
  var valsSimilarity = helper.cosine(vecPerson,vecItem);
  console.log("vals similarity",valsSimilarity);
  //计算cost匹配度：分别计算x、y、z
  var personIndexCost = "eta,theta,zeta".split(",");
  var itemIndexCost = "x,y,z".split(",");
  var vecPersonCost = [];
  var vecItemCost = [];
  var costSimilarity = [];
  for(var i=0;i<personIndexCost.length;i++){
    vecPersonCost.push(person[personIndexCost[i]]?person[personIndexCost[i]]:0.3);
    vecItemCost.push(item.cost&&item.cost[itemIndexCost[i]]?item.cost[itemIndexCost[i]]:0.3);
    costSimilarity.push(helper.braycurtis1(vecPersonCost[i],vecItemCost[i]));
  }
  costSimilarity.push(helper.cosine(vecPersonCost,vecItemCost));//预留：cost整体相似度
  console.log("cost similarity",costSimilarity);
  //计算标签：vals
  if(valsSimilarity>0.9){
    tags.push({label:"吐血推荐",class:"gold",weight:valsSimilarity});
  }else if(valsSimilarity>0.8){
    tags.push({label:"强烈推荐",class:"red",weight:valsSimilarity});
  }else if(valsSimilarity>0.7){
    tags.push({label:"推荐",class:"green",weight:valsSimilarity});
  }
  //计算标签：cost
  /**
  if(costSimilarity[1]>0.9){//y
    tags.push({label:"气质相符",class:"gold",weight:costSimilarity[1]});
  }else if(costSimilarity[1]>0.75){
    tags.push({label:"风格相近",class:"red",weight:costSimilarity[1]});
  }
  //**/
  if(costSimilarity[2]>0.9){//z
    tags.push({label:"眼光独到",class:"gold",weight:costSimilarity[2]});
  }else if(costSimilarity[2]>0.75){
    tags.push({label:"好眼光",class:"red",weight:costSimilarity[2]});
  }

  console.log("similarity tags.",tags);
  return tags;
}

/*
算法：布雷柯蒂斯相异度（Bray-Curtis distance）
        ∑𝑛𝑖=1|𝑥𝑖−𝑦𝑖|
r= 1 - --------------
        ∑𝑛𝑖=1|𝑥𝑖+𝑦𝑖|

能够支持任意等长向量相似度计算，同时考虑数值差异及绝对数值因素，能够体现二值相似度。数值越大表示差异越大。
*/
helper.braycurtis = function(vectorA,vectorB){
  if(!vectorA || ! vectorB || 
    !Array.isArray(vectorA) || !Array.isArray(vectorB) || 
    vectorA.length==0 || vectorB.length==0 || vectorA.length != vectorB.length ){
    console.log("invalid vectors. skipped.");
    return 0;
  }
  var size = vectorA.length;
  var vecA = 0;
  var vecB = 0;
  for (var i = 0; i < size; i++) {
    vecA += Math.abs(vectorA[i] - vectorB[i]);
    vecB += Math.abs(vectorA[i] + vectorB[i]);
  }
  if(vecB==0)//分母为0
    return 0;
  return 1-vecA/vecB;  
}
//计算单值相似度
helper.braycurtis1 = function(x,y){
  var a = [],b = [];
  a.push(x);
  b.push(y);
  return helper.braycurtis(a,b);
}


/*
算法：余弦相似度
            𝑋⋅𝑌
𝑐𝑜𝑠(𝜃)=--------------
        ||𝑋|| ||𝑌||

余弦相似度距离为1与余弦相似度的差
*/
helper.cosine = function(vectorA,vectorB){
  // cosθ = ∑n, i=1(Ai × Bi) / (√∑n, i=1(Ai)^2) × (√∑n, i=1(Bi)^2) = A · B / |A| × |B|
  if(!vectorA || ! vectorB || 
    !Array.isArray(vectorA) || !Array.isArray(vectorB) || 
    vectorA.length==0 || vectorB.length==0 || vectorA.length != vectorB.length ){
    console.log("invalid vectors. skipped.");
    return 0;
  }
  var size = vectorA.length;
  var innerProduct = 0;
  for (var i = 0; i < size; i++) {
    innerProduct += vectorA[i] * vectorB[i];
  }
  var vecA = 0;
  var vecB = 0;
  for (var i = 0; i < size; i++) {
    vecA += vectorA[i] ** 2;
    vecB += vectorB[i] ** 2;
  }
  var outerProduct = Math.sqrt(vecA) * Math.sqrt(vecB);
  return innerProduct / outerProduct;
}




