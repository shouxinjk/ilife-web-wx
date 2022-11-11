// 文档加载完毕后执行
$(document).ready(function ()
{
        //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    rootFontSize = rootFontSize >16 ? 16:rootFontSize;//最大为18px
    oHtml.style.fontSize = rootFontSize+ "px";   
    //计算图片流宽度：根据屏幕宽度计算，最小显示2列
    /**
    if(width < 2*columnWidth){//如果屏幕不能并排2列，则调整图片宽度
        columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }    
    //**/
    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    //category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录
    if(args["id"])inputPerson=args["id"];//从请求中获取需要展示的person或personaId
/**
    $('#waterfall').NewWaterfall({
        width: width-20,//1列
        //width: columnWidth,//动态列宽，当前为2列
        delay: 100,
    });
    //**/


    $("body").css("background-color","#fff");//更改body背景为白色

    util.getUserInfo();//从本地加载cookie
    
    searchCategory();//默认发起类目检索

    //注册事件：点击搜索后重新查询meta category
    $("#findAll").click(function(){//注册搜索事件：点击搜索全部
        $("#categoryDiv").empty();
        searchCategory();     
    });     
});

var width = 600;
var clientWidth = 600;

var categoryId = null; //记录当前切换的metaCategory。由于启用定时器，切换时有延迟，导致加载的是上一个category商品的情况
var categoryName = ""; //作为推荐搜索关键字，切换类目后用类目名称填写

var columnWidth = 300;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];
var page = {//翻页控制
  size: 20,//每页条数
  total: 1,//总页数
  current: -1//当前翻页
};

var persons = [];
var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:JSON.parse($.cookie('sxUserInfo'))._key;//本地加载当前用户
var currentPersonTagging = "";//记录当前用户的标签清单，用于根据标签显示内容
var currentPersonType = "person";//当前选中的是用户还是画像，默认进入时显示当前用户
var personKeys = [];//标记已经加载的用户key，用于排重

var inputPerson = null;//接收指定的personId或personaId

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        syncPerson(res);//提交用户昵称到后端
        //loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
}
//同步用户信息：将用户昵称及头像同步到后台
function syncPerson(person){
    //同时更新broker的nickname及avatarUrl：由于微信不能静默获取，导致broker内缺乏nickname及avatarUrl
    console.log("try to sync broker info.",person);
    $.ajax({
        url:app.config.sx_api+"/mod/broker/rest/sync/"+person._key,
        type:"post",
        data:JSON.stringify({
            nickname: person.nickName,
            avatarUrl:person.avatarUrl
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        success:function(res){
            console.log("sync success.",res);
        },
        error:function(){
            console.log("sync failed.",person);
        }
    });     
}

var sxInterval = null;
function loadFeeds(){
    //先清空原来的
    resetItemsInterval(); //清空定时器及缓存的商品条目

    sxInterval = setInterval(function ()
    {
        //console.log("interval",$(window).scrollTop(),$(document).height(),$(window).height(),$(document).height() - $(window).height() - dist);
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            // 表示开始加载
            loading = true;

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                console.log("try load data by categoryId.",categoryId);
                loadData(categoryId);
            }else{//否则使用本地内容填充
                //console.log("load from locale ");
                insertItem();
            }
        }
    }, 60);
}


//搜索得到metaCategory
function searchCategory() {
    console.log("Measures::searchCategory",$("#searchTxt").val());
    //设置query
    var esQuery = {//搜索控制
      from: 0,
      size: 1000, //默认从1000条中发起搜索
       "query": {
          "bool":{
              "filter":[
                  {
                      "exists": {"field":"categoryId"}
                  }
              ],
              "must":[]
          }
      },
      "collapse": {
          "field": "categoryId"
      },
      "_source": "meta",
      "sort": [
          { "@timestamp": { "order": "desc" } },
          { "_score": { "order": "desc" } }
      ] 
    };

    if($("#searchTxt").val() && $("#searchTxt").val().trim().length>0){
      console.log("add query text to search.",$("#searchTxt").val());
      esQuery.query.bool.must.push({
                      "match" : {"full_text": $("#searchTxt").val()}
                });
    }

    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };

    $.ajax({
        url:app.config.search_api+"/stuff/_search", 
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        crossDomain: true,
        timeout:3000,//设置超时
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.hits.total == 0 || data.hits.hits.length==0){//如果没有内容，则显示提示文字
                $("#categoryDiv").append("<div style='font-size:12px;'>没有匹配的条目，请重新尝试</div>");
                shownomore(true);
                showloading(false);
            }else{
                //更新总页数
                var total = data.hits.total;
                page.total = (total + page.size - 1) / page.size;
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                var hits = data.hits.hits;
                for(var i = 0 ; i < hits.length && i<10; i++){ //最多仅显示10个
                    //items.push(hits[i]._source.item);
                    if(hits[i]._source.meta && hits[i]._source.meta.category && hits[i]._source.meta.categoryName){
                      console.log("got item. ",hits[i]._source.meta);
                      insertCategoryItem(hits[i]._source.meta);
                    }
                    //默认选中一个
                    if(i==0){
                      console.log("try load items by default. categoryId is ",hits[i]._source.meta.category);

                      categoryId = hits[i]._source.meta.category;
                      categoryName = hits[i]._source.meta.categoryName;
                      showDimensionCirclePack( hits[i]._source.meta.categoryName );//, $(this).data("id") );//加载并显示图表
                      loadFeaturedDimensions( );// $(this).data("id") );//加载featured维度及商品数据
                      loadFeeds();//加载商品数据 
                      
                      //高亮
                      $("#metacat"+categoryId).css("background-color","green");
                      $("#metacat"+categoryId).css("color","#fff");
                    }
                }
                showloading(false);
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
    });
  }

//清空缓存的商品列表、定时器及DOM元素，在切换目录时均需要调用
function resetItemsInterval(){
    //清空商品及定时器
    if(!sxInterval){
      clearInterval(sxInterval);
      sxInterval = null;
    }        
    //恢复当前分页并清空列表
    num = 1;
    page.current = -1;
    items = [];
    dist = 500;
    loading = false;
    $("#Center").empty();
    $("#Center").append('<ul id="waterfall"></ul>');
    $('#waterfall').NewWaterfall({
        width: width-20,//1列
        //width: columnWidth,//动态列宽，当前为2列
        delay: 100,
    });    
}

//根据类目ID获取客观评价维度featured节点
var featuredDimension = [];
function loadFeaturedDimensions(){
    //获取类目下的特征维度列表：注意是同步调用
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimension/rest/featured-dimension",
        type:"get",
        data:{categoryId:categoryId},
        success:function(ret){//json array
            console.log("===got featured dimension===\n",ret);
            featuredDimension = ret;
            if(ret.length>0){
              showLegends(ret);
              console.log("try load feeds by categoryId.",categoryId);             
            }else{
              $("#legendDiv").empty();
            }
        }
    }); 
}

//加载指定item的客观评分
function loadMeasureScores(stuff){
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
            showMeasureScores(stuff,itemScore);
        }
    });   
}
//显示客观评价得分
//显示为bar，颜色款宽度10
var scale = 60;//行高60，按照该数值计算颜色块高度
function showMeasureScores(stuff,itemScore){
    //准备评分表格：根据评价维度逐行显示
    var colorIndex = 0;
    if(featuredDimension.length==0){
        var html  = '<div id="mscore-'+stuff._key+'" style="font-size:12px;color:silver">评价数据请稍等</div>';//以itemKey+dimensionId为唯一识别
        $("#measure-"+stuff._key).append(html);
    }else{
      featuredDimension.forEach(function(dimension){
        var score = itemScore[dimension.id]?itemScore[dimension.id]*scale:2;//如果没有则只显示底部边框
        if(colorIndex>colors.length-1)colorIndex=colors.length-1;
        var html  = '<div id="mscore-'+stuff._key+dimension.id+'" style="width:10px;height:'+score+'px;background-color:'+colors[colorIndex]+'"></div>';//以itemKey+dimensionId为唯一识别
        $("#measure-"+stuff._key).append(html);
        colorIndex++; 
      });
    }   
}


//图形化显示客观评价树
function showDimensionCirclePack(categoryName){
    //根据category获取客观评价数据
    var data={
        categoryId:categoryId
    };
    console.log("try to load dimension data.",data);
    util.AJAX(app.config.sx_api+"/mod/itemDimension/rest/dim-tree-by-category", function (res) {
        console.log("======\nload dimension.",data,res);
        if (res.length>0) {//显示图形
            console.log("try to show circle pack.",res);
            //显示图表    
            ZoomableCirclePack("#circlepack",{name:categoryName,children:res}, {
              value: d => d.weight, // weight 
              label: d => d.name, // label
              diameter: clientWidth/2
            }); 
            //显示操作提示
            $("#circlepackTip").css("display","block");
            $("#circlepack").css("display","block");
        }else{//没有则啥也不干
            //do nothing
            console.log("failed load dimension tree.",data);
            //隐藏操作提示
            $("#circlepackTip").css("display","none");
            $("#circlepack").css("display","none");
        }
    },"GET",data);    
}

//显示条目评分图例颜色
var  colors = ['#8b0000', '#dc143c', '#ff4500', '#ff6347', '#1e90ff','#00ffff','#40e0d0','#9acd32','#32cd32','#228b22'];
function showLegends(dimensions){
  $("#legendDiv").empty();
  var i=0;
  dimensions.forEach(function(dimension){ //仅显示第一层
    $("#legendDiv").append("<div style='background-color:"+colors[i]+";color:#fff;font-size:10px;margin:1px;padding:2px;'>"+dimension.name+"</div>");
    i++;
  });
}

//加载用户浏览数据：根据选定用户显示其浏览历史，对于画像则显示该画像下的聚集数据
//currentPersonType: person则显示指定用户的记录，persona显示该画像下所有记录
function loadData() {
    console.log("Feed::loadData",categoryId);
    //设置query
    var esQuery = {//搜索控制
      from: (page.current + 1) * page.size,
      size: page.size,
      "query": {
        "bool": {
          "must": [{
            "nested": {
              "path": "meta",
              "query": {
                "term": {
                  "meta.category": categoryId
                }
              }
            }
          }]
        }
      },
      "sort": [
          { "@timestamp": { "order": "desc" } },
          { "_score": { "order": "desc" } }
      ] 
    };

    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };

    console.log("try to search stuff.",JSON.stringify(esQuery), esQuery);

    $.ajax({
        url:app.config.search_api+"/stuff/_search", 
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        crossDomain: true,
        timeout:3000,//设置超时
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.hits.total == 0 || data.hits.hits.length==0){//如果没有内容，则显示提示文字
                shownomore(true);
                showloading(false);
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
                showloading(false);
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
    });
  }


//将item显示到页面
//logo、平台、标题、标价+售价+优惠券、店返+团返+积分、评价数据、点击后跳转到详情页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
    console.log("try insert stuff item.",item);
    if(!item){
      shownomore(true);
      return;
    }
    //排重
    if($("#"+item._key).length>0)
      return;
    //var imgWidth = columnWidth-2*columnMargin;//注意：改尺寸需要根据宽度及留白计算，例如宽度为360，左右留白5，故宽度为350
    var imgWidth = 48;//固定为100
    var imgHeight = random(50, 300);//随机指定初始值
    //计算图片高度
    var img = new Image();
    img.src = item.images[0];
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算
    //console.log("orgwidth:"+orgWidth+"orgHeight:"+orgHeight+"width:"+imgWidth+"height:"+imgHeight);
    var image = "<img src='"+item.images[0]+"' width='"+imgWidth+"' height='"+imgHeight+"'/>"
    //var title = "<span class='title'><a href='info.html?category="+category+"&id="+item._key+"'>"+item.title+"</a></span>"
    
    var tagTmpl = "<a class='itemTag' href='index-metrics.html?keyword=__TAGGING'>__TAG</a>";
   var highlights = "<div class='itemTags'>";
    highlights += "<a class='itemTagPrice' href='#'>"+(item.price.currency?item.price.currency:"¥")+item.price.sale+"</a>";
    if(item.price.coupon>0){
        highlights += "<span class='couponTip'>券</span><span class='coupon' href='#'>"+item.price.coupon+"</span>";
    }    
    highlights += tagTmpl.replace("__TAGGING",item.distributor.name).replace("__TAG",item.distributor.name).replace("itemTag","itemTagDistributor");
    highlights += '<span id="jumpbtn'+item._key+'" class="jumpbtn">&nbsp;&nbsp;立即前往&nbsp;&nbsp;</span>';
    highlights += "</div>";

    var profitTags = "";

    if(item.profit&&item.profit.type=="3-party"){//如果已经存在则直接加载
      if(item.profit&&item.profit.order){
          profitTags += "<span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(item.profit.order*10)/10).toFixed(1)))+"</span>";
          if(item.profit&&item.profit.team&&item.profit.team>0.1)profitTags += "<span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(item.profit.team*10)/10).toFixed(1)))+"</span>";
      }else if(item.profit&&item.profit.credit&&item.profit.credit>0){
          profitTags += "<span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(item.profit.credit*10)/10).toFixed(0)))+"</span>";
      }
    }

    if(profitTags.trim().length>0){
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-show'>"+profitTags+"</div>";
    }else{
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide'></div>";
    }     

    //属性列表
    var propTags = "<div class='title' style='line-height:12px;font-size:10px;'>";//显示原始属性键值对
    if(item.props && item.props instanceof Array){ //兼容采用数组存储的条目
        item.props.forEach(function(obj){
            Object.keys(obj).forEach(function(key){
                propTags += key +": "+obj[key]+"<br/>";
            });
        });
    }else if(item.props){
        Object.keys(item.props).forEach(function(key){
            propTags += key +": "+item.props[key]+"<br/>";
        });
    }
    propTags += "</div>";

    //商品tag列表
    var itemTags = "<div class='title' style='font-size:10px;'>";//显示原始属性键值对
    if(item.tags){
        Object.keys(item.tags).forEach(function(key){
            itemTags += "<span style='padding:1px 2px;margin:1px;background-color:#8BCE2D;border-radius:5px;color:#fff;'>"+item.tags[key]+"</span>";
        });
    }
    //手动标注tag列表
    if(item.tagging){
        item.tagging.split(" ").forEach(function(tag){
            itemTags += "<span style='padding:1px 2px;margin:1px;background-color:#E85552;border-radius:5px;color:#fff;'>"+tag+"</span>";
        });
    }
    itemTags += "</div>";


    var metaCategory = "";
    if(item.meta&&item.meta.categoryName){
        metaCategory = "<div class='title'>"+item.meta.categoryName+"</div>"
    }
    var title = "<div class='title' style='font-size:12px;line-height: 14px;overflow: hidden; text-overflow: ellipsis;display: -webkit-box;-webkit-line-clamp: 4;-webkit-box-orient: vertical;'>"+item.distributor.name+" "+item.title+"</div>"
    $("#waterfall").append("<li><div id='"+item._key+"' style='display:flex;flex-direct:row;width:96%;height:50px;'>" 
        + "<div style='width:15%;margin:auto;'>"+ image +"</div>"
        + "<div style='width:35%;margin:auto 0px;'>"+ title +"</div>"
        + "<div style='width:20%;margin:auto 0px;font-size:12px;font-weight:bold;text-align:center;'>"+ item.price.sale +"</div>"
        + "<div style='width:30%;margin:auto 0px;display:flex;flex-direct:row;justify-content:space-around;align-items:baseline;flex-wrap:nowrap;' id='measure-"+item._key+"'></div>"
        + "</div></li>");
    num++;

    //装载评价数据：查询后动态添加
    if(item.meta&&item.meta.category){
      loadMeasureScores(item);
    }

    //注册事件
    $("#"+item._key).click(function(){
        //跳转到详情页
        window.location.href = "info2.html?id="+item._key;
    });

    // 表示加载结束
    loading = false;
}


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
      //*
      if (app.globalData.userInfo != null && personKeys.indexOf(app.globalData.userInfo._key) < 0){
          persons.push(app.globalData.userInfo);
          personKeys.push(app.globalData.userInfo._key);
        }
      //**/
      for (var i = 0; i < arr.length; i++) {
        var u = arr[i];
        if(personKeys.indexOf(u._key) < 0/* && u.openId*/){//对于未注册用户不显示
          //如果是非注册用户则显示为客群
          if(!u.openId){
            u.personOrPersona = "persona";//设置标记，用于区分persona及person
          }
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
        slidesPerView: 7,
    });  
    //调整swiper 风格，使之悬浮显示
    $(".swiper-container").css("position","fixed");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","0");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","#fff");
    //$(".swiper-container").css("margin-bottom","3px");
  
    //将当前用户设为高亮  
    if(inputPerson && personKeys.indexOf(inputPerson)>-1 && persons[personKeys.indexOf(inputPerson)]){//有输入用户信息则优先使用
      currentPerson = inputPerson;
      currentPersonType = persons[personKeys.indexOf(inputPerson)].personOrPersona?"persona":"person";
      currentPersonTagging = persons[personKeys.indexOf(inputPerson)].tags?persons[personKeys.indexOf(inputPerson)].tags.join(" "):"";
    }else{//根据当前用户加载数据：默认使用第一个
      currentPerson = persons[0]._key;
      currentPersonTagging = persons[0].tags?persons[0].tags.join(" "):"";   
    }   
    changePerson(currentPersonType,currentPerson,currentPersonTagging);    
}

//将person显示到页面
/*
<view class="person">
      <image class="person-img{{person._key==currentPerson?'-selected':''}}" src="{{person.avatarUrl}}" bindtap="changePerson" data-id="{{person._key}}"/>
      <view class="person-name">{{person.nickName}}</view>
</view>
*/

function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div class="person" id="'+person._key+'"data-type="'+(person.personOrPersona?"persona":"person")+'" data-tagging="'+(person.tags?person.tags.join(" "):"*")+'">';
    var style= person._key==currentPerson?'-selected':'';
    html += '<div class="person-img-wrapper"><img class="person-img'+style+'" src="'+person.avatarUrl+'"/></div>';
    html += '<span class="person-name">'+(person.personOrPersona=="persona"?"☆":"")+person.nickName+'</span>';
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
          console.log("try to change person by jQuery click event.",person._key,e.currentTarget.type,e.currentTarget.id,e);
          changePerson(e.currentTarget.dataset.type,e.currentTarget.id,e.currentTarget.dataset.tagging);
      });
    }
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
    //注册跳转事件：跳转到推荐页，需要带有当前用户ID
    $("#findMoreBtn").click(function(){
      window.location.href = "index.html?keyword="+categoryName;
    });    
  }else{
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",true);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",false);
  }
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

//将item显示到页面
function insertCategoryItem(measureItem){
    if(!measureItem){
      shownomore(true);
      return;
    }
    //隐藏no-more-tips
    $("#no-results-tip").toggleClass("no-result-tip-hide",true);
    $("#no-results-tip").toggleClass("no-result-tip-show",false); 
    
    var measureTag = "<div id='metacat"+measureItem.category+"' data-id='"+measureItem.category+"' data-name='"+measureItem.categoryName+"' style='line-height:16px;font-size:12px;min-width:60px;font-weight:bold;padding:2px;border:1px solid silver;border-radius:10px;margin:2px;'>"+measureItem.categoryName+"</div>"
    $("#categoryDiv").append( measureTag );

    //注册事件
    $("#metacat"+measureItem.category).click(function(){
        console.log("meta category changed. ",  $(this).data("id") );

        categoryId = $(this).data("id"); //设置全局变量，避免interval延迟调用问题
        categoryName = $(this).data("name"); //设置全局变量，避免interval延迟调用问题
        showDimensionCirclePack( $(this).data("name"));//, $(this).data("id") );//加载并显示图表
        loadFeaturedDimensions( );// $(this).data("id") );//加载featured维度及商品数据
        loadFeeds();//加载商品数据 

        //高亮
        $("div[id^=metacat]").css("background-color","#fff");
        $("div[id^=metacat]").css("color","#000");          
        $("#metacat"+categoryId).css("background-color","green");
        $("#metacat"+categoryId).css("color","#fff");        
    });

    // 表示加载结束
    showloading(false);
    loading = false;      
}

//更新item信息。只用于更新profit
function updateItem(item) {
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };  
    var url = app.config.data_api +"/_api/document/my_stuff/"+item._key;
    if (app.globalData.isDebug) console.log("Feeds::updateItem update item.",item);
    util.AJAX(url, function (res) {
      if (app.globalData.isDebug) console.log("Feeds::updateItem update item finished.", res);
      //do nothing
    }, "PATCH", item, header);
}

function changePerson (type,personId,personTagging) {
    var ids = personId;
    if (app.globalData.isDebug) console.log("Feed::ChangePerson change person.",currentPerson,personId);
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
    showloading(true);//显示加载状态

    page.current = -1;//从第一页开始查看
    currentPerson = ids;//修改当前用户
    currentPersonTagging = personTagging;//修改当前用户推荐Tagging
    currentPersonType = type;//更改当前用户类型
    items = [];//清空列表
    num = 1;//从第一条开始加载
    //loadData();//重新加载数据
  } 

// 自动加载更多：此处用于测试，动态调整图片高度
function random(min, max)
{
    return min + Math.floor(Math.random() * (max - min + 1))
}

// 时间戳转多少分钟之前
function getDateDiff(dateTimeStamp) {
    // 时间字符串转时间戳
    var timestamp = new Date(dateTimeStamp).getTime();
    var minute = 1000 * 60;
    var hour = minute * 60;
    var day = hour * 24;
    var halfamonth = day * 15;
    var month = day * 30;
    var year = day * 365;
    var now = new Date().getTime();
    var diffValue = now - timestamp;
    var result;
    if (diffValue < 0) {
        return;
    }
    var yearC = diffValue / year;
    var monthC = diffValue / month;
    var weekC = diffValue / (7 * day);
    var dayC = diffValue / day;
    var hourC = diffValue / hour;
    var minC = diffValue / minute;
    if (yearC >= 1) {
        result = "" + parseInt(yearC) + "年前";
    } else if (monthC >= 1) {
        result = "" + parseInt(monthC) + "月前";
    } else if (weekC >= 1) {
        result = "" + parseInt(weekC) + "周前";
    } else if (dayC >= 1) {
        result = "" + parseInt(dayC) + "天前";
    } else if (hourC >= 1) {
        result = "" + parseInt(hourC) + "小时前";
    } else if (minC >= 1) {
        result = "" + parseInt(minC) + "分钟前";
    } else
        result = "刚刚";
    return result;
}
