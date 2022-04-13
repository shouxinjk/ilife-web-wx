// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    rootFontSize = rootFontSize >16 ? 16:rootFontSize;//最大为18px
    oHtml.style.fontSize = rootFontSize+ "px";
    //计算图片流宽度：根据屏幕宽度计算，最小显示2列
    if(width < 2*columnWidth){//如果屏幕不能并排2列，则调整图片宽度
        columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }
    var args = getQuery();//获取参数
    if(args["id"])inputPerson=args["id"];//从请求中获取需要展示的person或personaId
    from = args["from"]?args["from"]:"mp";//来源于公众号、企业微信、web端
    fromUser = args["fromUser"]?args["fromUser"]:"o8HmJ1ItjXilTlFtJNO25-CAQbbg";//从连接中获取分享用户ID：默认设置为Judy

    console.log("got params from & fromUser from query.",from,fromUser);

    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });
    if(from=="wework" || from=="web"){//如果是来源于企业微信或web端则单独加载：注意，此处仅为临时解决方案，能够显示首页，但进入后无法切换
      loadUserInfoByOpenid(fromUser);//加载过程：加载用户信息、加载达人信息、加载关心的人并触发加载数据
    }else{//根据微信公众号登录流程获取达人信息，并加载关心的人
      //加载达人信息
      loadBrokerInfo();    
      //加载关心的人
      loadPersons();
      //在加载达人后再加载数据，避免brokerInfo缺失
      //TODO：注意，这里不严谨，需要调整为在回调中加载，否则可能出现数据缺失
      startQueryDataLoop();
    }

    //判定是否有编辑中的board
    if(args["boardId"]){//如果参数中有boardId则优先使用
        boardId = args["boardId"];
        var board = {
            id:boardId
        };
        $.cookie('board', JSON.stringify(board), { expires: 3650, path: '/' });  //把编辑中的board写入cookie。能够跳转到其他页面继续添加
    }
    getBoard();//从cookie内加载

    category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录
    tagging = args["keyword"]?args["keyword"]:""; //通过搜索跳转
    filter = args["filter"]?args["filter"]:""; //根据指定类型进行过滤
    if(args["categoryTagging"])categoryTagging=args["categoryTagging"];
    if(args["personTagging"])personTagging=args["personTagging"];
    if(tagging.trim().length>0){
        $(".search input").attr("placeholder","🔍 "+tagging);
    }
    loadCategories(category);//加载导航目录
    $("#searchBtn").click(function(event){//注册搜索事件
        tagging = $(".search input").val().trim();
        if(tagging.length>1){
            window.location.href="index.html?keyword="+tagging;
        }else{
            console.log("do nothing because there is no input text.");
        }
    });

    $("#findAll").click(function(){//注册搜索事件：点击搜索全部
        tagging = $(".search input").val().trim();
        //window.location.href="index.html?keyword="+tagging;
        loadData();
    }); 

    //加载filter并高亮
    loadFilters(filter);
    //高亮显示当前选中的filter
    //highlightFilter();

    //加载用户信息及模型
    loadPersonById(util.getUserInfo()._key);

    //显示清单分享浮框
    showShareContent();

//TODO：切换为复杂查询。需要在索引结构更新后进行
    //console.log("assemble", assembleEsQuery());     
    //console.log(JSON.stringify(assembleEsQuery()));  
});

var currentPersonJson = {};//当前用户明细
var currentPersonModel = {};//当前用户模型

util.getUserInfo();//从本地加载cookie

var broker = {
  id:"77276df7ae5c4058b3dfee29f43a3d3b"//默认设为Judy达人
};

//记录分享用户、分享达人
var from = "mp";//链接来源，页面来源有三类：公众号、企业微信、web端。从公众号进入为默认处理，其他的需要特殊处理
var fromUser = "";

//加载board信息
var boardId = null;

var columnWidth = 300;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有内容列表
var itemKeys = [];//记录itemKey列表，用于排重。服务器端存在重复数据
var category  = 0; //当前目录ID
var tagging = ""; //当前目录关联的查询关键词，搜索时直接通过该字段而不是category进行
var filter = "";//通过filter区分好价、好物、附近等不同查询组合

var categoryTagging = "";//记录目录切换标签，tagging = categoryTagging + currentPersonTagging


//直接读取用户信息:从企业微信或web进入时，默认需要携带fromUser信息 ，根据fromUser加载用户及达人数据
function loadUserInfoByOpenid(openid){
  util.checkPerson({openId:openid},function(res){
    app.globalData.userInfo = res;//直接从请求获取信息
    var sxUserInfo={//存入cookie，企业微信不能处理中文，只能存储id
      openid:res.openid,
      avatarUrl:res.avatarUrl,
      nickName:res.nickName
    };
    document.cookie = "sxUserInfo="+JSON.stringify(sxUserInfo)+"; SameSite=None; Secure";
    loadBrokerInfoByOpenid(openid);//用户加载后再加载达人信息
    loadPersons();//用户加载后加载关联用户及客群
  });
}
//直接读取达人信息
function loadBrokerInfoByOpenid(openid){
  util.checkBroker(openid,function(res){
    broker = {//直接从请求获取信息：注意，企业微信不能正确处理带有中文字符部分，此处仅存储id
      id:res.data.id,
      openid:res.data.openid
    }

    //直接写入cookie，避免同源问题
    document.cookie = "sxBrokerInfo="+JSON.stringify(broker)+"; SameSite=None; Secure";
    document.cookie = "hasBrokerInfo="+res.status+"; SameSite=None; Secure";

    //TODO：在加载达人后再加载数据，避免brokerInfo缺失
    startQueryDataLoop();
  });
}
//开始查询数据
function startQueryDataLoop(){
    setInterval(function ()
    {
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            // 表示开始加载
            loading = true;

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                loadItems();
            }else{//否则使用本地内容填充
                insertItem();
            }
        }
    }, 60);  
}

//优先从cookie加载达人信息
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
}

function highlightFilter(){
    if(filter=="byProfit"){
        $("#findByProfit").addClass("searchBtn-highlight");
    }else if(filter=="byPrice"){
        $("#findByPrice").addClass("searchBtn-highlight");
    }else if(filter=="byRank"){
        $("#findByRank").addClass("searchBtn-highlight");
    }else if(filter=="byDistance"){
        $("#findByDistance").addClass("searchBtn-highlight");
    }
}

var page = {
    size:20,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

//查询模板
var esQueryTemplate = JSON.stringify({
  "from": 0,
  "size": page.size,    
  "query":{
    "bool":{
      "must": [],       
      "must_not": [],                
      "filter": [],      
      "should":[]
    }
  },
  "sort": [
  /*
    { "_score":   { "order": "desc" }},
    { "@timestamp": { "order": "desc" }}
    //**/
  ]   
});

//组织关键字查询。包括三类：手动输入、来源于用户标注、来源于目录标注
//关键字查询逻辑为： (手动OR输入) AND (用户OR标注) AND (目录OR标注);以下为单个查询样例：
/**
{
    "bool" : {
           "should" : [
               {"match" : {"full_tags": "宠物 高原"}},
               {"match" : {"full_text": "宠物 高原"}}
           ],
          "minimum_should_match": 1
          }
     }
*/
var taggingBoolQueryTextTemplate = JSON.stringify({"match" : {"full_text": ""}});//在full_text字段搜索
var taggingBoolQueryTagsTemplate = JSON.stringify({"match" : {"full_tags": ""}});//在full_tags字段搜索
var taggingBoolQueryShouldTemplate = JSON.stringify({
    "bool" : {
           "should" : [],
          "minimum_should_match": 1
          }
     });
//组建 手动输入/用户标注/目录标注 查询。将加入MUST查询
function buildTaggingQuery(keyword){
    var q = JSON.parse(taggingBoolQueryShouldTemplate);
    //组织full_text查询
    var textTerm = JSON.parse(taggingBoolQueryTextTemplate);
    textTerm.match.full_text = keyword;
    q.bool.should.push(textTerm);
    //组织full_tags查询
    /*
    var textTags = JSON.parse(taggingBoolQueryTagsTemplate);
    textTags.match.full_tags = keyword;
    q.bool.should.push(textTags);
    //**/
    //返回组织好的bool查询
    return q;
}


var sortByScore = { "_score":   { "order": "desc" }};
var sortByTimestamp = { "@timestamp":   { "order": "desc" }};

var sortByPrice = { "price.sale":   { "nested_path" : "price","order": "asc" }};
var sortByRank = { "rank.score":   { "nested_path" : "rank","order": "desc" }};
var sortByProfit = { "profit.order":   { "nested_path" : "profit","order": "desc" }};

//根据价格高低计算得分：价格越高，得分越低
//注意：这里添加了数值检查，如果price.sale为0 则直接得分1
var funcQueryByPrice = {
    "nested": {
      "path": "price",
      "score_mode": "min", 
      "query": {
        "function_score": {
          "script_score": {
            "script": "_score * (doc['price.sale'].value==0?1:(2-doc['price.sale'].value/(doc['price.bid'].value==0?doc['price.sale'].value:doc['price.bid'].value)))"
          }
        }
      }
    }
  };

//根据评价计算得分：评分越高，得分越高
var funcQueryByRank = {
    "nested": {
      "path": "rank",
      "score_mode": "avg", 
      "query": {
        "function_score": {
          "script_score": {
            "script": "_score * (1+doc['rank.score'].value/(doc['rank.base'].value==0?5:doc['rank.base'].value))"
          }
        }
      }
    }
  };

//根据佣金高低计算得分：佣金越高，得分越高
var funcQueryByProfit =  {
    "nested": {
      "path": "profit",
      "score_mode": "min", 
      "query": {
        "function_score": {
          "script_score": {
            "script": "_score * doc['profit.amount'].value"
          }
        }
      }
    }
  };

//根据距离远近计算得分：离用户越近，得分越高
//默认中心点为成都天府广场
var funcQueryByDistance = {
    "function_score": {
        "functions": [
            {
              "gauss": {
                "location": { 
                      "origin": { "lat": 30.6570, "lon": 104.0650 },
                      "offset": "3km",
                      "scale":  "2km"
                }
              }
            }
        ],
        "boost_mode": "multiply"
    }
};

//组织满足度查询：需要合并进入 buildEsQuery内部构建。当前仅为测试
//样例模板如下：
/*
{
          "nested": {
            "path": "performance",
            "ignore_unmapped":true,
            "query": {
              "function_score": {
                "functions": [
                  {
                      "gauss":{
                        "performance.a":{
                          "origin":0.5,
                          "offset":0.25,
                          "scale":0.25
                        }
                      }
                  },
                  {
                      "gauss":{
                        "performance.a":{
                          "origin":0.5,
                          "offset":0.25,
                          "scale":0.25
                        }
                      }
                  },
                  {
                      "gauss":{
                        "performance.c":{
                          "origin":0.5,
                          "offset":0.25,
                          "scale":0.25
                        }
                      }
                  },
                  {
                      "gauss":{
                        "performance.b":{
                          "origin":0.5,
                          "offset":0.25,
                          "scale":0.25
                        }
                      }
                  },
                  {
                      "gauss":{
                        "performance.e":{
                          "origin":0.5,
                          "offset":0.25,
                          "scale":0.25
                        }
                      }
                  }                  
                ],
                "score_mode": "sum",
                "boost_mode": "multiply"
              }
            }
          }
        },    
       {
          "nested": {
            "path": "cost",
            "ignore_unmapped":true,
            "query": {
              "function_score": {
                "functions": [
                  {
                      "gauss":{
                        "cost.x":{
                          "origin":0.5,
                          "offset":0.25,
                          "scale":0.25
                        }
                      }
                  },
                  {
                      "gauss":{
                        "cost.y":{
                          "origin":0.5,
                          "offset":0.25,
                          "scale":0.25
                        }
                      }
                  },
                  {
                      "gauss":{
                        "cost.z":{
                          "origin":0.5,
                          "offset":0.25,
                          "scale":0.25
                        }
                      }
                  }                  
                ],
                "score_mode": "sum",
                "boost_mode": "multiply"
              }
            }
          }
        },         
        {
          "nested": {
            "path": "fulfillment",
            "ignore_unmapped":true,
            "query": {
              "function_score": {
                "functions": [
                  {
                      "gauss":{
                        "fulfillment.45809fa7cdc1406eac3337545ca2ab5c":{
                          "origin":0.7,
                          "offset":0.1,
                          "scale":0.1
                        }
                      },
                      "weight":1
                  },
                  {
                      "gauss":{
                        "fulfillment.5adf1b874cf54d0b82533497d9ecd1a4":{
                          "origin":0.1,
                          "offset":0.1,
                          "scale":0.1
                        }
                      }
                  }            
                ],
                "score_mode": "sum",
                "boost_mode": "multiply"
              }
            }
          }
        }
*/
function assembleEsQuery(){
    var userInfo = {
        persona:{
            tagging:{
                must:["爱心","宠物"],
                must_not:["狗肉","宰杀"],
                filter:["宠物"],
                should:["围栏"]
            }
        },
        performance:{
            a:0.15,
            b:0.25,
            c:0.35,
            d:0.45,
            e:0.55
        },
        capability:{
            x:0.95,
            y:0.85,
            z:0.75
        },
        /*
        needs:{
            "45809fa7cdc1406eac3337545ca2ab5c":0.6,
            "5adf1b874cf54d0b82533497d9ecd1a4":0.1
        }
        //**/
    }


    var persona = userInfo.persona;
    if(!persona){
        return esQuery;
    }

    var complexQuery = JSON.parse(esQueryTemplate);
    //添加must
    if(userInfo.tagging && userInfo.tagging.must){
        complexQuery.query.bool.must.push({match: { full_tags: userInfo.tagging.must.join(" ")}});
    }else if(persona.tagging && persona.tagging.must){
        complexQuery.query.bool.must.push({match: { full_tags: persona.tagging.must.join(" ")}});
    }else{
        console.log("no must");
    }
    //添加must_not
    if(userInfo.tagging && userInfo.tagging.must_not){
        complexQuery.query.bool.must_not.push({match: { full_tags: userInfo.tagging.must_not.join(" ")}});
    }else if(persona.tagging && persona.tagging.must_not){
        complexQuery.query.bool.must_not.push({match: { full_tags: persona.tagging.must_not.join(" ")}});
    }else{
        console.log("no must_not");
    }
    //添加filter
    if(userInfo.tagging && userInfo.tagging.filter){
        complexQuery.query.bool.filter.push({match: { full_tags: userInfo.tagging.filter.join(" ")}});
    }else if(persona.tagging && persona.tagging.filter){
        complexQuery.query.bool.filter.push({match: { full_tags: persona.tagging.filter.join(" ")}});
    }else{
        console.log("no filter");
    }
    //添加should
    if(userInfo.tagging && userInfo.tagging.should){
        complexQuery.query.bool.should.push({match: { full_tags: userInfo.tagging.should.join(" ")}});
    }else if(persona.tagging && persona.tagging.should){
        complexQuery.query.bool.should.push({match: { full_tags: persona.tagging.should.join(" ")}});
    }else{
        console.log("no should");
    }
    /**
        {
          "gauss":{
            "fulfillment.45809fa7cdc1406eac3337545ca2ab5c":{
              "origin":0.7,
              "offset":0.1,
              "scale":0.1
            }
          }
        }    
    */
    var nestedTemplate = JSON.stringify({
                              "nested": {
                                "path": "empty",
                                "ignore_unmapped":true,
                                "query": {
                                  "function_score": {
                                    "functions": [],
                                    "score_mode": "sum",
                                    "boost_mode": "multiply"
                                  }
                                }
                              }
                            });
    var gaussTemplate = JSON.stringify({"gauss":{}});
    var valTemplate = JSON.stringify({
                          "origin":0.5,
                          "offset":0.1,
                          "scale":0.1
                        });   
    var stringTemplate = JSON.stringify({
                          "query_string": {
                            "query": "*",
                            "default_field": "full_text"
                          }
                        });
    //设置用户输入文字查询
    if(tagging && tagging.trim().length>0){
        var stringQueryJson = JSON.parse(stringTemplate);
        stringQueryJson.query_string.query = tagging;
        complexQuery.query.bool.should.push(stringQueryJson);
    }
    //设置vals
    var valsJson = userInfo.performance;
    if(valsJson){
        var valsGauss = JSON.parse(nestedTemplate);
        valsGauss.nested.path="performance";
        Object.keys(valsJson).forEach(key => {
            //console.info(key + ':', valsJson[key])
            var gaussDecay = JSON.parse(gaussTemplate);
            var val = JSON.parse(valTemplate);
            val.origin = valsJson[key];
            gaussDecay.gauss["performance."+key] = val;
            valsGauss.nested.query.function_score.functions.push(gaussDecay);        
        });
        complexQuery.query.bool.should.push(valsGauss);
    }
    //设置cost
    var costJson = userInfo.capability;
    if(costJson){
        var costGauss = JSON.parse(nestedTemplate);
        costGauss.nested.path="cost";
        Object.keys(costJson).forEach(key => {
            //console.info(key + ':', costJson[key])
            var gaussDecay = JSON.parse(gaussTemplate);
            var val = JSON.parse(valTemplate);
            val.origin = costJson[key];
            gaussDecay.gauss["cost."+key] = val;
            costGauss.nested.query.function_score.functions.push(gaussDecay);        
        }); 
        complexQuery.query.bool.should.push(costGauss);  
    }
    //设置satisify
    var needsJson = userInfo.needs;
    if(needsJson){
        var needsGauss = JSON.parse(nestedTemplate);
        needsGauss.nested.path="fulfillment";
        Object.keys(needsJson).forEach(key => {
            //console.info(key + ':', needsJson[key])
            var gaussDecay = JSON.parse(gaussTemplate);
            var val = JSON.parse(valTemplate);
            val.origin = needsJson[key];
            gaussDecay.gauss["fulfillment."+key] = val;
            needsGauss.nested.query.function_score.functions.push(gaussDecay);        
        });
        complexQuery.query.bool.should.push(needsGauss); 
    }
    return complexQuery;     
}


function buildEsQuery(){
    var complexQuery = JSON.parse(esQueryTemplate);
    //添加must
    if(tagging && tagging.trim().length > 0){//手动输入搜索条件
        complexQuery.query.bool.must.push(buildTaggingQuery(tagging));
    }
    if(currentPersonTagging && currentPersonTagging.trim().length > 0){//用户或画像标注
        complexQuery.query.bool.must.push(buildTaggingQuery(currentPersonTagging));
    }
    if(categoryTagging && categoryTagging.trim().length > 0){//目录标注
        complexQuery.query.bool.must.push(buildTaggingQuery(categoryTagging));
    }    
    //TODO：添加must_not
    /*
    if(userInfo.tagging && userInfo.tagging.must_not){
        complexQuery.query.bool.must_not.push({match: { full_tags: userInfo.tagging.must_not.join(" ")}});
    }else if(persona.tagging && persona.tagging.must_not){
        complexQuery.query.bool.must_not.push({match: { full_tags: persona.tagging.must_not.join(" ")}});
    }else{
        console.log("no must_not");
    }*/
    //TODO：添加filter
    /*
    if(userInfo.tagging && userInfo.tagging.filter){
        complexQuery.query.bool.filter.push({match: { full_tags: userInfo.tagging.filter.join(" ")}});
    }else if(persona.tagging && persona.tagging.filter){
        complexQuery.query.bool.filter.push({match: { full_tags: persona.tagging.filter.join(" ")}});
    }else{
        console.log("no filter");
    }*/

    //添加排序规则：byRank/byPrice/byProfit/byDistance
    if(filter && filter.trim()=="byPrice"){//根据价格排序
        complexQuery.query.bool.should.push(funcQueryByPrice);
        //complexQuery.sort.push(sortByPrice);
    }else if(filter && filter.trim()=="byDistance"){//根据位置进行搜索。优先从用户信息中获取经纬度，否则请求获取得到当前用户经纬度
        //TODO 需要使用当前选中的用户进行设置：如果选中的是画像怎么办？？
        funcQueryByDistance.function_score.functions[0].gauss.location.origin.lat = app.globalData.userInfo.location.latitude;
        funcQueryByDistance.function_score.functions[0].gauss.location.origin.lon = app.globalData.userInfo.location.longitude;
        complexQuery.query.bool.should.push(funcQueryByDistance);
    }else if(filter && filter.trim()=="byProfit"){//根据佣金排序
        //complexQuery.query.bool.should.push(funcQueryByProfit);
        complexQuery.sort.push(sortByProfit);
    }else if(filter && filter.trim()=="byRank"){//根据评价排序
        //complexQuery.query.bool.should.push(funcQueryByRank);
        complexQuery.sort.push(sortByRank);
    }else{
        //do nothing
        console.log("Unsupport filter type.[filter]",filter);
    }

    //默认根据得分及时间排序
    complexQuery.sort.push(sortByScore);
    complexQuery.sort.push(sortByTimestamp);

    //TODO 添加vals
    //TODO 添加cost
    //TODO 添加satisify

    //返回query
    return complexQuery;
}

//默认查询。将通过buildEsQuery()进行校正
var esQuery={
    from:0,
    size:page.size,
    query: {
        match_all: {}
    },
    sort: [
        { "@timestamp": { order: "desc" }},
        { "_score":   { order: "desc" }}
    ]
};


function getBoard(){
    var boardInfo = $.cookie('board');
    console.log("load board from cookie.",boardInfo);
    if(boardInfo && boardInfo.trim().length>0){
        console.log("get board info from cookie.",boardInfo);
        var board = JSON.parse(boardInfo);
        boardId = board?board.id:null;
    }else{
      console.log("no board from cookie.",boardInfo);
    }
}
/**
setInterval(function ()
{
    if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
    {
        // 表示开始加载
        loading = true;

        // 加载内容
        if(items.length < num){//如果内容未获取到本地则继续获取
            loadItems();
        }else{//否则使用本地内容填充
            insertItem();
        }
    }
}, 60);
//**/

function loadItems(){//获取内容列表
    //构建esQuery
    esQuery = buildEsQuery();//完成query构建。其中默认设置了每页条数
    //处理翻页
    esQuery.from = (page.current+1) * page.size;
    console.log("\ntry search by query.[esQuery]",esQuery,"\n");
    $.ajax({
        url:"https://data.pcitech.cn/stuff/_search",
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        crossDomain: true,
        timeout:3000,//设置超时
        success:function(data){
            console.log("got result",data);
            if(data.hits.total == 0 || data.hits.hits.length == 0){//如果没有内容，则显示提示文字
                console.log("no more results. show no more button.");
                shownomore(true);
            }else{
                //更新总页数
                var total = data.hits.total;
                page.total = (total + page.size - 1) / page.size;
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                var hits = data.hits.hits;
                /**
                for(var i = 0 ; i < hits.length ; i++){
                    if(itemKeys.indexOf(hits[i]._source._key)<0){
                      itemKeys.push(hits[i]._source._key);
                      items.push(hits[i]._source);
                    }                    
                }
                //**/
                //将返回结果打散。按分页采用临时队列
                var tmpItems = [];
                hits.forEach(hit =>{
                  tmpItems.push(hit._source);
                });
                //将排序结果加入待显示列表
                helper.sort(tmpItems).forEach(hit => {
                  if(itemKeys.indexOf(hit._key)<0){
                      itemKeys.push(hit._key);
                      items.push(hit);
                    }                    
                });
                insertItem();
            }
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则显示更多按钮
              console.log("ajax超时",textStatus);
              shownomore(true);
            }
        },
        error: function () {//调用出错执行的函数
            //请求出错处理：超时则直接显示搜索更多按钮
            shownomore(true);
          }

    })
}

//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
    //检查是否还有，如果没有则显示已完成
    if(!item){
      shownomore(true);
      return;
    }
    //隐藏no-more-tips
    $("#no-results-tip").toggleClass("no-result-tip-hide",true);
    $("#no-results-tip").toggleClass("no-result-tip-show",false);    

    var imgWidth = columnWidth-2*columnMargin;//注意：改尺寸需要根据宽度及留白计算，例如宽度为360，左右留白5，故宽度为350
    var imgHeight = random(50, 300);//随机指定初始值
    //计算图片高度
    var img = new Image();
    img.src = item.images?item.images[0]:"https://www.biglistoflittlethings.com/list/images/logo00.jpeg";
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算
    //console.log("orgwidth:"+orgWidth+"orgHeight:"+orgHeight+"width:"+imgWidth+"height:"+imgHeight);
    var image = "<img src='"+item.images[0]+"' width='"+imgWidth+"' height='"+imgHeight+"'/>"
    var tagTmpl = "<a class='itemTag' href='index.html?keyword=__TAGGING'>__TAG</a>";
    var highlights = "<div class='itemTags'>";
    highlights += "<a class='itemTagPrice' href='#'>"+(item.price.currency?item.price.currency:"¥")+item.price.sale+"</a>";
    if(item.price.coupon>0){
        highlights += "<span class='couponTip'>券</span><span class='coupon' href='#'>"+item.price.coupon+"</span>";
    }    
    highlights += tagTmpl.replace("__TAGGING",item.distributor.name).replace("__TAG",item.distributor.name).replace("itemTag","itemTagDistributor");
    highlights += '<span id="jumpbtn'+item._key+'" class="jumpbtn">&nbsp;&nbsp;立即前往&nbsp;&nbsp;</span>';
    highlights += "</div>";

    var profitTags = "";
    if(util.hasBrokerInfo()){//如果是推广达人则显示佣金
        showHighProfitLink();//显示高佣链接入口
        if(item.profit&&item.profit.type=="3-party"){//如果已经存在则直接加载
          if(item.profit&&item.profit.order){
              profitTags += "<span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(item.profit.order*10)/10).toFixed(1)))+"</span>";
              if(item.profit&&item.profit.team&&item.profit.team>0.1)profitTags += "<span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(item.profit.team*10)/10).toFixed(1)))+"</span>";
          }else if(item.profit&&item.profit.credit&&item.profit.credit>0){
              profitTags += "<span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(item.profit.credit*10)/10).toFixed(0)))+"</span>";
          }
        }else if(item.profit && item.profit.type=="2-party"){//如果是2方分润则请求计算
            profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide'></div>";
            getItemProfit2Party(item);
        }else{//表示尚未计算。需要请求计算得到该item的profit信息
            profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide'></div>";
            getItemProfit(item);
        }
    }
    if(profitTags.trim().length>0){
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-show'>"+profitTags+"</div>";
    }else{
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide'></div>";
    }     
    
    //获取匹配度标签
    var matchTags = helper.tagging(currentPersonModel,item);
    var matchTagHtml = "";
    //装载item.tagging2.satisify
    if(item.tagging2 && item.tagging2.satisify && item.tagging2.satisify.trim().length>0){
      item.tagging2.satisify.split(" ").forEach(matchTag => { 
        console.log("show match tagging.",matchTag);
        matchTagHtml += "<a class='itemTag tag-gold' href='index.html?keyword="+matchTag.trim()+"'>"+matchTag.trim()+"</a>";
      });      
    }
    //装载vals及cost匹配标签
    matchTags.forEach(matchTag => { 
      console.log("show match tag.",matchTag);
      matchTagHtml += "<a class='itemTag tag-"+matchTag.class+"' href='index.html?keyword="+matchTag.label+"'>"+matchTag.label+"</a>";
    });
    /**
    if(matchTagHtml.length>0){
      matchTagHtml  = "<div class='itemTags'>"+matchTagHtml;
      matchTagHtml += "</div>";
    }
    //**/

    var tags = "<div class='itemTags'>";
    if(matchTagHtml.length>0){
      tags += matchTagHtml;
    }    
    var taggingList = [];
    if(item.tagging&&item.tagging.length>0){
        taggingList = item.tagging.split(" ");
    }
    for(var t in taggingList){
        var txt = taggingList[t];
        if(txt.trim().length>1 && txt.trim().length<6){
            tags += tagTmpl.replace("__TAGGING",txt).replace("__TAG",txt);
        }
    }
    if(item.categoryId && item.categoryId.trim().length>1){
        tags += tagTmpl.replace("__TAGGING",item.category).replace("__TAG",item.category);
    }
    tags += "</div>";
    //var tags = "<span class='title'><a href='info.html?category="+category+"&id="+item._key+"'>"+item.title+"</a></span>"
    var title = "<div class='title'>"+item.title+"</div>"

    var boartBtns = "";
    if(boardId){//如果有board信息则显示添加到清单按钮
        boartBtns = "<div class='itemTags'>";
        boartBtns += "<a  id='btn-add-"+item._key+"-to-board' data-board='"+boardId+"' data-item='"+item._key+"' class='boardOption'>加入清单</a>&nbsp;";
        boartBtns += "<a class='boardOption' href='broker/boards-modify.html?id="+boardId+"'>编辑清单</a>";
        boartBtns += "</div>";
    }

    //添加评价指标
    var measures = "<div id='measure-"+item._key+"' style='display:none'></>";

    $("#waterfall").append("<li><div data='"+item._key+"'>" + image+profitTags +highlights +title+ tags+boartBtns+measures+ "</div></li>");
    num++;

    //如果是达人，则加载显示佣金信息

    //注册事件
    $("div[data='"+item._key+"']").click(function(){
        //跳转到详情页
        window.location.href = "info2.html?category="+category+"&id="+item._key;
    });
    $("#jumpbtn"+item._key).click(function(e){
        //需要禁止外部事件
        var e = window.event || e;
        if (e.stopPropagation) e.stopPropagation();
        else e.cancelBubble = true;      
        //直接跳转到第三方页面
        window.location.href = "go.html?id="+item._key+"&fromBroker="+broker.id+"&fromUser="+app.globalData.userInfo._key+"&from=index";
    });    

    //如果有board则注册增加商品事件
    $("#btn-add-"+item._key+"-to-board").click(function(event){
        //添加item到board并浮框提示
        var itemKey = $(this).data("item");
        addItemToBoard(item);

        event.stopPropagation(); //禁止冒泡
    });

    //装载评价数据：查询后动态添加
    if(item.meta&&item.meta.category){
      loadMeasureSchemes(item);
    }
    
    // 表示加载结束
    loading = false;
}

//添加item到board
function addItemToBoard(item){
    console.log("Index::addItemToBoard try to add item to board.", item)
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    //准备 条目的默认描述：优先采用推荐语、其次tagging、再次tags
    var advice = "";
    if(item.tagging&&item.tagging.trim().length>0){//否则采用tagging
        advice = item.tagging;
    }else if(item.advice && Object.keys(item.advice).length>0 ){//如果有advice，则随机采用
        var count = Object.keys(item.advice).length;
        var random = 0;//默认采用第一条
        if(count>1){//如果是多个则随机采用
            random = new Date().getTime()%count;
        }
        advice = item.advice[Object.keys(item.advice)[random]];
        //对于达人推荐语，需要去掉头部标记
        var brokerAdvice = advice.split(":::");
        advice = brokerAdvice[brokerAdvice.length-1];//仅获取最后一段
    }else if(item.summary&&item.summary.trim().length>0){//优先采用入库时的标注
        advice = item.summary;
    }else if(item.tags&&item.tags.length>0){//最后采用tags
        advice = item.tags.join(" ");
    }else{
        //留空，采用默认值
    }     
    //装配数据
    var data = {
        item:item._key,
        title:item.title,
        description:advice,
        board:{
            id:boardId
        }
    };
    util.AJAX(app.config.sx_api+"/mod/boardItem/rest/board-item/", function (res) {
        console.log("Index::addItemToBoard item added successfully.", res)
        if(res.status){
            console.log("Index::addItemToBoard item added successfully", res)
            $.toast({//浮框提示已添加成功
                heading: '已添加到清单',
                text: '可以继续添加商品或编辑清单',
                showHideTransition: 'fade',
                icon: 'success'
            });            
        }
    }, "POST",data,header);
}

//查询佣金。2方分润。返回order/team/credit三个值
function getItemProfit2Party(item) {
    var data={
        source:item.source,
        price:item.price.sale,
        amount:item.profit.amount?item.profit.amount:0,
        category:item.categoryId?item.categoryId:""
    };
    util.AJAX(app.config.sx_api+"/mod/commissionScheme/rest/profit-2-party", function (res) {
        //console.log("\ngot profit info.",data,res);
        var showProfit = false;
        var html = "";
        if (res.order) {//店返
            html += "<span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(res.order*10)/10).toFixed(1)))+"</span>";
            if(res.team && res.team>0.1){//过小的团返不显示
                html += "<span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(res.team*10)/10).toFixed(1)))+"</span>";
            }
        }else if(res.credit&&res.credit>0){//如果没有现金则显示积分
            html += "<span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(res.credit*10)/10).toFixed(0)))+"</span>";
        }else{//这里应该是出了问题，既没有现金也没有积分
            console.log("===error===\nnothing to show.",item,res);
        }
        //显示到界面
        if(html.trim().length>0){
            $("#profit"+item._key).html(html);
            $("#profit"+item._key).toggleClass("profit-hide",false);
            $("#profit"+item._key).toggleClass("profit-show",true);
        }
        //更新到item
        if(item.profit==null){
          item.profit={};
        }        
        item.profit.order = res.order;
        item.profit.team = res.team;
        item.profit.credit = res.credit;
        item.profit.type = "3-party";   
        //updateItem(item);      //注意：需要进入索引，而不是直接修改原始数据
    },"GET",data);
}

//查询特定条目的佣金信息。返回order/team/credit三个值
function getItemProfit(item) {
    var data={
        source:item.source,
        price:item.price.sale,
        category:item.categoryId?item.categoryId:""
    };
    console.log("try to query item profit",data);
    util.AJAX(app.config.sx_api+"/mod/commissionScheme/rest/profit", function (res) {
        //console.log("got profit info.",item,res);
        var showProfit = false;
        var html = "";
        if (res.order) {//店返
            html += "<span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(res.order*10)/10).toFixed(1)))+"</span>";
            if(res.team && res.team>0.1){//过小的团返不显示
                html += "<span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(res.team*10)/10).toFixed(1)))+"</span>";
            }
        }else if(res.credit&&res.credit>0){//如果没有现金则显示积分
            html += "<span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(res.credit*10)/10).toFixed(0)))+"</span>";
        }else{//这里应该是出了问题，既没有现金也没有积分
            console.log("===error===\nnothing to show.",item,res);
        }
        //显示到界面
        if(html.trim().length>0){
            $("#profit"+item._key).html(html);
            $("#profit"+item._key).toggleClass("profit-hide",false);
            $("#profit"+item._key).toggleClass("profit-show",true);
        }
        //更新到item
        if(item.profit==null){
          item.profit={};
        }        
        item.profit.order = res.order;
        item.profit.team = res.team;
        item.profit.credit = res.credit;
        item.profit.type = "3-party";   
        //updateItem(item);   //注意：需要进入索引，而不是直接修改原始数据
    },"GET",data);
}

//更新item信息。只用于更新profit
function updateItem(item) {
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };
    var url = app.config.data_api +"/_api/document/my_stuff/"+item._key;
    if (app.globalData.isDebug) console.log("Index::updateItem update item.",item);
    util.AJAX(url, function (res) {
      if (app.globalData.isDebug) console.log("Index::updateItem update item finished.", res);
      //do nothing
    }, "PATCH", item, header);
}

//显示没有更多内容
function shownomore(flag){
  //检查是否是一条数据都没加载
  if(items.length==0){//需要特别处理：如果没有任何数据，则需要默认设置，否则导致无法显示show more btn
    $("#waterfall").height(10);
    $("#no-results-tip").toggleClass("no-result-tip-hide",false);
    $("#no-results-tip").toggleClass("no-result-tip-show",true);
  }  
  if(flag){
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",false);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",true);
    //注册跳转事件：在某些情况下，搜索不到，直接回到首页，不带参数搜索
    $("#findMoreBtn").click(function(){
      window.location.href = "index.html";
    });    
  }else{
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",true);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",false);
  }
}

//如果是达人则显示高佣入口
function showHighProfitLink(){
    $("#findByProfit").toggleClass("searchBtn-hide",false);
    $("#findByProfit").toggleClass("searchBtn",true);
}

// 自动加载更多：此处用于测试，动态调整图片高度
function random(min, max)
{
    return min + Math.floor(Math.random() * (max - min + 1))
}

function loadCategories(currentCategory){
    $.ajax({
        url:app.config.sx_api+"/mod/channel/rest/channels/active",
        type:"get",
        success:function(msg){
            var navObj = $(".navUl");
            for(var i = 0 ; i < msg.length ; i++){
                navObj.append("<li data='"+msg[i].id+"' data-tagging='"+(msg[i].tagging?msg[i].tagging:"")+"'>"+msg[i].name+"</li>");
                if(currentCategory == msg[i].id){//高亮显示当前选中的category
                    $(navObj.find("li")[i]).addClass("showNav");
                    tagging = msg[i].tagging;
                    helper.traceChannel(currentCategory,'click',currentPersonJson);//记录频道点击事件：对于通过详情页、board页进入的同时记录
                }
            }
            //注册点击事件
            navObj.find("li").click(function(){
                var key = $(this).attr("data");
                var tagging = $(this).attr("data-tagging");                
                if(key == category){//如果是当前选中的再次点击则取消高亮，选择“全部”
                    key = "all";
                    tagging = "";
                    changeCategory(key,tagging);//更换后更新内容
                    $(navObj.find("li")).removeClass("showNav");
                    $(".navUl>li:contains('全部')").addClass("showNav");
                }else{
                    changeCategory(key,tagging);//更换后更新内容
                    helper.traceChannel(key,'click',currentPersonJson);//记录频道点击事件
                    $(navObj.find("li")).removeClass("showNav");
                    $(this).addClass("showNav");//不好，这个是直接通过“全部”来完成的                    
                }
            })
        }
    })    
}

function changeCategory(key,q){
    category = key;//更改当前category
    categoryTagging = q;//使用当前category对应的查询更新查询字符串
    loadData();
}

function loadData(){
    items = [];//清空列表
    itemKeys = [];//同步清空itemKey列表
    $("#waterfall").empty();//清除页面元素
    num=1;//设置加载内容从第一条开始
    page.current = -1;//设置浏览页面为未开始
    console.log("query by tagging.[categoryTagging]"+categoryTagging+"[personTagging]"+currentPersonTagging+"[tagging]"+tagging+"[filter]"+filter);
    loadItems();//重新加载数据
}

function shared(url, type, gid){
    var rUrl = basePath + "/share/add?type=" + type + "&url=" + encodeURI(url);
    if(!!gid) {
        rUrl += "&gid=" + gid;
    }
    $.ajax({
        type: "GET",
        url: rUrl,
        dataType: "json",
        success: function(rs){
            //alert("分享成功");
        }
    });
}

function getLocation(){
    $.ajax({
        url:app.config.auth_api+"/wechat/jssdk/ticket",
        type:"get",
        data:{url:window.location.href},//重要：获取jssdk ticket的URL必须和浏览器浏览地址保持一致！！
        success:function(json){
            console.log("===got jssdk ticket===\n",json);
            wx.config({
                debug:false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
                appId: json.appId, // 必填，公众号的唯一标识
                timestamp:json.timestamp , // 必填，生成签名的时间戳
                nonceStr: json.nonceStr, // 必填，生成签名的随机串
                signature: json.signature,// 必填，签名
                jsApiList: [
                  'getLocation',
                  'updateTimelineShareData',
                  'onMenuShareAppMessage',
                  'onMenuShareTimeline',
                  "onMenuShareTimeline",
                  'onMenuShareAppMessage'                   
                ] // 必填，需要使用的JS接口列表
            });
            wx.ready(function() {
                // config信息验证后会执行ready方法，所有接口调用都必须在config接口获得结果之后，config是一个客户端的异步操作，所以如果需要在页面加载时就调用相关接口，
                // 则须把相关接口放在ready函数中调用来确保正确执行。对于用户触发时才调用的接口，则可以直接调用，不需要放在ready函数中。
                //获取当前用户地理位置
                wx.getLocation({
                  type: 'gcj02', // 默认为wgs84的gps坐标，如果要返回直接给openLocation用的火星坐标，可传入'gcj02'. gcj02可以用高德进行验证
                  success: function (res) {
                    console.log("\n-----got current location-----\n",res);
                    var latitude = res.latitude; // 纬度，浮点数，范围为90 ~ -90
                    var longitude = res.longitude; // 经度，浮点数，范围为180 ~ -180。
                    var speed = res.speed; // 速度，以米/每秒计
                    var accuracy = res.accuracy; // 位置精度
                    //通过百度转换为统一坐标系
                    //convertToBaiduLocation(longitude,latitude,callback);//这个有跨域问题，不能直接通过ajax请求访问
                    var baiduApi = "https://api.map.baidu.com/geoconv/v1/?coords="+longitude+","+latitude
                                    +"&from=3&to=5&ak=XwNTgTOf5mYaZYhQ0OiIb6GmOHsSZWul&callback=getCorsCoordinate";
                    jQuery.getScript(baiduApi);//注意：不能通过ajax请求，而只能通过脚本加载绕过跨域问题
                  }
                });
                //end
            });
        }
    })    
}


function getCorsCoordinate(data){
    console.log("\n\ngot converted location.",data);
    if(data.status==0&&data.result.length>0){//表示成功:更新到用户地址
        var location = {
            longitude:data.result[0].x,
            latitude:data.result[0].y
        };
        app.globalData.userInfo.location = location;
        //设置本地UserInfo：存储到cookie
        $.cookie('sxUserInfo', JSON.stringify(app.globalData.userInfo), { expires: 3650, path: '/' });
        //推送到用户
        util.AJAX(app.config.data_api +"/user/users/"+app.globalData.userInfo.openId, function (res) {
            if (app.globalData.isDebug) console.log("Index::convertToBaiduLocation update person location finished.", res);
            //重新加载数据
            loadData();
            //直接开始搜索
            //window.location.href="index.html?filter=byDistance&keyword="+tagging+"&personTagging="+currentPersonTagging+"&categoryTagging="+categoryTagging+"&category="+category+"&id="+currentPerson;
        }, "PATCH", app.globalData.userInfo, { "Api-Key": "foobar" });
    }else{
        console.log("\n\nfailed convert location.",data);
    }
}

/**************加载关心的人及客群列表********************/
var persons = [];
var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:'0';
var currentPersonTagging = "";//记录当前用户的标签清单，用于根据标签显示内容
var personKeys = [];//标记已经加载的用户key，用于排重
var inputPerson = null;//接收指定的personId或personaId
//load predefined personas
function loadPersonas() {
    util.AJAX(app.config.data_api+"/persona/personas/broker/"+app.globalData.userInfo._key, function (res) {
      var arr = res;
      //将persona作为特殊的person显示到顶部
      for (var i = 0; i < arr.length; i++) {
        var u = arr[i];
        if(personKeys.indexOf(u._key) < 0){
          u.nickName = u.name;//将persona转换为person
          u.avatarUrl = u.image;//将persona转换为person
          u.personOrPersona = "persona";//设置标记，用于区分persona及person
          u.relationship = "客群";
          persons.push(u);
          personKeys.push(u._key);
        }
      }

      //新增客群按钮
      var addPersonaKey = "btn-add-persona";
      personKeys.push(addPersonaKey);
      persons.push({
        nickName:"添加客群",
        avatarUrl:"images/add-persona.png",
        relationship:"壮大团队赚钱",
        _key:addPersonaKey
      });       

      //显示滑动条
      showSwiper(); 
    });
}

//load related persons
function loadPersons() {
    util.AJAX(app.config.data_api+"/user/users/connections/"+app.globalData.userInfo._key, function (res) {
      var arr = res;
      //从列表内过滤掉当前用户：当前用户永远排在第一个
      if (app.globalData.userInfo != null && personKeys.indexOf(app.globalData.userInfo._key) < 0){
          //添加当前用户自己   
          var myself = app.globalData.userInfo;
          myself.relationship = "自己";
          persons.push(myself);
          personKeys.push(myself._key);        
          //加载broker信息，如果是机构达人，则将机构作为第一个关心的人。直接在当前用户上更改其关系、tag
          var sxBrokerInfo = $.cookie('sxBrokerInfo');
          console.log("load broker info from cookie.",sxBrokerInfo);
          if(sxBrokerInfo && sxBrokerInfo.trim().length>0){
            var orgnization = {
                nickName:app.globalData.userInfo.nickName,
                avatarUrl:app.globalData.userInfo.avatarUrl,
                relationship:"机构用户",
                _key:"orgnization"              
            };
            console.log("get sxBrokerInfo info from cookie.",sxBrokerInfo);
            var sxBroker = JSON.parse(sxBrokerInfo);
            if(sxBroker.orgnization && sxBroker.orgnization.name && sxBroker.orgnization.name.trim().length>0)
              orgnization.relationship = sxBroker.orgnization.name;
            if(sxBroker.orgnization && sxBroker.orgnization.id && sxBroker.orgnization.id.trim().length>0){
              orgnization.tags = [];
              orgnization.tags.push(sxBroker.orgnization.id);
              console.log("orgnization info.",orgnization);
              persons.push(orgnization);
              personKeys.push(orgnization._key);               
            }           
          }
          //end of orgnization      
      }
      for (var i = 0; i < arr.length; i++) {
        var u = arr[i];
        if(personKeys.indexOf(u._key) < 0/* && u.openId*/){//对于未注册用户不显示
          persons.push(u);
          personKeys.push(u._key);
        }
      } 

      //新增关心的人按钮
      var addPersonKey = "btn-add-related-person";
      personKeys.push(addPersonKey);
      persons.push({
        nickName:"添加关心的人",
        avatarUrl:"images/add-person.png",
        relationship:"分享赚钱",
        _key:addPersonKey
      });      

      //显示顶部滑动条
      if(util.hasBrokerInfo()){//如果是达人，则继续装载画像
          loadPersonas();
      }else{//否则直接显示顶部滑动条
          showSwiper();
      } 
    });
}

function showSwiper(){
    //将用户装载到页面
    for (var i = 0; i < persons.length; i++) {
      insertPerson(persons[i]);
    }    
    //显示滑动条
    var mySwiper = new Swiper ('.swiper-container', {
        //slidesPerView: 4,
        slidesPerView: from=="web"?parseInt(document.getElementsByTagName('html')[0].clientWidth/100):4,
    });  
    //调整swiper 风格，使之悬浮显示
    $(".swiper-container").css("position","relative");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","40");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","red");
    //$(".swiper-container").css("margin-bottom","3px");
  
    //将当前用户设为高亮  
    if(inputPerson){
      if(personKeys.indexOf(inputPerson)>-1 && persons[personKeys.indexOf(inputPerson)]){//有输入用户信息则优先使用
        currentPerson = inputPerson;
        currentPersonTagging = persons[personKeys.indexOf(inputPerson)].tags?persons[personKeys.indexOf(inputPerson)].tags.join(" "):"";
      }else{//指定了输入用户，但用户不存在，则不使用任何用户过滤
        currentPerson = "0";
        currentPersonTagging = "";
      }
    }else{//根据当前用户加载数据：默认使用第一个
      currentPerson = persons[0]._key;
      currentPersonTagging = persons[0].tags?persons[0].tags.join(" "):"";   
    }   
    //当前不需要切换，默认显示全部
    //changePerson(currentPerson,currentPersonTagging);   
    highlightPerson(currentPerson,currentPersonTagging);      
}

function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div class="person" id="'+person._key+'" data-tagging="'+(person.tags?person.tags.join(" "):"")+'">';
    var style= person._key==currentPerson?'-selected':'';
    html += '<div class="person-img-wrapper"><img class="person-img'+style+'" src="'+person.avatarUrl+'"/></div>';
    html += '<div class="person-info">';
    html += '<span class="person-name">'+(person.openId?"":"☆")+person.nickName+'</span>';
    html += '<span class="person-relation">'+(person.relationship?person.relationship:"我关心的TA")+'</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    $("#persons").append(html);

    //注册事件:点击后切换用户
    //通过jquery事件注入
    if(person._key=="btn-add-related-person"){//新增关心的人，直接跳转
      $("#"+person._key).click(function(e){
          window.location.href="user-choosepersona.html?from=feeds";
      });
    }else if(person._key=="btn-add-persona"){//新增客群，直接跳转
      $("#"+person._key).click(function(e){
          window.location.href="broker/my-addpersona.html?from=feeds";
      });
    }else{//切换数据列表
      $("#"+person._key).click(function(e){
          console.log("try to change person by jQuery click event.",person._key,e.currentTarget.id,e);
          if(e.currentTarget.id == currentPerson){//如果再次点击当前选中用户，则取消选中
            changePerson("0","");
          }else{//否则，高亮显示选中的用户
            changePerson(e.currentTarget.id,e.currentTarget.dataset.tagging);
          }
          
      });
    }
}

function changePerson (personId,personTagging) {
    var ids = personId;
    if (app.globalData.isDebug) console.log("Feed::ChangePerson change person.",currentPerson,personId);
    $("#"+currentPerson).removeClass("person-selected");
    $("#"+currentPerson).addClass("person");
    $("#"+ids).removeClass("person");
    $("#"+ids).addClass("person-selected");   

    $("#"+currentPerson+" img").removeClass("person-img-selected");
    $("#"+currentPerson+" img").addClass("person-img");
    $("#"+ids+" img").removeClass("person-img");
    $("#"+ids+" img").addClass("person-img-selected");

    $("#"+currentPerson+" span").removeClass("person-name-selected");
    $("#"+currentPerson+" span").addClass("person-name");
    $("#"+ids+" span").removeClass("person-name");
    $("#"+ids+" span").addClass("person-name-selected");

    $("#waterfall").empty();//清空原有列表
    $("#waterfall").css("height","20px");//调整瀑布流高度
    //showloading(true);//显示加载状态

    //重新加载用户明细及模型
    loadPersonById(personId);//注意是同步调用

    page.current = -1;//从第一页开始查看
    currentPerson = ids;//修改当前用户
    currentPersonTagging = personTagging;//修改当前用户推荐Tagging
    items = [];//清空列表
    num = 1;//从第一条开始加载
    loadData();//重新加载数据
  } 

//从user_user重新加载用户，并构建用户评估明细及模型
function loadPersonById(personId){
  if(!personId || personId.trim().length<6 || personId == "orgnization")
    return;//these are dummy users. do not change
  $.ajax({
      url:app.config.data_api+"/user/users/"+personId,
      type:"get",
      async:false,//同步调用        
      success:function(json){
          console.log("===load latest user===\n",json);
          app.globalData.userInfo = json; //更新本地UserInfo
          $.cookie('sxUserInfo', JSON.stringify(json), { expires: 3650, path: '/' });//更新到cookie
          currentPersonJson = json;
          if(json.tags && json.tags.length>0){
            currentPersonTagging = json.tags.join(" ");
          }
          currentPersonModel = helper.getPersonModel(json._key,json.persona&&json.persona._key?json.persona._key:'0');//构建用户模型
          //检查是否已设置persona，如果未设置则提示选择
          if(json.persona && json.persona._key){
            //do nothing
            $("#no-persona-tip").removeClass("no-persona-tip-show");
            $("#no-persona-tip").addClass("no-persona-tip-hide");            
          }else{
            $("#no-persona-tip").removeClass("no-persona-tip-hide");
            $("#no-persona-tip").addClass("no-persona-tip-show");
            $("#no-persona-tip").click(function(){//点击显示persona列表，并提示选择。注意需要带入当前选择的personId
              window.location.href = "user-choosepersona.html?refer=index&id="+personId;
            });
          }
      }
  });  
}

//仅高亮person，不重新加载数据
function highlightPerson (personId,personTagging) {
    var ids = personId;
    if (app.globalData.isDebug) console.log("Index::highlightPerson highlight person.",currentPerson,personId);
    $("#"+currentPerson).removeClass("person-selected");
    $("#"+currentPerson).addClass("person");
    $("#"+ids).removeClass("person");
    $("#"+ids).addClass("person-selected");   

    $("#"+currentPerson+" img").removeClass("person-img-selected");
    $("#"+currentPerson+" img").addClass("person-img");
    $("#"+ids+" img").removeClass("person-img");
    $("#"+ids+" img").addClass("person-img-selected");

    $("#"+currentPerson+" span").removeClass("person-name-selected");
    $("#"+currentPerson+" span").addClass("person-name");
    $("#"+ids+" span").removeClass("person-name");
    $("#"+ids+" span").addClass("person-name-selected");
  }   


function loadFilters(currentFilter){
    var filterTypes = ["Profit","Price","Rank","Distance"];//filter类型
    for(var i = 0 ; i < filterTypes.length ; i++){//已经在界面显示，此处仅注册点击事件
        if(currentFilter == filterTypes[i]){//高亮显示当前选中的filter
            filter = currentFilter;
            $("#findBy"+filterTypes[i]).addClass("searchBtn-highlight");
        }
        //注册点击事件
        $("#findBy"+filterTypes[i]).click(function(){
            var key = "by"+$(this).attr("data"); 
            console.log("filter changed.[current]"+filter+"[new]"+key);
            $("a[id^='findBy']").each(function(){//删除所有高亮
                $(this).removeClass("searchBtn-highlight");
            });                         
            if(key == filter){//如果是当前选中的再次点击则取消高亮，选择“全部”
                changeFilter("");//取消当前选中
            }else{
                changeFilter(key);//更换后更新内容
                $(this).addClass("searchBtn-highlight");                 
            }
        })
    }
}

function changeFilter(currentFilter){
    filter = currentFilter;//使用当前选中的filter
    if(filter == "byDistance"){//获取地址然后重新加载数据
      getLocation();//点击后请求授权，并且在授权后每次点击时获取当前位置，并开始搜索
    }else{
      loadData();
    }
}

function showShareContent(){
    console.log("start display board card.[boardId]"+boardId);
    //默认隐藏，仅对达人开放显示
    if(util.hasBrokerInfo()){
        //显示浮框  
        $("#share-box").toggleClass("share-box",true);
        $("#share-box").toggleClass("share-box-hide",false);   
        if(boardId && boardId.trim().length > 0){//如果已经有在编辑清单，则直接显示发布按钮
          //分享链接：默认用图片列表形式
          $("#share-instruction").html("选取商品并<br/>添加到清单");
          $("#share-link").html("编辑&分享");
          $("#share-link").attr("href","board2-waterfall.html?id="+boardId);
          //设置提示
          //$("#share-bonus").html("推广提示");       
        }else{//否则显示创建按钮
          //分享链接：默认用图片列表形式
          $("#share-instruction").html("清单能够将多个商品<br/>一起打包推送");
          $("#share-link").html("创建清单");
          $("#share-link").click(function(event){//注册点击事件
              if(broker.id){
                createBoard();//直接建立一个清单
              }else{
                console.log("fatal error. there is no broker info. please check.......");
              }
              
          });
          //设置提示
          //$("#share-bonus").html("推广提示");     
        }
    }else{
        $("#share-bonus").toggleClass("share-bonus",false);
        $("#share-bonus").toggleClass("share-bonus-hide",true);
    }
    /*
    if(strBonus.length > 0){//显示佣金
        $("#share-bonus").html("返￥"+strBonus);
        $("#share-bonus").toggleClass("share-bonus",true);
        $("#share-bonus").toggleClass("share-bonus-hide",false);  
    }else{
       $("#share-bonus").toggleClass("share-bonus",false);
       $("#share-bonus").toggleClass("share-bonus-hide",true);        
    }
    //**/
}

//创建一个空白board并等待添加内容
function createBoard(){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    var boardkeywords = "";
    if(tagging && tagging.trim().length>0){//优先根据输入设置关键字
      boardkeywords = tagging;
    }else if(categoryTagging && categoryTagging.trim().length>0){//其次是分类标注
      boardkeywords = categoryTagging;
    }else if(currentPersonTagging && currentPersonTagging.trim().length>0){//再次是用户标注
      boardkeywords = currentPersonTagging;
    }
    var data = {
        broker:{
            id:broker.id
        },
        logo:"",
        title:app.globalData.userInfo && app.globalData.userInfo.nickName ?app.globalData.userInfo.nickName+" 的推荐清单":"新的推荐清单",
        //title:broker&&broker.name?broker.name+" 的推荐清单":"新的推荐清单",
        description:"根据你的需求，我们精心挑选了以下清单，请查收",
        tags:boardkeywords,
        poster:JSON.stringify({}),
        article:JSON.stringify({}),
        keywords:boardkeywords
    };
    util.AJAX(app.config.sx_api+"/mod/board/rest/board", function (res) {
        console.log("Broker::Board::AddBoard create board successfully.", res)
        if(res.status){
            console.log("Broker::Board::AddBoard now jump to home page for item adding.", res)
            var expDate = new Date();
            expDate.setTime(expDate.getTime() + (15 * 60 * 1000)); // 15分钟后自动失效：避免用户不主动修改
            $.cookie('board', JSON.stringify(res.data), { expires: expDate, path: '/' });  //把编辑中的board写入cookie便于添加item
            //修改当前board信息
            getBoard();
            loadData();//重新加载数据：以便于显示“添加清单”按钮
            showShareContent();//刷新分享按钮，提示分享
            //显示提示浮框
            $.toast({//浮框提示已添加成功
                heading: '清单已创建',
                text: '请选择商品添加到清单内',
                showHideTransition: 'fade',
                icon: 'success'
            });            
        }
    }, "POST",data,header);
}

//显示正在加载提示
function showloading(flag){
  if(flag){
    $("#loading").toggleClass("loading-hide",false);
    $("#loading").toggleClass("loading-show",true);
  }else{
    $("#loading").toggleClass("loading-hide",true);
    $("#loading").toggleClass("loading-show",false);    
  }
}

//加载客观评价指标
function loadMeasureSchemes(stuff){
    //获取类目下的特征维度列表
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimension/rest/featured-dimension",
        type:"get",
        //async:false,//同步调用
        data:{categoryId:stuff.meta.category},
        success:function(featuredDimension){
            console.log("===got featured dimension===\n",featuredDimension);
            loadMeasureScores(stuff,featuredDimension);
        }
    });  
}
//加载指定item的评分
function loadMeasureScores(stuff,featuredDimension){
    var itemScore = {};
    //根据itemKey获取评价结果
    //feature = 1；dimensionType：0客观评价，1主观评价
    //注意：由于clickhouse非严格唯一，需要取最后更新值
    $.ajax({
        url:app.config.analyze_api+"?query=select dimensionId,score from ilife.info where feature=1 and dimensionType=0 and itemKey='"+stuff._key+"' order by ts format JSON",
        type:"get",
        //async:false,//同步调用
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(json){
            console.log("===got item score===\n",json);
            for(var i=0;i<json.rows;i++){
                itemScore[json.data[i].dimensionId] = json.data[i].score;
            }
            console.log("===assemble item score===\n",itemScore);
            showMeasureScores(stuff,featuredDimension,itemScore);
        }
    });   
}
//显示客观评价得分
function showMeasureScores(stuff,featuredDimension,itemScore){
    var colors = ['#8b0000', '#dc143c', '#ff4500', '#ff6347', '#1e90ff','#00ffff','#40e0d0','#9acd32','#32cd32','#228b22'];
    //准备评分表格：根据评价维度逐行显示
    featuredDimension.forEach(function(dimension){
      var html  = '<div id="mscore-'+stuff._key+dimension.id+'" data-init="true"></div>';//以itemKey+dimensionId为唯一识别
      var score = itemScore[dimension.id]?itemScore[dimension.id]*10:7.5;
      var colorIndex = Math.round(score);//四舍五入取整
      if(colorIndex>9)colorIndex=9;
      $("#measure-"+stuff._key).append(html);
      $('#mscore-'+stuff._key+dimension.id).LineProgressbar({
                percentage: score,
                title:dimension.name,
                unit:'/10',
                fillBackgroundColor:colors[colorIndex],
                //animation:false
            });    
    });   
    $("#measure-"+stuff._key).css("display","block");
}

