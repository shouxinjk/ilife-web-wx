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
    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });
    //判定是否有编辑中的board
    getBoard();//先从cookie内加载
    if(args["boardId"]){//如果参数中有boardId则优先使用
        boardId = args["boardId"];
        var board = {
            id:boardId
        };
        $.cookie('board', JSON.stringify(board), { expires: 3650, path: '/' });  //把编辑中的board写入cookie。能够跳转到其他页面继续添加
    }
    category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录
    tagging = args["keyword"]?args["keyword"]:""; //通过搜索跳转
    filter = args["filter"]?args["filter"]:""; //根据指定类型进行过滤
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
        window.location.href="index.html?keyword="+tagging;
    }); 
    $("#findByPrice").click(function(){//注册搜索事件：点击搜索好价
        tagging = $(".search input").val().trim();
        window.location.href="index.html?filter=byPrice&keyword="+tagging;
    }); 
    $("#findByDistance").click(function(){//注册搜索事件：点击搜索附近
        tagging = $(".search input").val().trim();
        getLocation();//点击后请求授权，并且在授权后每次点击时获取当前位置，并开始搜索
    });  
    $("#findByProfit").click(function(){//注册搜索事件：点击搜索高佣
        tagging = $(".search input").val().trim();
        window.location.href="index.html?filter=byProfit&keyword="+tagging;
    }); 
    $("#findByRank").click(function(){//注册搜索事件：点击搜索好物：根据评价
        tagging = $(".search input").val().trim();
        window.location.href="index.html?filter=byRank&keyword="+tagging;
    });   

    //加载关心的人
    loadPersons();

//TODO：切换为复杂查询。需要在索引结构更新后进行
    console.log("assemble", assembleEsQuery());     
    console.log(JSON.stringify(assembleEsQuery()));  
});

util.getUserInfo();//从本地加载cookie

//加载board信息
var boardId = null;

var columnWidth = 300;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有内容列表
var category  = 0; //当前目录ID
var tagging = ""; //当前目录关联的查询关键词，搜索时直接通过该字段而不是category进行
var filter = "";//通过filter区分好价、好物、附近等不同查询组合

var categoryTagging = "";//记录目录切换标签，tagging = categoryTagging + currentPersonTagging

var page = {
    size:20,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

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

var esQueryByPrice={
  "from": 0,
  "size": page.size,
  "query": {
    "nested": {
      "path": "price",
      "score_mode": "min", 
      "query": {
        "function_score": {
          "query": {
              "match_all": {}
          },
          "script_score": {
            "script": "_score * (2-doc['price.sale'].value/(doc['price.bid'].value==0?doc['price.sale'].value:doc['price.bid'].value))"
          }
        }
      }
    }
  },
  sort: [
    { "_score":   { order: "desc" }},
    { "@timestamp": { order: "desc" }}
  ]
};


var esQueryByRank={
  "from": 0,
  "size": page.size,
  "query": {
    "nested": {
      "path": "rank",
      "score_mode": "avg", 
      "query": {
        "function_score": {
          "query": {
              "match_all": {}
          },
          "script_score": {
            "script": "_score * (1+doc['rank.score'].value/(doc['rank.base'].value==0?5:doc['rank.base'].value))"
          }
        }
      }
    }
  },
  sort: [
    { "_score":   { order: "desc" }},
    { "@timestamp": { order: "desc" }}
  ]
};

var esQueryTemplate = JSON.stringify({
  "query":{
    "bool":{
      "must": [],       
      "must_not": [],                
      "filter": [],      
      "should":[]
    }
  },
  "sort": [
    { "_score":   { "order": "desc" }},
    { "@timestamp": { "order": "desc" }}
  ]   
});

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

var esQueryByDistance={
  from:0,
  size:page.size,
  query: {
    function_score: {
        query: {
            match_all: {}
        },
        functions: [
            {
              gauss: {
                location: { 
                      origin: { lat: 27.9881, lon: 86.9250 },//默认以珠穆朗玛峰为中心
                      offset: "2km",
                      scale:  "3km"
                }
              }
            }
        ],
        boost_mode: "multiply"
    }
  },
    sort: [
        { "_score":   { "order": "desc" }},
        { "@timestamp": { "order": "desc" }}
    ]
};


var esQueryByProfit={
  "from": 0,
  "size": page.size,
  "query": {
    "nested": {
      "path": "profit",
      "score_mode": "min", 
      "query": {
        "function_score": {
          "query": {
              "match_all": {}
          },
          "script_score": {
            "script": "_score * doc['profit.amount'].value"
          }
        }
      }
    }
  },
  sort: [
        { "_score":   { order: "desc" }},
        { "@timestamp": { order: "desc" }}
    ]
};

function getBoard(){
    var boardInfo = $.cookie('board');
    console.log("load board from cookie.",boardInfo);
    if(boardInfo && boardInfo.trim().length>0){
        var board = JSON.parse(boardInfo);
        boardId = board.id;
    }
}

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

function loadItems(){//获取内容列表
    var q={
        match: { 
          full_text:"" 
        }
    };  
    if(filter.trim()=="byPrice" || filter.trim()=="byScore"||filter.trim()=="byDistance"||filter.trim()=="byProfit"||filter.trim()=="byRank"){//需要进行过滤
        if(filter.trim()=="byPrice"){
            esQuery = esQueryByPrice;
        }else if(filter.trim()=="byScore"){//根据评价进行搜索
            //TODO
        }else if(filter.trim()=="byDistance"){//根据位置进行搜索。优先从用户信息中获取经纬度，否则请求获取得到当前用户经纬度
            esQuery = esQueryByDistance;
            esQuery.query.function_score.functions[0].gauss.location.origin.lat = app.globalData.userInfo.location.latitude;
            esQuery.query.function_score.functions[0].gauss.location.origin.lon = app.globalData.userInfo.location.longitude;
        }else if(filter.trim()=="byProfit"){//根据佣金排序
            esQuery = esQueryByProfit;
        }else if(filter.trim()=="byRank"){//根据佣金排序
            esQuery = esQueryByRank;
        }
        if(tagging.trim().length>0){//使用指定内容进行搜索
            q.match.full_text = tagging;
            esQuery.query.function_score.query = q;
        }
    }else{//无过滤
        if(tagging.trim().length>0){//使用指定内容进行搜索
            if(filter.trim()=="byPrice" || filter.trim()=="byProfit"||filter.trim()=="byRank"){//由于使用嵌套查询，查询关键字设置不同
                q.match.full_text = tagging;
                esQuery.query.nested.query.function_score.query = q;
            }else{
                q.match.full_text = tagging;
                esQuery.query = q;
            }
        }else{//搜索全部
            if(filter.trim()=="byPrice" || filter.trim()=="byProfit"||filter.trim()=="byRank"){//由于使用嵌套查询，查询关键字设置不同
                esQuery.query.nested.query.function_score.query = {
                    match_all: {}
                };
            }else{
                esQuery.query = {
                    match_all: {}
                };
            }            
        }
    }
    //处理翻页
    esQuery.from = (page.current+1) * page.size;

    $.ajax({
        url:"https://data.pcitech.cn/stuff/_search",
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        crossDomain: true,
        success:function(data){
            if(data.hits.hits.length==0){//如果没有内容，则显示提示文字
                showNoMoreMsg();
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
        }
    })
}

/*
function loadItems(){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff",
        type:"get",
        data:{offset:items.length,size:20,category:category},
        success:function(data){
            if(data.length==0){//如果没有内容，则显示提示文字
                showNoMoreMsg();
            }else{
                for(var i = 0 ; i < data.length ; i++){
                    items.push(data[i]);
                }
                insertItem();
            }
        }
    })
}
//*/

//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
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
    

    var tags = "<div class='itemTags'>";
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
    var title = "<div class='title'>"+item.title+"</div>"

    var boartBtns = "";
    if(boardId){//如果有board信息则显示添加到清单按钮
        boartBtns = "<div class='itemTags'>";
        boartBtns += "<a  id='btn-add-"+item._key+"-to-board' data-board='"+boardId+"' data-item='"+item._key+"' class='boardOption'>加入清单</a>&nbsp;";
        boartBtns += "<a class='boardOption' href='broker/boards-modify.html?id="+boardId+"'>编辑清单</a>";
        boartBtns += "</div>";
    }

    $("#waterfall").append("<li><div data='"+item._key+"'>" + image+profitTags +highlights+ tags +title+boartBtns+ "</div></li>");
    num++;

    //如果是达人，则加载显示佣金信息

    //注册事件
    $("div[data='"+item._key+"']").click(function(){
        //跳转到详情页
        window.location.href = "info2.html?category="+category+"&id="+item._key;
    });

    //如果有board则注册增加商品事件
    $("#btn-add-"+item._key+"-to-board").click(function(event){
        //添加item到board并浮框提示
        var itemKey = $(this).data("item");
        addItemToBoard(item);

        event.stopPropagation(); //禁止冒泡
    });

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
        console.log("\ngot profit info.",data,res);
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
        console.log("got profit info.",item,res);
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

//当没有更多item时显示提示信息
function showNoMoreMsg(){
    //todo：显示没有更多toast
    /*
    $.toast({
        heading: 'Success',
        text: '没有更多了',
        showHideTransition: 'fade',
        icon: 'info'
    });   
    //*/
    $("#footer").toggleClass("footer-hide",false);
    $("#footer").toggleClass("footer-show",true);
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
                changeCategory(key,tagging);//更换后更新内容
                $(navObj.find("li")).removeClass("showNav");
                $(this).addClass("showNav");
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
    tagging = "";
    if(categoryTagging && categoryTagging.trim().length>0)
        tagging += categoryTagging;
    if(currentPersonTagging && currentPersonTagging.trim().length>0)
        tagging += " "+currentPersonTagging;
    items = [];//清空列表
    $("#waterfall").empty();//清除页面元素
    num=1;//设置加载内容从第一条开始
    page.current = -1;//设置浏览页面为未开始
    console.log("query by tagging.[categoryTagging]"+categoryTagging+"[personTagging]"+currentPersonTagging+"[tagging]"+tagging);
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
                    var baiduApi = "http://api.map.baidu.com/geoconv/v1/?coords="+longitude+","+latitude
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
            //直接开始搜索
            window.location.href="index.html?filter=byDistance&keyword="+tagging;
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
        slidesPerView: 4,
    });  
    //调整swiper 风格，使之悬浮显示
    $(".swiper-container").css("position","relative");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","40");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","red");
    //$(".swiper-container").css("margin-bottom","3px");
  
    //将当前用户设为高亮  
    if(inputPerson && personKeys.indexOf(inputPerson)>-1 && persons[personKeys.indexOf(inputPerson)]){//有输入用户信息则优先使用
      currentPerson = inputPerson;
      currentPersonTagging = persons[personKeys.indexOf(inputPerson)].tags?persons[personKeys.indexOf(inputPerson)].tags.join(" "):"";
    }else{//根据当前用户加载数据：默认使用第一个
      currentPerson = persons[0]._key;
      currentPersonTagging = persons[0].tags?persons[0].tags.join(" "):"";   
    }   
    changePerson(currentPerson,currentPersonTagging);    
}

function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div class="person" id="'+person._key+'" data-tagging="'+(person.tags?person.tags.join(" "):"*")+'">';
    var style= person._key==currentPerson?'-selected':'';
    html += '<div class="person-img-wrapper"><img class="person-img'+style+'" src="'+person.avatarUrl+'"/></div>';
    html += '<div class="person-info">';
    html += '<span class="person-name">'+person.nickName+'</span>';
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
          changePerson(e.currentTarget.id,e.currentTarget.dataset.tagging);
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
