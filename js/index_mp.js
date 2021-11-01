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
    var args = getQuery();//获取参数
    if(args["id"])inputPerson=args["id"];//从请求中获取需要展示的person或personaId
    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });  

    //监听父窗口postmessage
    listenPostMessage();
    //检查toolbar状态
    checkToolbarStatus();

    category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录
    tagging = args["keyword"]?args["keyword"]:""; //通过搜索跳转
    filter = args["filter"]?args["filter"]:""; //根据指定类型进行过滤
    from = args["from"]?args["from"]:"mp";//来源于选品工具，包括公众号流量主、知乎、头条、简书等
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID

    console.log("got params from & fromUser from query.",from,fromUser);

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

    //检查用户绑定情况。包含扫码后的用户信息获取
    //console.log("start check sxAuth.....");
    //checkUserBinding();

    //设置默认用户：由于需要微信扫码绑定，如果不绑定，默认设置为系统用户
    //setDefaultUser();
    loadUserInfoByOpenid(fromUser);

    //加载达人信息：在用户加载完成后自动加载
    //loadBrokerInfoByOpenid(fromUser);  

    //加载关心的人：在用户加载完成后自动加载
    //loadPersons();

    //加载filter并高亮
    loadFilters(filter);
    //高亮显示当前选中的filter
    //highlightFilter();
    //注册copy监听事件：注意需要在内部处理触发节点
    document.addEventListener('copy',copyItem);    
 
});

//记录分享用户、分享达人
var from = "mp";//链接来源，默认为公众号进入
var fromUser = "";

//记录当前拷贝的item
var pendingCopyCardType = "imageText";//默认为图文卡片
var pendingCopyFormat = "text/html";//默认为html
var pendingCopyItem = "";
var pendingItemCpsLink = "";//记录拷贝时item的CPS链接
//使用代理避免跨域问题。后端将代理到指定的URL地址。使用https
var imgPrefix = "https://www.biglistoflittlethings.com/3rdparty?url=";

util.getUserInfo();//从本地加载cookie

var broker = {
  id:"77276df7ae5c4058b3dfee29f43a3d3b"
};

//加载board信息
var boardId = null;

var columnWidth = 450;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有内容列表
var category  = 0; //当前目录ID
var tagging = ""; //当前目录关联的查询关键词，搜索时直接通过该字段而不是category进行
var filter = "";//通过filter区分好价、好物、附近等不同查询组合

var categoryTagging = "";//记录目录切换标签，tagging = categoryTagging + currentPersonTagging

//检查是否已经绑定公众号账户
function checkUserBinding(){
  //读取cookie，得到授权信息，如果是未授权则通知跳转到扫码界面
  var sxAuthInfo = $.cookie('sxAuth');
  console.log("load sxAuth from cookie.",sxAuthInfo);
  if(sxAuthInfo && sxAuthInfo.trim().length>0){
      console.log("get sxAuth info from cookie.",sxAuthInfo);
      var sxAuth = JSON.parse(sxAuthInfo);
      if(sxAuth.ready){//已经绑定，啥也不干
        //do nothing
      }else if(sxAuth.code && sxAuth.state){//未绑定，但已经有了state和code，是刚刚扫码了，直接尝试获取用户信息
        //通知跳转到login界面
        var msg = {
          sxNavigateTo:"https://www.biglistoflittlethings.com/ilife-web-wx/login.html?code="+sxAuth.code+"&state="+sxAuth.state
        };
        console.log("post message.sxAuth cookie.",sxAuth,msg);
        window.parent.postMessage(msg, "*");//不设定origin，直接通过属性区分        
      }else{//这个就不知道啥情况了，直接显示二维码重新扫。如果是扫码过期也会进入这里
        var msg = {
          sxNavigateTo:"https://www.biglistoflittlethings.com/ilife-web-wx/login-qrcode.html"
        };
        console.log("post message.sxAuth cookie error.",sxAuth,msg);
        window.parent.postMessage(msg, "*");//不设定origin，直接通过属性区分
      }
  }else{//通知显示扫码界面
        var msg = {
          sxNavigateTo:"https://www.biglistoflittlethings.com/ilife-web-wx/login-qrcode.html"
        };
        console.log("post message. no sxAuth cookie.",msg);
        window.parent.postMessage(msg, "*");//不设定origin，直接通过属性区分
  }  
}

//直接读取用户信息
function loadUserInfoByOpenid(openid){
  util.checkPerson({openId:openid},function(res){
    app.globalData.userInfo = res;//直接从请求获取信息
    loadBrokerInfoByOpenid(openid);//用户加载后再加载达人信息
    loadPersons();//用户加载后加载关联用户及客群
    //更新broker头像及名称
    //注意有同源问题，通过postMessage完成
    var brokerMessage = {
      sxBrokerLogo:app.globalData.userInfo.avatarUrl,
      sxBrokerName:app.globalData.userInfo.nickName
    };
    window.parent.postMessage(brokerMessage, "*");//不设定origin，直接通过属性区分
    console.log("post broker message.",brokerMessage);
  });
}

//直接读取达人信息
function loadBrokerInfoByOpenid(openid){
  util.checkBroker(openid,function(res){
    //broker = util.getBrokerInfo();
    broker = res.data;//直接从请求获取信息

    //直接写入cookie，避免同源问题
    document.cookie = "sxBrokerInfo="+JSON.stringify(res.data)+"; SameSite=None; Secure";
    document.cookie = "hasBrokerInfo="+res.status+"; SameSite=None; Secure";

    //TODO：在加载达人后再加载数据，避免brokerInfo缺失
    startQueryDataLoop();

    //更新broker头像及名称
    //注意有同源问题，通过postMessage完成
    var brokerMessage = {
      sxBrokerRealName:broker.name
    };
    window.parent.postMessage(brokerMessage, "*");//不设定origin，直接通过属性区分
    console.log("post broker message.",brokerMessage);

    //如果是从web进入则显示达人面板
    if(from=="web"){
      showCurrentBrokerInfo();
    }
  });
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


function loadItems(){//获取内容列表
    //构建esQuery
    esQuery = buildEsQuery();//完成query构建。其中默认设置了每页条数
    //处理翻页insert
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
                for(var i = 0 ; i < hits.length ; i++){
                    items.push(hits[i]._source);
                }
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

    var imgWidth = 80; //指定为固定宽度 //columnWidth-2*columnMargin;//注意：改尺寸需要根据宽度及留白计算，例如宽度为360，左右留白5，故宽度为350
    var imgHeight = random(50, 300);//随机指定初始值
    //计算图片高度
    var img = new Image();
    img.src = item.images?item.images[0]:"https://www.biglistoflittlethings.com/list/images/logo00.jpeg";
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算
    //console.log("orgwidth:"+orgWidth+"orgHeight:"+orgHeight+"width:"+imgWidth+"height:"+imgHeight);
    var image = "<img src='"+imgPrefix+item.images[0]+"' width='"+imgWidth+"' height='"+imgHeight+"' style='margin:0 auto'/>"
    var tagTmpl = "<strong style='white-space:nowrap;display:inline-block;border:1px solid #8BC34A;background-color: #8BC34A;color:white;font-weight: bold;font-size: 10px;text-align: center;border-radius: 5px;margin-left:2px;margin-right:1px;margin-top:-2px;padding:2px;vertical-align:middle;'>__TAG</strong>";
    var highlights = "<div class='itemTags' style='line-height: 18px;'>";
    var prices = "";
    prices += "<strong style='font-size:14px;font-weight: bold;background-color: white;color:darkred;padding:2px;'>"+(item.price.currency?item.price.currency:"¥")+item.price.sale+"</strong>";
    if(item.price.coupon>0&&item.price.coupon<item.price.sale){//有些券金额比售价还高，不显示
        prices += "<strong style='font-size:14px;font-weight: bold;color:#fe4800;margin-left:2px;'>券</strong><strong href='#' style='font-size:14px;font-weight: bold;color:#fe4800;'>"+item.price.coupon+"</strong>";
    }    
    //购买按钮
    var buyButton = "<strong style='float:right;margin-right:10px;background-color:darkred;color:white;text-align:right;padding-left:5px;padding-right:5px;font-size:14px;border-radius:3px;' id='view-"+item._key+"' data-item='"+item._key+"'>去看看</strong>";
    highlights += "</div>";

    //distributor
    var distributor = "<div><strong class='itemTag' href='#' style='font-size:13px;font-weight: bold;background-color: white;color:darkgreen;padding:2px;line-height: 18px;vertical-align:middle;border:0'>"+item.distributor.name+"</strong></div>";



    var profitTags = "";
    if(util.hasBrokerInfo()){//如果是推广达人则显示佣金
        showHighProfitLink();//显示高佣链接入口
        if(item.profit&&item.profit.type=="3-party"){//如果已经存在则直接加载
          if(item.profit&&item.profit.order){
              profitTags += "<div class='itemTags profit-show' style='margin:0;' id='profit-tip-"+item._key+"'><span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(item.profit.order*10)/10).toFixed(1)))+"</span></div>";
              if(item.profit&&item.profit.team&&item.profit.team>0.1)profitTags += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(item.profit.team*10)/10).toFixed(1)))+"</span></div>";
          }else if(item.profit&&item.profit.credit&&item.profit.credit>0){
              profitTags += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(item.profit.credit*10)/10).toFixed(0)))+"</span></div>";
          }
        }else if(item.profit && item.profit.type=="2-party"){//如果是2方分润则请求计算
            //profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide' style='margin-bottom:0;'></div>";
            getItemProfit2Party(item);
        }else{//表示尚未计算。需要请求计算得到该item的profit信息
            //profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide' style='margin-bottom:0;'></div>";
            getItemProfit(item);
        }
    }
    /**
    if(profitTags.trim().length>0){
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-show'>"+profitTags+"</div>";
    }else{
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide'></div>";
    }     
    //**/

    var tags = "<div class='itemTags' style='line-height: 12px;vertical-align: middle;margin-bottom:2px;'>";
    var taggingList = [];
    if(item.tagging&&item.tagging.length>0){
        item.tagging.split(" ");
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
    var title = "<div class='title' style='font-weight:bold;font-size:11px;line-height: 16px;'>"+item.title+"</div>"

    //增加拷贝按钮、查看详情按钮
    var copyBtns = "";
    //copyBtns = "<div  style='width:100%;margin:auto;display:flex;flex-direction: row;align-items: center;'>";
    //
    copyBtns += "<div style='margin:0;line-height:10px;margin-left:15px;'><a  id='copy-imageText"+item._key+"' data-item='"+item._key+"' class='boardOption'>图文</a></div>";
    copyBtns += "<div style='margin:0;line-height:10px;margin-left:5px;'><a  id='copy-banner"+item._key+"' data-item='"+item._key+"' class='boardOption'>横幅</a></div>";
    copyBtns += "<div style='margin:0;line-height:10px;margin-left:5px;'><a  id='copy-square"+item._key+"' data-item='"+item._key+"' class='boardOption'>方形</a></div>";
    copyBtns += "<div style='margin:0;line-height:10px;margin-left:5px;'><a  id='copy-textLink"+item._key+"' data-item='"+item._key+"' class='boardOption'>文字链接</a></div>";
    copyBtns += "<div style='margin:0;line-height:10px;margin-left:5px;'><a  id='copy-url"+item._key+"' data-item='"+item._key+"' class='boardOption'>仅链接</a></div>";
    //copyBtns += "</div>";

    var cardHtml = "";
    cardHtml += "<div class='cardWrapper' style='width:100%;margin:auto;display:flex;flex-direction: column;align-items: center;'>";
      //卡片内容
      cardHtml += "<div style='border:2px dashed silver;width:95%'>";//卡片边框
        ////////图文卡片样式////////////
          //*
          cardHtml += "<div id='imageText"+item._key+"' style='width:90%;margin:auto;display:flex;flex-direction: row;align-items: center;border-radius:5px;'>";
            //图片
            cardHtml += "<div style='width:30%;margin:auto;align-items: center;padding-right:5px;'>";
              cardHtml += image;
            cardHtml += "</div>";   
            //标题、价格、标签
            cardHtml += "<div style='width:70%;display:flex;flex-direction: column;align-items: left;'>";
              cardHtml += distributor;
              cardHtml += title;
              cardHtml += tags;
              cardHtml += "<div class='itemTags' style='line-height: 18px;'>";     
                cardHtml += prices;  
                cardHtml += buyButton;
              cardHtml += "</div>";
            cardHtml += "</div>"; 
          cardHtml += "</div>";
          //**/
        ////////结束：图文卡片样式////////////

        /////////////条幅卡片样式//////////////////////
          cardHtml += "<div id='banner"+item._key+"' style='width:90%;margin:auto;display:none;flex-direction: column;align-items: center;'>";
              //图片
              cardHtml += "<div style='width:100%;margin:auto;align-items: center;height:130px;background-position:center;background-size:cover;background-repeat:no-repeat;background-image:url("+imgPrefix+(item.logo?item.logo:item.images[0])+")'>";
                //cardHtml += "<img src='"+imgPrefix+(item.logo?item.logo:item.images[0])+"' width='100%' height='210' style='margin:0 auto;object-fit:cover;'/>" 
              cardHtml += "</div>";  
              //图片用背景，采用空白div填补高度
              //cardHtml += "<div style='width:100%;bottom:0;font-weight:bold;font-size:11px;line-height: 120px;'>&nbsp;</div>";
              //标题:浮动显示在图片底部
              cardHtml += "<div style='width:100%;bottom:0;font-weight:bold;font-size:11px;line-height: 18px;'>";
                cardHtml += item.title;           
              cardHtml += "</div>";                             
              //价格、标签
              cardHtml += "<div style='width:100%;display:flex;flex-direction: row;align-items: left;'>";
                //distributor、价格
                cardHtml += "<div class='itemTags' style='line-height: 18px;width:70%;float:left;'>";
                  //电商平台:distributor
                  cardHtml += "<strong href='#' style='font-size:14px;font-weight: bold;background-color: white;color:darkgreen;padding:2px;line-height: 18px;border:0'>"+item.distributor.name+"</strong>";  
                  //价格
                  cardHtml += prices;              
                cardHtml += "</div>";      
                //购买按钮
                cardHtml += "<div style='line-height: 18px;width:30%;text-align:right;float:right;z-index:99'>";
                cardHtml += "<strong style='float:right;margin-right:10px;background-color:darkred;color:#fff;text-align:right;padding-left:5px;padding-right:5px;font-size:14px;border-radius:3px;' id='view-"+item._key+"' data-item='"+item._key+"'>去看看</strong>";
                cardHtml += "</div>";                      
              cardHtml += "</div>"; 
            cardHtml += "</div>";
        /////////////结束：条幅卡片样式//////////////////////


        /////////////方形卡片样式///////////
         cardHtml += "<div id='square"+item._key+"' style='width:90%;margin:auto;display:none;flex-direction: column;align-items: center;'>";
              //图片
              cardHtml += "<div style='width:300px;margin:auto;align-items: center;height:300px;background-position:center;background-size:cover;background-repeat:no-repeat;background-image:url("+imgPrefix+(item.logo?item.logo:item.images[0])+")'>";
                //cardHtml += "<img src='"+imgPrefix+(item.logo?item.logo:item.images[0])+"' width='100%' height='210' style='margin:0 auto;object-fit:cover;'/>" 
              cardHtml += "</div>";  
              //图片用背景，采用空白div填补高度
              //cardHtml += "<div style='width:100%;bottom:0;font-weight:bold;font-size:11px;line-height: 120px;'>&nbsp;</div>";
              //标题:浮动显示在图片底部
              cardHtml += "<div style='width:300px;bottom:0;font-weight:bold;font-size:11px;line-height: 18px;'>";
                cardHtml += item.title;           
              cardHtml += "</div>";                             
              //价格、标签
              cardHtml += "<div style='width:300px;display:flex;flex-direction: row;align-items: left;'>";
                //distributor、价格
                cardHtml += "<div class='itemTags' style='line-height: 18px;width:70%;float:left;'>";
                  //电商平台:distributor
                  cardHtml += "<strong href='#' style='font-size:14px;font-weight: bold;background-color: white;color:darkgreen;padding:2px;line-height: 18px;border:0'>"+item.distributor.name+"</strong>";  
                  //价格
                  cardHtml += prices;              
                cardHtml += "</div>";      
                //购买按钮
                cardHtml += "<div style='line-height: 18px;width:30%;text-align:right;float:right;z-index:99'>";
                cardHtml += "<strong style='float:right;margin-right:10px;background-color:darkred;color:white;text-align:right;padding-left:5px;padding-right:5px;font-size:14px;border-radius:3px;' id='view-"+item._key+"' data-item='"+item._key+"'>去看看</strong>";
                cardHtml += "</div>";                      
              cardHtml += "</div>"; 
            cardHtml += "</div>";
        /////////////结束：方形卡片样式///////////


        /////////////文字链接：只需要把文字写上就行了///////////
         cardHtml += "<div id='textLink"+item._key+"' style='width:90%;display:none;'>";
         cardHtml += "【"+item.distributor.name+"】"+item.title;
         cardHtml += "</div>";
        /////////////结束：文字链接样式///////////

        /////////////单独链接：啥也不用写：会直接忽略的///////////
         cardHtml += "<div id='url"+item._key+"' style='width:90%;display:none;'>";
         cardHtml += "【"+item.distributor.name+"】"+item.title;
         cardHtml += "</div>";
        /////////////结束：文字链接样式///////////

      cardHtml += "</div>";
      //操作按钮
      cardHtml += "<div id='cardWrapper"+item._key+"' style='width:98%;padding-left:10px;display:flex;flex-direction: row;align-items: left;'>";
        //if(!$("#profit-tip-"+item._key))//部分情况下可能由于出现重复条目，导致佣金提示显示两次，此处强行保护
        cardHtml += profitTags;
        cardHtml += copyBtns;
      cardHtml += "</div>";  
      //间隔空白 
      cardHtml += "<div style='line-height:15px;'>&nbsp</div>";  
    cardHtml += "</div>";
    $("#waterfall").append("<li>"+cardHtml+"</li>");
    num++;

    //注册事件：在新tab页内显示商品详情
    $("#view-"+item._key).click(function(){
        //跳转到详情页
        //window.open("info2.html?category="+category+"&id="+item._key);
        var toUrl = item.url;
        if(item.link.web2)
          toUrl = item.link.web2;
        console.log("try to redirect.",toUrl);
        var msg = {
          sxRedirect:toUrl,
          sxTargetWindow:"_new"
        };
        window.parent.postMessage(msg, "*");//不设定origin，直接通过属性区分                   
    });

    //注册事件：copy图文卡片
    $("#copy-imageText"+item._key).click(function(){
        console.log("trigger copy event");
        pendingCopyCardType = "imageText";//修改卡片类型为图文
        pendingCopyFormat = "text/html";//html
        pendingCopyItem = item._key;//修改当前选中item
        //获取CPS链接，并触发拷贝事件
        checkCpsLink(item);
        //document.execCommand("copy");//触发拷贝事件
    });

    //注册事件：copy条幅卡片
    $("#copy-banner"+item._key).click(function(){
        console.log("trigger copy event");
        pendingCopyCardType = "banner";//修改卡片类型为banner
        pendingCopyFormat = "text/html";//html
        pendingCopyItem = item._key;//修改当前选中item
        //获取CPS链接，并触发拷贝事件
        checkCpsLink(item);
        //document.execCommand("copy");//触发拷贝事件
    });

    //注册事件：copy方形卡片：小程序样式
    $("#copy-square"+item._key).click(function(){
        console.log("trigger copy event");
        pendingCopyCardType = "square";//修改卡片类型为square
        pendingCopyFormat = "text/html";//html
        pendingCopyItem = item._key;//修改当前选中item
        //获取CPS链接，并触发拷贝事件
        checkCpsLink(item);
        //document.execCommand("copy");//触发拷贝事件
    });

    //注册事件：copy文字链接
    $("#copy-textLink"+item._key).click(function(){
        console.log("trigger copy event");
        pendingCopyCardType = "textLink";//修改为textLink
        pendingCopyFormat = "text/html";//html
        pendingCopyItem = item._key;//修改当前选中item
        //获取CPS链接，并触发拷贝事件
        checkCpsLink(item);
    });

    //注册事件：copy链接
    $("#copy-url"+item._key).click(function(){
        console.log("trigger copy event");
        pendingCopyCardType = "url";//修改类型为url
        pendingCopyFormat = "text/plain";//仅文字
        pendingCopyItem = item._key;//修改当前选中item
        //获取CPS链接，并触发拷贝事件
        checkCpsLink(item);
    });    

    // 表示加载结束
    loading = false;
}

//拷贝商品图文卡片到剪贴板，便于粘贴到微信文章
function copyItem(event){
    console.log("start copy item.[itemKey]"+pendingCopyItem,pendingCopyCardType,event);
    event.preventDefault();//阻止默认行为
    var cardhtml = document.getElementById(pendingCopyCardType+pendingCopyItem).outerHTML//带着链接一起拷贝
                        .replace(/display:none/g,"display:flex")//模式切换为显示
                        .replace(/div/g,"section")
                        .replace(/span/g,"strong")
                        .replace(/13px/g,"16px")//distributor字体调整
                        .replace(/11px/g,"14px")//title字体调整
                        //.replace(/80%/,"70%")//更改card宽度
                        .replace(/width="80"/g,'width="100"');
    console.log("html copied.[itemKey]"+pendingCopyItem,cardhtml,broker);   

    var htmlWithLink = "";
    //注意：不能直接跳转到第三方商城，必须经过中间页面跳转，否则收益不会被计算
    //htmlWithLink += '<a href="'+pendingItemCpsLink+'">';
    //废弃：跳转时间过长
    //htmlWithLink += '<a href="https://www.biglistoflittlethings.com/ilife-web-wx/go.html?id='+pendingCopyItem+'&from='+from+'&fromUser='+fromUser+'&fromBroker='+broker.id+'">';
    //直接采用已经获取的链接跳转
    htmlWithLink += '<a href="https://www.biglistoflittlethings.com/ilife-web-wx/bridge.html?url='+encodeURIComponent(pendingItemCpsLink)+'">';    
    htmlWithLink += cardhtml;
    htmlWithLink += '</a>';

    //对于拷贝URL进行特殊处理
    if(pendingCopyCardType=="url"){
      htmlWithLink = 'https://www.biglistoflittlethings.com/ilife-web-wx/bridge.html?url='+encodeURIComponent(pendingItemCpsLink); 
    }
    console.log("copy html with link to clipboard.",htmlWithLink);
    event.clipboardData.setData(pendingCopyFormat, htmlWithLink);

    $.toast({//浮框提示已添加成功
        heading: '图文卡片已复制',
        text: '请粘贴到相应位置查看',
        showHideTransition: 'fade',
        icon: 'success'
    });      
}


//检查更新达人CPS链接。如果已有链接则直接使用，否则需要动态生成
function checkCpsLink(item){//支持点击事件
    var benificiaryBrokerId = "system";//默认为平台直接分享
    if(broker&&broker.id){//如果当前分享用户本身是达人，则直接引用其自身ID
        benificiaryBrokerId=broker.id;
    }/**else if(fromBroker && fromBroker.trim().length>0){
        benificiaryBrokerId=fromBroker;
    }//**/
    //记录发表日志
    logstash(item,from,"publish",fromUser,benificiaryBrokerId,function(){
      //do nothing
    });   
    //处理cps链接
    var target = item.url;
    if(item.link.cps && item.link.cps[benificiaryBrokerId]){//能够直接获得达人链接则直接显示
        pendingItemCpsLink=item.link.cps[benificiaryBrokerId];
        document.execCommand("copy");//触发拷贝事件
    }else{//否则请求其链接并显示
        getBrokerCpsLink(benificiaryBrokerId,item);
    }      
}

//根据Broker查询得到CPS链接
function getBrokerCpsLink(brokerId,item) {
    var data={
        brokerId:brokerId,
        source:item.source,
        category:"",//注意：不按照类别进行区分
        //category:item.categoryId?item.categoryId:"",
        url:item.link.wap
    };
    console.log("try to generate broker specified url",data);
    util.AJAX(app.config.sx_api+"/mod/cpsLinkScheme/rest/cpslink", function (res) {
        console.log("======\nload cps link info.",data,res);
        if (res.status) {//用返回的cps链接
            pendingItemCpsLink=res.link;
            //更新到item，更新完成后跳转到cps链接地址
            updateBrokerCpsLink(item,brokerId,res.link);
        }else{//如果不能生成链接则直接使用已有链接
            if(item.link.wap2){
                pendingItemCpsLink=item.link.wap2;
            }else if(item.link.wap){
                pendingItemCpsLink=item.link.wap;
            }else{//理论上不会到这里
                pendingItemCpsLink=item.url;
            }
        }
        document.execCommand("copy");//触发拷贝事件
    },"GET",data);
}

//更新item信息：补充达人CPS链接
function updateBrokerCpsLink(item,brokerId,cpsLink) {
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };   
    var cps = {};
    cps[brokerId]=cpsLink;//yibrokerId为key，以cpslink为value
    var data = {link:{cps:cps}};
    var url = app.config.data_api +"/_api/document/my_stuff/"+item._key;
    if (app.globalData.isDebug) console.log("Info2::updateItem update item with broker cps link.[itemKey]"+item._key,data);
    $.ajax({
        url:url,
        type:"PATCH",
        data:JSON.stringify(data),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:header,
        timeout:2000,//设置超时
        success:function(res){//正确返回则跳转到返回地址
          if (app.globalData.isDebug) console.log("Info2::updateItem update item finished.", res);
          //跳转到cps地址
          //window.location.href = cpsLink;
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则直接跳转到cps地址，忽略更新stuff失败
              console.log("ajax timeout. jump to cps link directly.",textStatus);
              //window.location.href = cpsLink;
            }
        },
        error: function () {//调用出错执行的函数
            console.log("error occured while update cps link to stuff. jump to cps link directly.");
            //window.location.href = cpsLink;
          }

    });
}

//添加item到board
function addItemToBoard(item){
    console.log("Index::addItemToBoard try to add item to board.", item)
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    var data = {
        item:item._key,
        title:item.title,
        description:item.tags?item.tags.join(" "):"",
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
            html += "<div class='itemTags profit-show' style='margin:0;' id='profit-tip-"+item._key+"'><span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(res.order*10)/10).toFixed(1)))+"</span></div>";
            if(res.team && res.team>0.1){//过小的团返不显示
                html += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(res.team*10)/10).toFixed(1)))+"</span></div>";
            }
        }else if(res.credit&&res.credit>0){//如果没有现金则显示积分
            html += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(res.credit*10)/10).toFixed(0)))+"</span></div>";
        }else{//这里应该是出了问题，既没有现金也没有积分
            console.log("===error===\nnothing to show.",item,res);
        }
        //显示到界面
        if(html.trim().length>0 /* && !$("#profit-tip-"+item._key)*/){//由于数据可能重复，导致提示会出现多次，强制检查是否重复
            $("#cardWrapper"+item._key).prepend(html);
            /**
            $("#profit"+item._key).html(html);
            $("#profit"+item._key).toggleClass("profit-hide",false);
            $("#profit"+item._key).toggleClass("profit-show",true);
            //**/
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
            html += "<div class='itemTags profit-show' style='margin:0;' id='profit-tip-"+item._key+"'><span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(res.order*10)/10).toFixed(1)))+"</span></div>";
            if(res.team && res.team>0.1){//过小的团返不显示
                html += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(res.team*10)/10).toFixed(1)))+"</span></div>";
            }
        }else if(res.credit&&res.credit>0){//如果没有现金则显示积分
            html += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(res.credit*10)/10).toFixed(0)))+"</span></div>";
        }else{//这里应该是出了问题，既没有现金也没有积分
            console.log("===error===\nnothing to show.",item,res);
        }
        //显示到界面
        if(html.trim().length>0 /* && !$("#profit-tip-"+item._key)*/){//由于数据可能重复，导致提示会出现多次，强制检查是否重复
            $("#cardWrapper"+item._key).prepend(html);
            /**
            $("#profit"+item._key).html(html);
            $("#profit"+item._key).toggleClass("profit-hide",false);
            $("#profit"+item._key).toggleClass("profit-show",true);
            //**/
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
        url:"https://data.shouxinjk.net/_db/sea/category/categories",
        type:"get",
        success:function(msg){
            var navObj = $(".navUl");
            for(var i = 0 ; i < msg.length ; i++){
                navObj.append("<li data='"+msg[i]._key+"' data-tagging='"+(msg[i].tagging?msg[i].tagging:"")+"'>"+msg[i].name+"</li>");
                if(currentCategory == msg[i]._key){//高亮显示当前选中的category
                    $(navObj.find("li")[i]).addClass("showNav");
                    tagging = msg[i].tagging;
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
      /**
      var addPersonaKey = "btn-add-persona";
      personKeys.push(addPersonaKey);
      persons.push({
        nickName:"添加客群",
        avatarUrl:"images/add-persona.png",
        relationship:"壮大团队赚钱",
        _key:addPersonaKey
      });    
      //**/   

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
          var myself = app.globalData.userInfo;
          myself.relationship = "自己";
          persons.push(myself);
          personKeys.push(myself._key);
      }
      for (var i = 0; i < arr.length; i++) {
        var u = arr[i];
        if(personKeys.indexOf(u._key) < 0/* && u.openId*/){//对于未注册用户不显示
          persons.push(u);
          personKeys.push(u._key);
        }
      } 

      //新增关心的人按钮
      /**
      var addPersonKey = "btn-add-related-person";
      personKeys.push(addPersonKey);
      persons.push({
        nickName:"添加关心的人",
        avatarUrl:"images/add-person.png",
        relationship:"分享赚钱",
        _key:addPersonKey
      });    
      //**/  

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
    //当前不需要切换，仅高亮当前用户
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

    page.current = -1;//从第一页开始查看
    currentPerson = ids;//修改当前用户
    currentPersonTagging = personTagging;//修改当前用户推荐Tagging
    items = [];//清空列表
    num = 1;//从第一条开始加载
    loadData();//重新加载数据
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
        title:app.globalData.userInfo && app.globalData.userInfo.nickName ?app.globalData.userInfo.nickName+" 的推荐清单":"新的推荐清单",
        //title:broker&&broker.name?broker.name+" 的推荐清单":"新的推荐清单",
        description:"根据你的需求，我们精心挑选了以下清单，请查收",
        tags:boardkeywords,
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

//检查工具面板显示状态
function checkToolbarStatus(){
    console.log("try to check toolbar status..."); 
    var sxToolbarStatus = {};
    if($.cookie('sxToolbarStatus') && $.cookie('sxToolbarStatus').trim().length>0){
        sxToolbarStatus = JSON.parse($.cookie('sxToolbarStatus') );
    } 
    console.log("try to post toolbar  status to parent document.",sxToolbarStatus);   
    window.parent.postMessage({
        sxCookie:{
            action: 'return',
            key:'sxToolbarStatus',
            value:sxToolbarStatus
        }
    }, '*');    
}

//监听postMessage事件：在工具条发生变化时，将状态写入cookie
function listenPostMessage(){
    console.log("child window start listening....");
    var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
    var eventer = window[eventMethod];
    var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

    // Listen to message from child window
    eventer(messageEvent,function(e) {
        var key = e.message ? "message" : "data";
        var data = e[key];
        console.log("got message from parent window.",data);
        if(data&&data.sxCookie){//实现缓存数据交换
            var sxCookie  = data.sxCookie;
            if (sxCookie.action == 'set'){//存数据到cookie
                //直接写入cookie：键值包括sxToolbarStatus
                console.log("save cookie",sxCookie);
                document.cookie = sxCookie.key+"="+JSON.stringify(sxCookie.value)+"; SameSite=None; Secure";
                //由于窗口显示变化，需要设置是否加载数据标志
                if(sxCookie.key == 'sxToolbarStatus'){//根据状态设置是否加载数据
                  if(sxCookie.value.show){//展示面板，则设置数据等待加载
                      loading = false;
                  }else{
                      loading = true;
                  }
                }
            }else if (sxCookie.action == 'get') {//从cookie读取数据并返回上层窗口
                console.log("try to post message to parent document.",data);
                window.parent.postMessage({
                    sxCookie:{
                        action: 'return',
                        key:sxCookie.key,
                        value:$.cookie(sxCookie.key)?JSON.parse($.cookie(sxCookie.key)):{}
                        //value:window.localStorage.getItem(sxCookie.key)?JSON.parse(window.localStorage.getItem(sxCookie.key)):{}
                    }
                }, '*');
            };
        }
    },false);
}

//显示登录达人信息：仅对于来源于web有效
function showCurrentBrokerInfo(){
    var html = "";
    html += "<div id='sxDiv' style='position:fixed;z-index:2147483646;top:5px;right:5px;width:300px;height:80px;border-radius:5px;'>";
    //broker info
    html += '<div id="brokerInfoDiv" class="info">';
    html += '<div class="info-general">';
    html += '<img id="broker-logo" class="general-icon" src="'+app.globalData.userInfo.avatarUrl+'" height="60px"/>';
    html += '</div>';
    html += '<div class="info-detail">';
    html += '<div id="broker-name" class="info-text info-blank" style="color:#000;font-weight:bold;font-size:14px;overflow:hidden;white-space: nowrap;text-overflow: ellipsis;">'+app.globalData.userInfo.nickName+'</div>';
    html += '<div class="info-text info-blank" id="brokerHint"  style="color:#000;font-family:Microsoft YaHei,Arial,sans-serif;font-wight:normal;">请筛选需要的商品<br/>选定后点击拷贝，并粘贴到正文即可</div>';
    html += '</div>';
    html += '</div>';  
    $("body").append(html);

    if(app.globalData.userInfo._key){//更新达人名称，同时显示 切换按钮。点击切换后将删除sxCookie
        var brokerName = "Hi,"+app.globalData.userInfo.nickName/*+(broker&&broker.name&&broker.name.trim().length>0&&broker.name!==app.globalData.userInfo.nickName?("("+broker.name+")"):"")*/;
        brokerName += "&nbsp;<a href='#' style='font-size:12px;color:silver' id='sxChangeBroker' alt='切换账户'><img width='12' text='切换账户' style='vertical-align:middle; margin: 0 auto; ' src='https://www.biglistoflittlethings.com/ilife-web-wx/images/change.png'/></a>";
        $("#broker-name").html(brokerName);
        $("#sxChangeBroker").click(function(event){
            //删除sxCookie
            document.cookie = "sxAuth="+JSON.stringify({})+"; SameSite=None; Secure";
            //返回到登录页面
            window.location = "login.html";
        });
    }  
}
