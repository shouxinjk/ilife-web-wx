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
    if(args["id"]){
        currentPerson = args["id"]; //如果传入参数则使用传入值
    }
    if(args["filter"]){
        filter = args["filter"]; //如果传入参数则使用传入值：all、byBroker
    }

    $("body").css("background-color","#fff");//更改body背景为白色

    //加载达人信息
    loadBrokerInfo();

    loadPerson(currentPerson);//加载用户

    //注册切换：清单、个性化定制
    $("#mySolutionFilter").click(function(e){
        window.location.href = "solutions.html";
    });
    $("#myBoardFilter").click(function(e){
        window.location.href = "boards.html";
    });

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

    //注册点击创建按钮事件 ：直接提交创建一个清单，然后跳转到index.html
    $("#createBoardBtn").click(function(e){
        createBoard();
    });
    
    //修改过滤按钮文字
    if(filter=="all"){
        $("#filterBoardBtn").html("只看我的");
    }else{
        $("#filterBoardBtn").html("查看全部");
    }
    //过滤清单列表：仅显示自己的清单，或显示所有清单
    $("#filterBoardBtn").click(function(e){
        if(filter=="all"){
            window.location.href = "boards.html?filter=my";
        }else{
            window.location.href = "boards.html?filter=all";
        }
    });

    //注册分享事件
    registerShareHandler(); 
});

util.getUserInfo();//从本地加载cookie

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

function registerTimer(brokerId){
    currentBroker = brokerId;
    sxTimer = setInterval(function ()
    {
        console.log("Timer Boards::registerTimer start load boards Timer.");
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            console.log("Boards::registerTimer start load boards.");
            // 表示开始加载
            loading = true;
            showloading(true);

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                //loadItems();
                if(filter=="all"){
                    loadAllItems();
                }else{
                    //loadItemsByBroker();
                    loadItemsByOpenid();
                }

                //有用户操作则恢复计数器
                console.log("reset loop count.");
                sxLoopCount = 100;                
            }else{//否则使用本地内容填充
                insertItem();
            }
        }

        //计数器自减，到时即停止
        if(--sxLoopCount<0){
            unregisterTimer();
        }
    }, 300);
}

function unregisterTimer(){
    console.log("clear timer.");
    clearInterval(sxTimer);
}

//加载特定于达人的任务列表
function loadItemsByOpenid(){
    util.AJAX(app.config.sx_api+"/mod/board/rest/byOpenid/"+app.globalData.userInfo._key, function (res) {
        showloading(false);
        console.log("Broker::Boards::loadItems try to retrive boards by broker id.", res)
        if(res && res.count==0){//如果没有画像则提示，
            shownomore();
        }else{//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载具体条目
            var hits = res;
            for(var i = 0 ; i < hits.length ; i++){
                items.push(hits[i]);
            }
            insertItem();
        }
    }, "GET",{offset:(page.current+1)*page.size,size:page.size},{});
}

//加载特定于达人的清单：已废弃。改为根据openid获取
/**
function loadItemsByBroker(){
    util.AJAX(app.config.sx_api+"/mod/board/rest/boards/"+currentBroker, function (res) {
        showloading(false);
        console.log("Broker::Boards::loadItems try to retrive boards by broker id.", res)
        if(res && res.count==0){//如果没有画像则提示，
            shownomore();
        }else{//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载具体条目
            var hits = res;
            for(var i = 0 ; i < hits.length ; i++){
                items.push(hits[i]);
            }
            insertItem();
        }
    }, "GET",{offset:(page.current+1)*page.size,size:page.size},{});
}
//**/

//加载所有清单：用于推荐时使用
function loadAllItems(){
    util.AJAX(app.config.sx_api+"/mod/board/rest/all-boards", function (res) {
        showloading(false);
        console.log("Broker::Boards::loadItems try to retrive all boards.", res)
        if(res && res.count==0){//如果没有画像则提示，
            shownomore();
        }else{//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载具体条目
            var hits = res;
            for(var i = 0 ; i < hits.length ; i++){
                items.push(hits[i]);
            }
            insertItem();
        }
    }, "GET",{offset:(page.current+1)*page.size,size:page.size},{});
}

//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
    if(!item){
        shownomore(true);
        return;
    }

    if(item.logo)
        logo = item.logo;

    var image = "<img src='"+logo+"' style='width:60px;object-fit:cover;'/>";
    var title = "<div class='title' style='margin-bottom:5px;'>"+item.title+"</div>";
    var description = "<div class='description' style='margin-top:5px;'>"+item.description+"</div>";
    //tag区分是自由定制还是专家指南 
    var tags = "<div style='display:flex;'>";
    if(item.tags && item.tags.trim().length>0){
        item.tags.split(" ").forEach(function(tag){
            if(tag&&tag.trim().length>0)
                tags += "<span style='border-radius:10px;background-color:#514c49;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>"+tag+"</span>"; 
        });
    }
    tags += "</div>"; 

    var btns = "<div class='btns'><a href='#' style='font-size:12px;'>"+(item.byOpenid == userInfo._key?"编辑":"克隆")+"</a>&nbsp;<a href='board2-waterfall.html?id="+item.id+"' style='font-size:12px;'>分享海报</a>&nbsp;<a href='board2-material.html?id="+item.id+"' style='font-size:12px;'>分享图文内容</a></div>";
    if(item.byOpenid == userInfo._key){
        btns = "<div class='btns'><a href='index.html?keyword="+item.keywords+"&boardId="+item.id+"' style='font-size:12px;'>添加商品</a>&nbsp;<a href='#' style='font-size:12px;'>"+(item.byOpenid == userInfo._key?"编辑":"克隆")+"</a>&nbsp;<a href='board2-waterfall.html?id="+item.id+"' style='font-size:12px;'>分享海报</a>&nbsp;<a href='board2-material.html?id="+item.id+"' style='font-size:12px;'>分享图文内容</a>&nbsp;<span id='btnPush"+item.id+"' style='color:#E16531;font-size:12px;'>云推送</span></div>";
    }
    //仅在当前用户是达人时才显示按钮
    if(currentBroker&&currentBroker.trim().length>0){
        //显示按钮
    }else{
        btns = "";
    }
    $("#waterfall").append("<li><div class='task' data='"+item.id+"'><div class='task-logo'>" + image +"</div><div class='task-tags'>" +title+ tags +description+btns+"</div></li>");
    num++;

    //注册事件：进入board
    $("div[data='"+item.id+"']").click(function(){
        //判断当前用户是否是board创建用户
        /*
        if(item.byOpenid == userInfo._key){//如果是当前board创建用户，则直接跳转
            window.location.href = "boards-modify.html?id="+item.id;            
        }else{//否则，先克隆一个再编辑
            console.log("try to clone board.[boardId]"+item.id+"[brokerId]"+currentBroker);
            util.AJAX(app.config.sx_api+"/mod/board/rest/board/clone/"+item.id+"/"+currentBroker, function (res) {
                console.log("clone broker successfully.",res);
                //跳转到编辑界面
                window.location.href = "boards-modify.html?id="+res.data.id;    
            },"POST",null,{ "Content-Type":"application/json" });
        }
        //**/

        //直接跳转到详情界面
        window.location.href = "board2-waterfall.html?id="+item.id;  
    });
    //注册事件：云推送
    $("#btnPush"+item.id).click(function(){
        event.stopPropagation();//阻止触发跳转详情

        //推送到CK，同步发送到微信群
        wxGroups.forEach(function(wxgroup){
            saveFeaturedItem(getUUID(), broker.id, "wechat", wxgroup.id, wxgroup.name, "board", item.id, JSON.stringify(item), "pending");
        });   
        if(wxGroups.length>0){
            console.log("wxgroups synchronized.");
            siiimpleToast.message('推送已安排~~',{
              position: 'bottom|center'
            });             
        }else{
            console.log("no wxGroups.");
            siiimpleToast.message('还未开通云助手，请联系客服~~',{
              position: 'bottom|center'
            });          
        }

    });

    // 表示加载结束
    loading = false;
}

//根据达人ID加载活跃微信群
var wxGroups = [];//存储当前达人的微信群列表
function loadWxGroups(brokerId){
    console.log("try to load wx groups by brokerId.",brokerId);
    $.ajax({
        url:app.config.sx_api+"/wx/wxGroup/rest/listByBrokerId?brokerId="+brokerId,
        type:"get",        
        success:function(ret){
            console.log("===got wx groups===\n",ret);
            wxGroups = ret;
        }
    }); 
}
//存储featured item到ck
function saveFeaturedItem(eventId, brokerId, groupType, groupId, groupName,itemType, itemKey, jsonStr, status){
  var q = "insert into ilife.features values ('"+eventId+"','"+brokerId+"','"+groupType+"','"+groupId+"','"+groupName+"','"+itemType+"','"+itemKey+"','"+jsonStr+"','"+status+"',now())";
  console.log("try to save featured item.",q);
  jQuery.ajax({
    url:app.config.analyze_api+"?query="+encodeURIComponent(q),
    type:"post",
    //data:{},
    headers:{
      "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
    },         
    success:function(json){
      console.log("===featured item saved.===\n",json);
    }
  });    
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
            insertBroker(res.data);//显示达人信息
            loadWxGroups(res.data.id);//加载该达人的微信群
            registerTimer(res.data.id);//加载该达人的board列表
        }
    });
}

//显示没有更多内容
function shownomore(flag){
  if(flag){
    unregisterTimer();
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


//创建一个空白board并且跳转到首页，等待添加内容
function createBoard(){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    var authorName = app.globalData.userInfo && app.globalData.userInfo.nickName ?app.globalData.userInfo.nickName:"小确幸";
    var data = {
        broker:{
            id:currentBroker?currentBroker:"system"
        },
        byOpenid: app.globalData.userInfo._key,
        byNickname: app.globalData.userInfo.nickName,
        logo:"https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png",
        poster:JSON.stringify({}),
        article:JSON.stringify({}),          
        title:authorName?authorName+" 的推荐清单":"新推荐清单",
        description:"根据你的需求，我们精心挑选了以下清单，请查收",
        tags:"",
        keywords:""
    };
    util.AJAX(app.config.sx_api+"/mod/board/rest/board", function (res) {
        console.log("Broker::Board::AddBoard create board successfully.", res)
        if(res.status){
            console.log("Broker::Board::AddBoard now jump to home page for item adding.", res)
            /**
            var expDate = new Date();
            expDate.setTime(expDate.getTime() + (15 * 60 * 1000)); // 15分钟后自动失效：避免用户不主动修改            
            $.cookie('board', JSON.stringify(res.data), { expires: expDate, path: '/' });  //把编辑中的board写入cookie便于添加item
            //**/
            //提示已创建
            siiimpleToast.message('清单已创建，请添加条目~~',{
                  position: 'bottom|center'
                });    
            //前往首页
            setTimeout(function(){
              window.location.href = "index.html?boardId="+res.data.id;
            },1000);            
        }
    }, "POST",data,header);
}


//注册分享事件
function registerShareHandler(){
    //准备分享url，需要增加分享的 fromUser、fromBroker信息
    //var shareUrl = window.location.href.replace(/info2/g,"share");//需要使用中间页进行跳转
    var shareUrl = window.location.href;//通过中间页直接跳转到第三方电商详情页面
    console.log("target share url.",shareUrl);
    ////多站点处理：start//////////////////////////////////
    //由于不同平台通过不同站点，需要进行区分是shouxinjk.net还是biglistoflittlethings.com
    /*
    if(stuff&&stuff.source=="jd"){//如果是京东，则需要指明跳转到shouxinjk.net
        shareUrl += "&toSite=shouxinjk"; 
    }
    //**/
    ////多站点处理：end////////////////////////////////////

    $.ajax({
        url:app.config.auth_api+"/wechat/jssdk/ticket",
        type:"get",
        data:{url:window.location.href},//重要：获取jssdk ticket的URL必须和浏览器浏览地址保持一致！！
        //data:{url:shareUrl},//重要：获取jssdk ticket的URL必须和浏览器浏览地址保持一致！！
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
                //准备分享的描述：优先采用推荐语、其次tagging、再次tags
                var advice = "将多个商品放在一起，可以快速建立主题清单。";      
                var title = "小确幸商品清单";
                console.log("share title.",title);         
                //分享到朋友圈
                wx.onMenuShareTimeline({
                    title:title, // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png", // 分享图标
                    success: function () {
                        // do nothing
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:title, // 分享标题
                    desc:advice, // 分享描述
                    //desc:stuff&&stuff.tags?stuff.tags.join(" "):"Live is all about having a good time.", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // do nothing
                    }
                });  
                //分享到微博
                wx.onMenuShareWeibo({
                    title:title, // 分享标题
                    desc:advice, // 分享描述
                    //desc:stuff&&stuff.tags?stuff.tags.join(" "):"Live is all about having a good time.", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png", // 分享图标
                    success: function () {
                      // do nothing
                    }
                });                             
            });
        }
    })    
}