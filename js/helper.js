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

  //重置计数器
  /**
  helper.counter={
    need:{},//需要计数器
    category:{},//类目计数器
    source:{}//平台计数器
  };
  //**/
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
    }else if(item.tagging2 && item.tagging2.satisify){
      helper.counter.need[item.tagging2.satisify] = 1;//计数器初始化
    }
    if(item.meta && item.meta.category && helper.counter.category[item.meta.category]){
      count.category = helper.counter.category[item.meta.category];
      helper.counter.category[item.meta.category] = count.category+1;//计数器累加
    }else if(item.meta && item.meta.category){
      helper.counter.category[item.meta.category] = 1;//计数器初始化
    }
    if(item.source && helper.counter.source[item.source]){
      count.source = helper.counter.source[item.source];
      helper.counter.source[item.source] = count.source+1;//计数器累加
    }else if(item.source){
      helper.counter.source[item.source] = 1;//计数器初始化
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
  console.log("items sorted with weight.",helper.weight);
  console.log("items sorted with counter.",helper.counter);
  console.log("items sorted.",weightedItems);
  return weightedItems;
}

//计算标签：通过相似度计算得到标签
//传递用户模型，而不是明细
//person:{alpha:xx,beta:xx,gamma:xx,delte:xx,epsilon:xx,eta:aa,theta:aa,zeta:aa}
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
根据用户key获取vals模型。包括所有featured信息
处理逻辑：
1，从分析库直接获取所有featured信息
2，使用persona数据补充缺失数据
3，返回结果对象
*/
helper.getPersonModel = function(userKey,personaId='0'){
  var userModel = {};
  //根据userKey获取评价结果
  //feature = 1；dimensionType：0客观评价，1主观评价；itemKey=userKey
  //注意：由于clickhouse非严格唯一，需要取最后更新值
  $.ajax({
      url:app.config.analyze_api+"?query=select dimensionKey,score from ilife.info where feature=1 and dimensionType=1 and dimensionKey!='' and itemKey='"+userKey+"' order by ts format JSON",
      type:"get",
      async:false,//同步调用
      //data:{},
      headers:{
          "Authorization":sxConfig.options.ck_auth
      },         
      success:function(json){
          console.log("===got user score===\n",json);
          for(var i=0;i<json.rows;i++){
              if(json.data[i].dimensionKey){
                userModel[json.data[i].dimensionKey] = json.data[i].score;
              }
          }
          console.log("===assemble user evaluation score===\n",userModel);
      }
  });  
  //检查模型数据完整性
  var attrs = "alpha,beta,gamma,delte,epsilon,eta,theta,zeta".split(",");
  if(!userModel.alpha || !userModel.beta || !userModel.gamma || !userModel.delte || !userModel.epsilon ||
     !userModel.eta || ! userModel.theta || !userModel.zeta ){
      //根据persona补充数据
      $.ajax({
          url:app.config.sx_api+"/mod/persona/rest/persona/"+personaId,
          type:"get",
          async:false,//同步调用        
          success:function(persona){
              console.log("===got persona info===\n",persona);
              //补充
              if(persona && persona.id){
                //逐个检查补充缺失元素
                attrs.forEach(attr => {
                  if(!userModel[attr]){
                    userModel[attr] = persona[attr]?persona[attr]:0.4;
                  }
                });
              }
              console.log("=== user evaluation score updated===\n",userModel);
          }
      }); 
  }

  //从分析库获取需要构成:结果包含该用户的所有需要
  //注意：由于clickhouse非严格唯一，需要取最后更新值
  var needs = [];
  $.ajax({
      url:app.config.analyze_api+"?query=SELECT userKey,needId,needName,sumMerge(weight) as weight FROM ilife.need_agg where userKey='"+userKey+"' GROUP BY userKey,needId,needName format JSON",
      type:"get",
      async:false,//同步调用
      //data:{},
      headers:{
          "Authorization":sxConfig.options.ck_auth
      },         
      success:function(json){
          console.log("===parse user needs===\n",json);
          if(json.rows>0){
            console.log("===total needs===\n",json.rows);
            needs = json.data;
          }else{
            console.log("===no needs found===\n");
          }
      }
  });    

  //从persona获取数据，补充需要构成
  if(needs.length<5){//如果缺少needs则使用persona补充
      //先记录已经获取的needId
      var needIds = "";
      needs.forEach(need => {
        needIds += ","+need.needId;
      });

      $.ajax({
          url:app.config.sx_api+"/mod/persona/rest/needs/"+personaId,
          type:"get",
          async:false,//同步调用       
          success:function(personaNeeds){
              console.log("===got persona needs===\n",'personaId='+personaId,personaNeeds);
              personaNeeds.forEach( personaNeed => {
                if(needIds.indexOf(personaNeed.need.id)<0 && personaNeed.weight>1){//如果不存在则加入
                    needs.push({
                      userKey:userKey,
                      needId:personaNeed.need.id,
                      needName:personaNeed.need.name,
                      weight:personaNeed.weight
                    });
                }
              });
          }
      }); 
  }
  userModel.needs = needs;
 
  //返回模型
  return userModel;
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
𝑐𝑜𝑠(𝜃)=---------------
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

/**
跟踪频道变化：根据当前用户行为操作调整其需要构成及属性设置

参数说明：
channelId：频道ID，
actionCategory：操作类别：channel/item/tag。traceChannel内固定为channel
actionType: 操作类型：click/view/buy/label/...
userInfo：操作影响的用户：指该操作对那些用户产生影响
subject：发起操作的用户：固定为app.globalData.userInfo._key

算法逻辑：
0，subject用户及发起用户直接采用app.globalData.userInfo._key
1，根据动作类型获取对应的行为定义
2，根据动作主题获取相关的需要列表
3，计算需要权重并提交
4，根据行为定义完成用户属性修改
*/
helper.traceChannel = function(channelId,actionType,userInfo){
  //根据channelId获取需要构成
  var channelNeeds = [];
  $.ajax({
      url:app.config.sx_api+"/mod/channel/rest/needs/"+channelId,
      type:"get",
      async:false,//同步调用       
      success:function(json){
          console.log("===got channnel needs===\n",json);
          channelNeeds = json;
      }
  });  
  if(channelNeeds.length == 0){
    console.log("===no needs hooked on channnel===",channelId);
    return;
  }   
  //根据操作类型：category、type获取行为定义
  var behaviors = [];
  $.ajax({
      url:app.config.sx_api+"/ope/behavior/rest/actions/channel/"+actionType,
      type:"get",
      async:false,//同步调用       
      success:function(json){
          console.log("===got channnel behaviors===\n",json);
          behaviors = json;
      }
  });  
  if(behaviors.length == 0){
    console.log("===no behaviors hooked on channel actionType===",actionType);
    return;
  }    
  //获取当前用户的需要构成：通过getPersonModel得到
  //var userModel = helper.getPersonModel(userInfo._key);//根据传入的用户获取其需要模型
  //根据channel及当前用户的需要构成循环计算得到需要影响并提交分析库
  for(var i=0;i<behaviors.length;i++){//不要怕，通常情况下不会有多于1个的行为定义
    var behavior = behaviors[i];
    if(behavior.exprUserNeed && behavior.exprUserNeed.indexOf("xWeight")>-1){//仅在定义了expr才进行
      var weight = 0;
      try{
          eval(behavior.exprUserNeed);//评估得到xWeight
          if(xWeight && xWeight !=0){//ok。继续
            console.log("===eval behavior.exprUserNeed succeed===",xWeight);
            weight = xWeight;
          }else{//变化因子都没得到，别玩了。找运营算账吧
            console.log("===failed eval behavior.exprUserNeed===");
            continue;
          }
      }catch(err){
          console.log("\nerror while eval behavior.exprUserNeed\n",err);
      }       
      for(var j=0;j<channelNeeds.length;j++){//不要怕，通常不会有超过5个
        var channelNeed = channelNeeds[j];
        //当前不考虑与userNeed交互关系，直接增加weight。完成需要修改
        console.log("try to log need change");
        helper.logNeedChange(
          userInfo._key,//target user
          channelNeed.need.id,channelNeed.need.type,channelNeed.need.name,channelNeed.need.displayName,//need info
          weight*channelNeed.weight,//weight
          'channel',actionType,//action info
          'user',app.globalData.userInfo?app.globalData.userInfo._key:'dummy',//subject info
          'channel',channelId//object info
        );
      }
    }
  }
}

/**
跟踪内容操作事件：根据当前用户对条目的操作调整其需要构成及属性设置

参数说明：
item：对应商品条目，
actionCategory：操作类别：channel/item/tag。traceItem内固定为item
actionType: 操作类型：view/buy/share/...
userInfo：操作影响的用户：指该操作对那些用户产生影响
subject：发起操作的用户：固定为app.globalData.userInfo._key

算法逻辑：
0，subject用户及发起用户直接采用app.globalData.userInfo._key
1，根据动作类型获取对应的行为定义
2，根据动作主题获取相关的需要列表
3，计算需要权重并提交
4，根据行为定义完成用户属性修改
*/
helper.traceItem = function(item,actionType,userInfo){
    //根据item.meta.category获取需要构成
    //检查商品类目
    if(item&&item.meta&&item.meta.category){
      //ok 继续吧
    }else{
      console.log("item.meta.category is null. skipped.");
      return;
    }
    //根据动作类型获取对应的需要列表
    var itemNeeds = [];
    $.ajax({
        url:app.config.sx_api+"/mod/itemCategory/rest/needs/"+item.meta.category,
        type:"get",
        async:false,//同步调用       
        success:function(json){
            console.log("===got item category needs===\n",json);
            itemNeeds = json;
        }
    });  
    if(itemNeeds.length == 0){
      console.log("===no needs hooked on item category===",item.meta.category);
      return;
    }   
    //根据操作类型：category、type获取行为定义
    var behaviors = [];
    $.ajax({
        url:app.config.sx_api+"/ope/behavior/rest/actions/item/"+actionType,//注意：actionType不能带有空格，否则会报错
        type:"get",
        async:false,//同步调用       
        success:function(json){
            console.log("===got item behaviors===\n",json);
            behaviors = json;
        }
    });  
    if(behaviors.length == 0){
      console.log("===no behaviors hooked on item actionType===",actionType);
      return;
    }     
    //计算权重
    //获取当前用户的需要构成：通过getPersonModel得到
    var userModel = helper.getPersonModel(userInfo._key,userInfo.persona?userInfo.persona._key:'0');//根据传入的用户获取其需要模型
    var userNeeds = userModel.needs;
    //根据channel及当前用户的需要构成循环计算得到需要影响并提交分析库
    for(var i=0;i<behaviors.length;i++){//不要怕，通常情况下不会有多于1个的行为定义
      var behavior = behaviors[i];
      if(behavior.exprUserNeed && behavior.exprUserNeed.indexOf("xWeight")>-1){//仅在定义了expr才进行
        var weight = 0;
        try{
            eval(behavior.exprUserNeed);//评估得到xWeight
            if(xWeight && xWeight !=0){//ok。继续
              console.log("===eval behavior.exprUserNeed succeed===",xWeight);
              weight = xWeight;
            }else{//变化因子都没得到，别玩了。找运营算账吧
              console.log("===failed eval behavior.exprUserNeed===");
              continue;
            }
        }catch(err){
            console.log("\nerror while eval behavior.exprUserNeed\n",err);
        }       
        for(var j=0;j<itemNeeds.length;j++){//不要怕，通常不会有超过5个
          var itemNeed = itemNeeds[j];
          var userNeed = userNeeds.find(entry => {
            return entry.needId == itemNeed.id;
          });
          console.log("got user need.",userNeed);
          //当前不考虑与userNeed交互关系，直接增加weight。完成需要修改
          console.log("try to log need change");
          helper.logNeedChange(
            userInfo._key,//target user
            itemNeed.need.id,itemNeed.need.type,itemNeed.need.name,itemNeed.need.displayName,//need info
            weight*itemNeed.weight*(userNeed?userNeed.weight:1),//weight
            'item',actionType,//action info
            'user',app.globalData.userInfo?app.globalData.userInfo._key:'dummy',//subject info
            'item',item._key//object info
          );
        }
      }
    }  
    //TODO：完成用户属性及商品属性修改
}

/*
完成需要变化修改。是增量。
操作很简单，直接写入即可。麻烦的事情就让分析系统去搞定。
*/
helper.logNeedChange = function(userKey,needId,needType,needName,needAlias,weight,actionCategory,actionType,subjectType,subjectKey,objectType,objectKey){
    var q = "insert into ilife.need values ('"+userKey+"','"+
            needId+"','"+needType+"','"+needName+"','"+needAlias+"',"+
            weight+",'"+
            actionCategory+"','"+actionType+"','"+
            subjectType+"','"+subjectKey+"','"+
            objectType+"','"+objectKey+"',now())";
    console.log("try to log need change with query.",q);
    $.ajax({
        url:app.config.analyze_api+"?query="+q,
        type:"post",
        //data:{},
        headers:{
            "Authorization":sxConfig.options.ck_auth
        },         
        success:function(json){
            console.log("===need changne logged.===\n",json);
        }
    }); 
}


