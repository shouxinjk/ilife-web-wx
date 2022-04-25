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
        window.location.href = "articles-grouping.html?code="+groupingCode;
    });
    //注册事件：跳转到报告查看页面
    $("#reloadReport").click(function(){
        window.location.href = window.location.href;
    });                   

    //加载班车阅读结果
    loadGroupingResult();   

});

util.getUserInfo();//从本地加载cookie

var byOpenid = null;
var groupingCode = "";

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
                siiimpleToast.message('亲，报告还没生成，请阅读先~~',{
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

//将阅读结果显示到界面
//按照文章分别展示，然后按照阅读顺序展示
var articleReads = {};//阅读次数统计
function showGroupingReads(){
    //逐条显示
    groupingReads.forEach(function(item){
        console.log("try show grouping read.",item);

        //检查文章是否已有div
        if ($('#articleWrapper'+item.articleId).length <= 0) { //如果不存在则创建
            var articleWrapperHtml = "<div id='articleWrapper"+item.articleId+"'><div class='article-title' id='title"+item.articleId+"' style='font-size:12px;font-weight:bold;text-align:center;line-height:20px;border-bottom:1px solid silver;width:80%;margin:2px auto;'>"+item.articleTitle+"(1)</div></div>";
            $("#reportDiv").append(articleWrapperHtml);
            articleReads[item.articleId]=1;
        }else{
            articleReads[item.articleId]=articleReads[item.articleId]+1;
            $("#title"+item.articleId).text(item.articleTitle+"("+articleReads[item.articleId]+")");
        }
        //添加阅读明细
        var articleReadHtml = "<div class='article-read' style='font-size:12px;text-align:center;line-height:16px;'>"+item.ts+'&nbsp;&nbsp;'+item.nickname+'&nbsp;&nbsp;'+item.readCount+"</div>";
        $("#articleWrapper"+item.articleId).append(articleReadHtml);

    });    
}



