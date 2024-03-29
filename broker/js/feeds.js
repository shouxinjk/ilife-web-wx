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
    $('#waterfall').NewWaterfall({
        width: width-20,//1列
        //width: columnWidth,//动态列宽，当前为2列
        delay: 100,
    });

    $("body").css("background-color","#fff");//更改body背景为白色

    util.getUserInfo();//从本地加载cookie
    //加载达人信息
    loadBrokerInfo();

    loadPerson(currentPerson);//加载用户

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });



    //设置浏览用户
    /*
    if(app.globalData.userInfo){
        persons.push(app.globalData.userInfo);
        personKeys.push(app.globalData.userInfo._key);
        currentPerson = app.globalData.userInfo._key;
    }
    //*/
    loadPersons();//加载用户
    //loadPersonas();//加载用户画像：假设用户是达人，直接尝试加载
    loadFeeds();
    //loadData();//加载数据：默认使用当前用户查询
    
    //同步用户信息，直接从首页进入后需要同步用户昵称及头像
    /**
    if(app.globalData.userInfo&&app.globalData.userInfo._key){//如果本地已有用户则直接加载
        loadPerson(app.globalData.userInfo._key);//加载用户
    }
    //**/
});

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

var actionTypes = {
  view:"看了",
  share:"分享",
  "selection":"选品推荐",
  "publish":"发布",
  "collect":"上架",  
  "share poster":"海报分享",
  "share board poster":"海报分享",
  "share appmsg":"微信分享",
  "share timeline":"朋友圈分享",
  "buy step1":"很感兴趣",
  "buy step2":"剁手",
  buy:"拔草",
  label:"标注",
  favorite:"种草",
  like:"喜欢"
};

var persons = [];
var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:JSON.parse($.cookie('sxUserInfo'))._key;//本地加载当前用户
var currentPersonTagging = "";//记录当前用户的标签清单，用于根据标签显示内容
var currentPersonType = "person";//当前选中的是用户还是画像，默认进入时显示当前用户
var personKeys = [];//标记已经加载的用户key，用于排重

var inputPerson = null;//接收指定的personId或personaId

//优先从cookie加载达人信息
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
  currentBroker = broker.id;
}

/**
//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        syncPerson(res);//提交用户昵称到后端
        //loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
}
//**/

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        syncPerson(res);//提交用户昵称到后端
        //loadBrokerByOpenid(res._key);//根据openid加载broker信息
        //insertPerson(res);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
        //loadData();
        loadBrokerByOpenid(res._key);//根据openid加载broker信息        
    });
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {
            insertBroker(res.data);//显示达人信息
        }
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

function loadFeeds(){
    setInterval(function ()
    {
        //console.log("interval",$(window).scrollTop(),$(document).height(),$(window).height(),$(document).height() - $(window).height() - dist);
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            // 表示开始加载
            loading = true;

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                //console.log("load from remote ");
                loadData();
            }else{//否则使用本地内容填充
                //console.log("load from locale ");
                insertItem();
            }
        }
    }, 60);
}

//加载用户浏览数据：根据选定用户显示其浏览历史，对于画像则显示该画像下的聚集数据
//currentPersonType: person则显示指定用户的记录，persona显示该画像下所有记录
function loadData() {
    console.log("Feed::loadData","[type]"+currentPersonType, "[id]"+currentPerson,"[tagging]"+currentPersonTagging);
    //设置query
    var esQuery = {//搜索控制
      from: (page.current + 1) * page.size,
      size: page.size,
      query: {
        bool: {
          must: [
            {
              "match": {
                "userId": currentPerson
              }
            }
          ]
        }
      },
      collapse: {
        field: "itemId"//根据itemId 折叠，即：一个item仅显示一次
      },
      sort: [
        //{ "weight": { order: "desc" } },//权重高的优先显示
        { "@timestamp": { order: "desc" } },//最近操作的优先显示
        { "_score": { order: "desc" } }//匹配高的优先显示
      ]
    };

    //设置query
    var esQueryForPersona = {//搜索控制
      from: (page.current + 1) * page.size,
      size: page.size,
      query: {
        bool: {
          should: [
            {
              "match": {
                "full_text": currentPersonTagging
              }
            }
          ]
        }
      },
      collapse: {
        field: "itemId"//根据itemId 折叠，即：一个item仅显示一次
      },      
      sort: [
        //{ "weight": { order: "desc" } },//权重高的优先显示
        { "@timestamp": { order: "desc" } },//最近操作的优先显示
        { "_score": { order: "desc" } }//匹配高的优先显示
      ]
    };

    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };

    $.ajax({
        url:"https://data.pcitech.cn/actions/_search",
        type:"post",
        data:JSON.stringify(currentPersonType=="persona"?esQueryForPersona:esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
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
                    //items.push(hits[i]._source.item);
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
      insertPersonItem(persons[i]);
    }    
    //显示滑动条
    var mySwiper = new Swiper ('.swiper-container', {
        slidesPerView: 7,
    });  
    //调整swiper 风格，使之悬浮显示
    /**
    $(".swiper-container").css("position","fixed");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","0");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","#fff");
    //$(".swiper-container").css("margin-bottom","3px");
    //**/
  
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

function insertPersonItem(person){
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
          window.location.href="../user-choosepersona.html?from=feeds";
      });
    }else if(person._key=="btn-add-persona"){//新增客群，直接跳转
      $("#"+person._key).click(function(e){
          window.location.href="my-addpersona.html?from=feeds";
      });
    }else{//切换数据列表
      $("#"+person._key).click(function(e){
          console.log("try to change person by jQuery click event.",person._key,e.currentTarget.type,e.currentTarget.id,e);
          changePerson(e.currentTarget.dataset.type,e.currentTarget.id,e.currentTarget.dataset.tagging);
      });
    }
}

var currentActionType = '';//当前操作类型
function changeActionType (e) {
    console.log("now try to change action type.",e);
    //首先清除原来高亮状态
    if(currentActionType.trim().length>0){
        $("#"+currentActionType+" img").attr("src","images/"+currentActionType+".png"); 
        $("#"+currentActionType+" div").removeClass("actiontype-selected");
        $("#"+currentActionType+" div").addClass("actiontype");  
    }  
    //更改并高亮显示
    currentActionType = e.currentTarget.id;
    tagging = e.currentTarget.dataset.tagging;
    if (app.globalData.isDebug) console.log("User::ChangeActionType change action type.",currentActionType,tagging);
    if(currentActionType.trim().length>0){
        $("#"+currentActionType+" img").attr("src","images/"+currentActionType+"-selected.png"); 
        $("#"+currentActionType+" div").removeClass("actiontype");
        $("#"+currentActionType+" div").addClass("actiontype-selected");  
    } 

    //跳转到相应页面
    window.location.href = currentActionType+".html";
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
      window.location.href = "index.html?id="+currentPerson;
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
function insertItem(){
    // 加载历史行为
    var actionItem = items[num-1];
    //检查是否还有，如果没有则显示已完成
    if(!actionItem){
      shownomore(true);
      return;
    }
    //隐藏no-more-tips
    $("#no-results-tip").toggleClass("no-result-tip-hide",true);
    $("#no-results-tip").toggleClass("no-result-tip-show",false); 

    // 加载内容
    var item = actionItem.item;
    console.log("Favorite::insertItem add item to html.",num,item);
    var image = "<img src='"+item.images[0].replace(/\.avif/,'')+"' width='60px' height='60px'/>"
    var tagTmpl = "<a class='itemTagTiny' href='index.html?keyword=__TAGGING'>__TAG</a>";
    var tags = "<div class='itemTagging'>";
    tags += "<div class='itemTagging-summary'>";
    tags += "<a class='itemTagPrice' href='#'>"+(item.price.currency?item.price.currency:"¥")+item.price.sale+"</a>";
    if(item.price.coupon>0){//优惠信息
        tags += "<span class='couponTip'>券</span><span class='coupon' href='#'>"+item.price.coupon+"</span>";
    }      
    var tagTmplBlank = "<a class='itemTagBlank' href='index.html?keyword=__TAGGING'>__TAG</a>";
    tags += tagTmplBlank.replace("__TAGGING",item.distributor.name).replace("__TAG",item.distributor.name);
    tags += "</div>";
    tags += htmlItemProfitTags(item);//profit标签
    tags += "<div class='itemTagging-list'>";
    var taggingList = [];
    if(item.tagging && item.tagging.length>0){
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
    tags += "</div>";
    //var tags = "<span class='title'><a href='info.html?category="+category+"&id="+item._key+"'>"+item.title+"</a></span>"
    var title = "<div class='feed-item-title'>"+item.title+"</div>"
    $("#waterfall").append("<li><div class='feed-separator' style='border-radius:0'></div>"+htmlActionSummary(actionItem)+"<div class='feed-item' data='"+item._key+"'><div class='feed-item-logo'>" + image +"</div><div class='feed-item-tags'>" +title + tags+ "</div></li>");
    num++;

    //注册事件
    $("div[data='"+item._key+"']").click(function(){
        //跳转到详情页面
        window.location.href = "../info2.html?id="+item._key;
    });

    // 表示加载结束
    showloading(false);
    loading = false;    
    num++;  
}

function htmlActionSummary(actionItem){
  var currentPersonObj = persons[personKeys.indexOf(currentPerson)];
  console.log("currentPersonObj",currentPersonObj);
  var html = "";
  html += "<div class='action-item'>";
  html += "<div class='action-person-logo'><img src='"+(actionItem.user&&actionItem.user.avatarUrl?actionItem.user.avatarUrl:currentPersonObj.avatarUrl)+"' width='20px' height='20px'/></div>";//logo
  html += "<div class='action-person-name'>"+(actionItem.user&&actionItem.user.nickName?actionItem.user.nickName:currentPersonObj.nickName)+"</div>";//name
  html += "<div class='action-person-time'>"+getDateDiff(actionItem.timestamp)+"</div>";//time
  html += "<div class='action-person-type'>"+(actionTypes[actionItem.action]?actionTypes[actionItem.action]:actionItem.action)+"</div>";//action
  html += "</div>";
  return html;
}

function htmlItemProfitTags(item){ 
    var profitTags = "";
    if(util.hasBrokerInfo()){//如果是推广达人则显示佣金
        console.log("\n\n==profit==",item.profit);
        if(item.profit && item.profit.type=="3-party"){//如果已经存在则直接加载
          console.log("\n\n===3-party==");
          if(item.profit&&item.profit.order){
              profitTags += "<span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(item.profit.order*10)/10).toFixed(1)))+"</span>";
              if(item.profit&&item.profit.team&&item.profit.team>0.1)profitTags += "<span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(item.profit.team*10)/10).toFixed(1)))+"</span>";
          }else if(item.profit&&item.profit.credit&&item.profit.credit>0){
              profitTags += "<span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(item.profit.credit*10)/10).toFixed(0)))+"</span>";
          }
        }else if(item.profit && item.profit.type=="2-party"){//如果是2方分润则请求计算
            console.log("\n\n===2-party==");
            profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide'></div>";
            getItemProfit2Party(item);
        }else{//表示尚未计算。需要请求计算得到该item的profit信息
            console.log("\n\n===re-calculate==",item);
            profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide'></div>";
            getItemProfit(item);
        }
    }
    if(profitTags.trim().length>0){
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-show'>"+profitTags+"</div>";
    }else{
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide'></div>";
    }
    return profitTags;
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
        //updateItem(item);  //注意：需要进入索引，而不是直接修改原始数据     
    },"GET",data);
}


//查询佣金。2方分润。返回order/team/credit三个值
function getItemProfit2Party(item) {
    var data={
        source:item.source,
        price:item.price.sale,
        amount:item.profit.amount?item.profit.amount:0,
        category:item.categoryId?item.categoryId:""
    };
    console.log("try to query item profit -- 2 party",data);
    util.AJAX(app.config.sx_api+"/mod/commissionScheme/rest/profit-2-party", function (res) {
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
        //updateItem(item);  //注意：需要进入索引，而不是直接修改原始数据    
    },"GET",data);
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
    loadData();//重新加载数据
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

