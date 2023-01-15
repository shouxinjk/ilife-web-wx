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
    if(args["rankId"])rankId=args["rankId"];//从获取指定的排行榜ID
    //初始化瀑布流
    $('#waterfall').NewWaterfall({
        width: width-20,//1列
        //width: columnWidth,//动态列宽，当前为2列
        delay: 100,
    });

    $("body").css("background-color","#fff");//更改body背景为白色

    util.getUserInfo();//从本地加载cookie

    loadRank();//加载排行榜后将自动触发明细条目加载

    //注册点击事件：创建排行榜，直接跳转到评价页面，开始创建
    $("#createRankBtn").click(function(){
        window.location.href = "measures.html";     
    });            

    //加载broker信息
    loadBrokerInfo(); 
});

var width = 600;
var clientWidth = 600;

var rankId = null;

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

//临时用户
var tmpUser = "";
//优先从cookie加载达人信息
var broker = {
  id:"system"
};//当前达人
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
}

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

//加载排行榜定义
var rank=null;
var rankItems = [];
var categoryId = null;
var categoryName = null;
function loadRank(){
    $.ajax({
        url:app.config.sx_api+"/mod/rank/rest/rank/"+rankId,
        type:"get",
        //data:{categoryId:categoryId},
        success:function(ret){
            console.log("===got rank info===\n",ret);
            rank = ret.rank;
            categoryId = rank.category.id;
            categoryName = rank.category.name;
            if(ret.items)rankItems=ret.items;
            showRankInfo();//显示rank信息，包括排行规则
            loadFeeds();//加载排行明细

            //加载达人后再注册分享事件：此处是二次注册，避免达人信息丢失。
            registerShareHandler(); 
        }
    });     
}

//排行榜设置模板
var rankItemTpl = `
  <div class="element-item post-transition metal " id="rankItem__dimensionid" data-dimensionid="__dimensionid" data-priority="__priority" data-bgcolor="__bgcolor" style="background-color:__bgcolor">
    <h5 class="name" style="font-size:10px;">__name</h5>
    <p class="symbol" data-sort="__sort" id="sort__dimensionid">__sort</p>
    <p class="number">__weight</p>
  </div>
`;
var  colors = ['#8b0000', '#dc143c', '#ff4500', '#ff6347', '#1e90ff','#40e0d0','#0dbf8c','#9acd32','#32cd32','#228b22','#067633'];
var weightSum=0;//由于参与排行的维度数量会变化，需要重新计算
//显示排行榜规则列表，根据最新数据更新
function showRankInfo(){
  //基本信息
  $("#rankCategoryName").append(rank.category.name);
  $("#rankName").append(rank.name);
  $("#rankDesc").append(rank.description);
  if(rank.keyword){
    $("#rankKeyword").append(rank.keyword);
  }  
  //显示排行规则
  console.log("show rank items.",rankItems);
  $("#rankItems").empty();//先清空
  rankItems.forEach(function(rankItem){
    weightSum += rankItem.dimension.weight;
  });
  var i=0;
  rankItems.forEach(function(rankItem){
    var dimension = rankItem.dimension;
    var rankItemHtml = rankItemTpl;
    rankItemHtml = rankItemHtml.replace(/__dimensionid/g,dimension.id);
    rankItemHtml = rankItemHtml.replace(/__name/g,dimension.name);
    rankItemHtml = rankItemHtml.replace(/__priority/g,rankItem.priority);
    rankItemHtml = rankItemHtml.replace(/__sort/g,(i+1));
    rankItemHtml = rankItemHtml.replace(/__weight/g,Number((dimension.weight/weightSum*100).toFixed(0))+"%");
    rankItemHtml = rankItemHtml.replace(/__bgcolor/g,colors[i]);//使用缓存颜色
    $("#rankItems").append(rankItemHtml);
    //根据priority调整sort显示及背景颜色
    if(rankItem.priority<0){
      $("#sort"+dimension.id).empty();
      $("#sort"+dimension.id).append("-");   
      
      $("#rankItem"+dimension.id).css("background","silver"); 
    }
    i++;
  });
  if(rankItems.length>5){//在指标过多时，调整高度
    $(".header").css("min-height","200px");
  }
}

var sxInterval = null;
function loadFeeds(){
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
    var imgSrc = item.logo?item.logo.replace(/\.avif/g,""):item.images[0].replace(/\.avif/g,"");
    var img = new Image();
    img.src = imgSrc;
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算
    //console.log("orgwidth:"+orgWidth+"orgHeight:"+orgHeight+"width:"+imgWidth+"height:"+imgHeight);
    var image = "<img src='"+imgSrc+"' width='"+imgWidth+"' height='"+imgHeight+"'/>"
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

    //价格
    var priceStr = "";
    if(item.price.bid && item.price.bid>item.price.sale){
      priceStr += "<div style='text-decoration: line-through;color:grey;'>"+item.price.bid+"</div>";
    }    
    priceStr += "<div style='color:darkred;'>" + (item.price.currency?item.price.currency:"￥")+item.price.sale + "</div>";

    //排序：对于前三名需要特殊处理
    var sortStyle = "";
    if(num<4)
      sortStyle="font-size:120%;font-weight:bold;color:#F54E4D;"
    else
      sortStyle="font-size:80%;font-weight:bold;"


    //得分：通过脚本计算： _score*sum(priority<sup>-0.75*weight/sum(weight)*score)/n
    //TODO 当前为前端计算，需要调整为由ES自动完成脚本评分

    /**
    if(item.price.coupon){
      priceStr += "<div style='text-decoration: color:orange;'>"+item.price.coupon+"</div>";
    }
    //**/

    var metaCategory = "";
    if(item.meta&&item.meta.categoryName){
        metaCategory = "<div class='title'>"+item.meta.categoryName+"</div>"
    }
    var title = "<div class='title' style='font-size:12px;line-height: 14px;overflow: hidden; text-overflow: ellipsis;display: -webkit-box;-webkit-line-clamp: 4;-webkit-box-orient: vertical;'>"+item.distributor.name+" "+item.title+"</div>"
    $("#waterfall").append("<li><div id='"+item._key+"' style='display:flex;flex-direct:row;width:96%;height:50px;'>" 
        + "<div style='width:10%;margin:auto;"+sortStyle+"'>"+ num +"</div>"      
        + "<div style='width:15%;margin:auto;'>"+ image +"</div>"
        + "<div style='width:40%;margin:auto 0px;'>"+ title +"</div>"
        + "<div style='width:20%;margin:auto 0px;font-size:12px;font-weight:bold;text-align:center;'>"+ priceStr +"</div>"
        + "<div style='width:15%;margin:auto 0px;text-align:center;font-size:20px;font-weight:bold;' id='score"+item._key+"'></div>"
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
            console.log("===calculate item score===\n",itemScore);
            //计算得分：_score*sum(priority<sup>-0.75*weight/sum(weight)*score)/n
            var score = 0;
            var sort = 1;
            rankItems.forEach(function(rankItem){
              score += Math.pow(sort, -0.75) * rankItem.weight/weightSum * itemScore[rankItem.dimension.id]?itemScore[rankItem.dimension.id]:Math.random();
              sort ++ ;
            });
            score = score/rankItems.length*100;
            $("#score"+stuff._key).append(Number(score.toFixed(1)));
        }
    });   
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

function registerShareHandler(){
    //计算分享达人：如果当前用户为达人则使用其自身ID，如果当前用户不是达人则使用页面本身的fromBroker，如果fromBroker为空则默认为system
    var shareBrokerId = "system";//默认为平台直接分享
    if(broker&&broker.id){//如果当前分享用户本身是达人，则直接引用其自身ID
        shareBrokerId=broker.id;
    }else if(fromBroker && fromBroker.trim().length>0){//如果当前用户不是达人，但页面带有前述达人，则使用前述达人ID
        shareBrokerId=fromBroker;
    }
    //计算分享用户：如果是注册用户则使用当前用户，否则默认为平台用户
    var shareUserId = "system";//默认为平台直接分享
    if(tmpUser&&tmpUser.trim().length>0){//如果是临时用户进行记录。注意有时序关系，需要放在用户信息检查之前。
        shareUserId = tmpUser;
    }
    if(app.globalData.userInfo && app.globalData.userInfo._key){//如果为注册用户，则使用当前用户
        shareUserId = app.globalData.userInfo._key;
    }

    //准备分享url，需要增加分享的 fromUser、fromBroker信息
    var shareUrl = window.location.href.replace(/measures/g,"share");//需要使用中间页进行跳转
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;        
    }
    //添加categoryId
    if(categoryId && categoryId.trim().length>0){
      shareUrl += "&categoryId="+categoryId;
    }
    shareUrl += "&origin=measures";//添加源，表示是一个列表页分享

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
                   // 'onMenuShareTimeline', 'onMenuShareAppMessage','onMenuShareQQ', 'onMenuShareWeibo', 'onMenuShareQZone',
                  'updateAppMessageShareData',
                  'updateTimelineShareData',
                  'onMenuShareAppMessage',
                  'onMenuShareTimeline',
                  'chooseWXPay',
                  'showOptionMenu',
                  "hideMenuItems",
                  "showMenuItems",
                  "onMenuShareTimeline",
                  'onMenuShareAppMessage'                   
                ] // 必填，需要使用的JS接口列表
            });
            wx.ready(function() {
                // config信息验证后会执行ready方法，所有接口调用都必须在config接口获得结果之后，config是一个客户端的异步操作，所以如果需要在页面加载时就调用相关接口，
                // 则须把相关接口放在ready函数中调用来确保正确执行。对于用户触发时才调用的接口，则可以直接调用，不需要放在ready函数中。
                //分享到朋友圈
                wx.onMenuShareTimeline({
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        //TODO: solution分享当前不记录
                        /*
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                        //**/
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    desc:"完整的评价体系，全面的数据，发现更多更真实的信息", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                      //TODO:solution分享当前不记录
                      /**
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微信",res);
                        }); 
                        //**/
                    }
                });   
                //分享到朋友圈
                wx.updateTimelineShareData({
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        //TODO: solution分享当前不记录
                        /*
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                        //**/
                    },
                });
                //分享给朋友
                wx.updateAppMessageShareData({
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    desc:"完整的评价体系，全面的数据，发现更多更真实的信息", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                      //TODO:solution分享当前不记录
                      /**
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微信",res);
                        }); 
                        //**/
                    }
                });                          
            });
        }
    })    
}
