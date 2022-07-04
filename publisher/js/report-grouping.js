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
        //columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }
    var args = getQuery();//获取参数
    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });

    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["code"]){
        groupingCode = args["code"]; //互阅班车编号
    }    
    if(args["groupingName"]){
        groupingName = args["groupingName"]; //支持传入班车code
    }else{
        groupingName = new Date().getFullYear()+"-"+(new Date().getMonth()+1)+"-"+new Date().getDate()+" 互阅班车";//班车名称
    }  
    $("#groupingName").text(groupingName);
    if(args["groupingDesc"]){
        groupingDesc = args["groupingDesc"]; //支持传入班车code
    }else{
        groupingDesc = "发文上车，10秒有效阅读，结果自动统计";//班车描述
    }  

    if(args["id"]){
        currentPerson = args["id"]; //如果传入参数则使用传入值
    }
    if(args["filter"]){
        filter = args["filter"]; //如果传入参数则使用传入值：all、byBroker
    }
    if(args["byOpenid"]){
        byOpenid = args["byOpenid"]; //支持传入publisherOpenid
    }    

    $("body").css("background-color","#fff");//更改body背景为白色

    //加载达人信息
    loadBrokerInfo();

    loadPerson(currentPerson);//加载用户

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    }); 

    //取消充值
    $("#btnCancelCharge").click(function(e){
        $.unblockUI(); 
    });   

    //注册事件：刷新合集
    $("#reloadGrouping").click(function(){
        window.location.href = "articles-grouping.html?code="+groupingCode+"&groupingName="+groupingName;
    });
    //注册事件：跳转到报告查看页面
    $("#reloadReport").click(function(){
        window.location.href = window.location.href;
    });     
    //注册事件：查看全量数据
    $("#moreData").click(function(){
        window.location.href = "reads.html";
    });                   

    //加载班车阅读结果
    loadGroupingResult();   

    //注册分享事件
    registerShareHandler();    

});

util.getUserInfo();//从本地加载cookie

var byOpenid = null;
var groupingCode = "";
var groupingName = null;//班车名称
var groupingDesc = null;//班车描述

//设置默认logo
var logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var filter = "all";//my、all。数据查询规则：默认为查询全部

var items = [];//所有画像列表
var page = {
    size:10,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentBroker = null;
var broker = {};//当前达人

var sxTimer = null;
var sxStartTimestamp=new Date().getTime();//定时器如果超过2分
var sxLoopCount = 1000;//定时器运行100次即停止，即30秒

//优先从cookie加载达人信息
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
  currentBroker = broker.id;
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        userInfo = res;
        currentPerson = res._key;
        insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
        //loadData();
        loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
}

//更新Broker
function updateBroker(broker) {
    console.log("try to update broker.[broker]",broker);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/"+broker.id, function (res) {
        console.log("update broker successfully.",res);
    },"PUT",broker,{ "Content-Type":"application/json" });
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {
            $.cookie('sxBroker', JSON.stringify(res.data), {  path: '/' });     
            broker = res.data; 
            insertBroker(res.data);//显示达人信息
        }
    });
}

//显示没有更多内容
function shownomore(flag){
  if(flag){
    //unregisterTimer();
    $("#footer").toggleClass("footer-hide",false);
    $("#footer").toggleClass("footer-show",true);
  }else{
    $("#footer").toggleClass("footer-hide",true);
    $("#footer").toggleClass("footer-show",false);
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

/**
//通过mysql加载：由于缺失阅读者信息，废弃
//加载互阅结果列表
var groupingReads = [];//记录阅读结果明细
function loadGroupingResult(){
    //查询得到所有阅读明细
    $.ajax({
        url:app.config.sx_api+"/wx/wxReads/rest/grouping/"+groupingCode,
        type:"get",        
        success:function(res){
            console.log("got grouping reads.",res);
            groupingReads = res;
            showGroupingReads(); //显示到界面
            $("#loading").css("display","none");
            shownomore(true);
        }
    }) 
}

//将阅读结果显示到界面
//按照文章分别展示，然后按照阅读顺序展示
var articleReads = {};//阅读次数统计
function showGroupingReads(){
    //逐条显示
    groupingReads.forEach(function(item){
        console.log("try show grouping read.",item);

        //检查文章是否已有div
        if ($('#articleWrapper'+item.article.id).length <= 0) { //如果不存在则创建
            var articleWrapperHtml = "<div id='articleWrapper"+item.article.id+"'><div class='article-title' id='title"+item.article.id+"' style='font-size:12px;font-weight:bold;text-align:center;line-height:20px;border-bottom:1px solid silver;width:80%;margin:2px auto;'>"+item.article.title+"(1)</div></div>";
            $("#reportDiv").append(articleWrapperHtml);
            articleReads[item.article.id]=1;
        }else{
            articleReads[item.article.id]=articleReads[item.article.id]+1;
            $("#title"+item.article.id).text(item.article.title+"("+articleReads[item.article.id]+")");
        }
        //添加阅读明细
        var articleReadHtml = "<div class='article-read' style='font-size:12px;text-align:center;line-height:16px;'>"+item.updateDate+'&nbsp;&nbsp;'+item.broker.nickname+'&nbsp;&nbsp;'+item.readCount+"</div>";
        $("#articleWrapper"+item.article.id).append(articleReadHtml);

    });    
}
//**/

//加载阅读该文章的日志记录：限制10000条
function loadGroupingResult(){
    //查询阅读当前用户文章的事件列表
    var q = "select eventId,readerOpenid as openid,readerNickname as nickname,readerAvatarUrl as avatarUrl,articleId,articleTitle,readCount,ts from ilife.reads where grouping='"+groupingCode+"' order by ts limit 10000 format JSON";
    $.ajax({
        url:app.config.analyze_api+"?query="+q,
        type:"get",
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(res){
            console.log("got read events.", res)
            shownomore(true);
            if(res && res.rows==0){//如果没有则提示还没有阅读
                $("#loading").css("display","none");
                //提示没有任何结果
                siiimpleToast.message('亲，报告还没生成，请阅读几篇先~~',{
                  position: 'bottom|center'
                });
            }else{//否则显示到页面：简单列表展示
                groupingReads = res.data;
                showGroupingReads(); //显示到界面
                $("#loading").css("display","none");
            }            
        }
    }); 
}


//查询单篇文章阅读总数：累计阅读次数
var totalReads = {};//记录 articleId:totalReads
function countReadsTotal(articleId){
    $.ajax({
        url:app.config.analyze_api+"?query=select count(eventId) as totalCount from ilife.reads where articleId='"+articleId+"' format JSON",
        type:"get",
        //async:false,
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(res){
            console.log("Publisher::ReportGrouping::countReadsTotal try to retrive readme count.", res)
            if(res && res.rows==0){//无返回则直接忽略
                //do nothing
            }else{//如果大于0则更新到页面
                if(res.data[0].totalCount>0){
                    totalReads[articleId]=res.data[0].totalCount;
                }
            }
        }
    }); 
}

//将阅读结果显示到界面
//按照文章分别展示，然后按照阅读顺序展示
var articleReads = {};//阅读次数统计
function showGroupingReads(){
    //逐条显示
    groupingReads.forEach(function(item){
        //console.log("try show grouping read.",item);

        //检查文章是否已有div
        if ($('#articleWrapper'+item.articleId).length <= 0) { //如果不存在则创建
            //查询该文章累计阅读数
            //countReadsTotal(item.articleId);//此处不严格，未作回调处理，仅在下次组装显示时引用
            var articleWrapperHtml = "<div id='articleWrapper"+item.articleId+"'><div class='article-title' id='title"+item.articleId+"' style='font-size:12px;font-weight:bold;text-align:center;line-height:20px;border-bottom:1px solid silver;width:80%;margin:2px auto;'>"+item.articleTitle+"(1)</div></div>";
            $("#reportDiv").append(articleWrapperHtml);
            articleReads[item.articleId]=1;
        }else{
            articleReads[item.articleId]=articleReads[item.articleId]+1;
            if(totalReads[item.articleId] && totalReads[item.articleId] >= articleReads[item.articleId] ){//有累计值则一并显示
                $("#title"+item.articleId).text(item.articleTitle+"(班车:"+articleReads[item.articleId]+" 累计:"+totalReads[item.articleId]+")");
            }else{
                $("#title"+item.articleId).text(item.articleTitle+"("+articleReads[item.articleId]+")");
            }
        }
        //添加阅读明细
        var articleReadHtml = "<div class='article-read' style='font-size:12px;text-align:center;line-height:16px;'>"+item.ts+'&nbsp;&nbsp;'+item.nickname+'&nbsp;&nbsp;'+item.readCount+"</div>";
        $("#articleWrapper"+item.articleId).append(articleReadHtml);

    });    
}

//分享到微信群：直接构建互阅班车，便于统计结果
function registerShareHandler(){
    //准备分享url
    var startTime = new  Date().getTime();
    var shareUrl = window.location.href;//.split("?")[0];//.replace(/report/g,"articles-grouping");//目标页面将检查是否关注与注册
    /**
    shareUrl += "?code="+groupingCode;//code
    shareUrl += "&groupingName="+encodeURIComponent(groupingName);//groupingName
    shareUrl += "&timeFrom="+startTime;//默认从当前时间开始
    shareUrl += "&timeTo="+(startTime + 60*60*1000);//默认1小时结束
    //**/

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
                    title:"文章阅读报告", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"https://www.biglistoflittlethings.com/static/logo/grouping/report.png", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        //TODO: board分享当前不记录
                        /*
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                        //**/
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:"文章阅读报告", // 分享标题
                    desc:"进入查看明细数据，或继续参与阅读", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "https://www.biglistoflittlethings.com/static/logo/grouping/report.png", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                      //TODO:board分享当前不记录
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
