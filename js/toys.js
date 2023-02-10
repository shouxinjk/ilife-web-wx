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

    //显示加载状态
    //showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["from"]){
        from = args["from"]; //需要修改的用户ID
    }   
    if(args["fromBroker"]){
        fromBrokerId = args["fromBroker"]; //获取分享brokerId
    }       
    if(args["id"]){
        currentPersonId = args["id"]; //需要修改的用户ID
    }
    if(args["personaId"]){
        currentPersonaId = args["personaId"]; //初次设置时，默认使用persona属性填充
    }

    $("body").css("background-color","#fff");//更改body背景为白色
    /**
    if(currentPersonaId&&currentPersonaId.trim().length>0){//如果有personaId，是首次设置，需要读取persona属性作为默认显示。
        loadPersona(currentPersonaId);
    }else{//否则直接读取user信息
        loadPerson(currentPersonId);//加载需要修改的用户信息，其中需要判定 person是否已经设置有画像，如果未设置，则跳转到画像选择页面
        if(currentPersonId != userInfo._key){//如果是编辑其他用户则同时显示关系
            console.log("try to load connection.");
            loadConnection();
        }
    }
    //**/

    loadPerson(currentPersonId);//加载需要修改的用户信息，其中需要判定 person是否已经设置有画像，如果未设置，则跳转到画像选择页面
    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        window.location.href = $(this).data("target");
    });     

    //加载默认设置，获取注册上级达人
    loadDefaultSettings();

    //装载贡献度列表
    loadCredits();

    //装载收益提示列表
    showMoneyTipList();

    //注册充值事件：显示充值表单
    $("#btnCharge").click(function(){
        loadPointProducts();
    });
    
    //注册事件：关闭浮出表单
    $(".btnNo").click(function(){     
        $.unblockUI(); //直接取消即可
    });   

    //注册事件：发送prompt
    $("#btnSendPrompt").click(function(){
        sendPrompt();
    });

    //显示第一条对话
    showCompletionProgress();
    showCompletion("ChatGPT是一款人工智能机器人，能够通过学习和理解人类语言来进行对话，也是当下最火热🔥的话题。随便说点什么吧"); 

});

util.getUserInfo();//从本地加载cookie

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有画像列表
var page = {
    size:20,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var from = "my";//可选值为my/connections,默认认为是自己修改自己

var currentPersonId = app.globalData.userInfo?app.globalData.userInfo._key:null;//默认为当前登录用户
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentPersonaId = null;
var currentPersona = {};
var currentConnection = null;

var fromBrokerId = null;//记录分享达人ID，有用户加入时将增加points
var currentPerson = {};//默认当前修改用户为空

var broker = {};//记录broker，注意可能为空

//用户输入内容模板：气泡在左侧，头像在右侧
var promptTpl=`
    <div style="display:flex;flex-direction:row;width:100%;margin-bottom:8px;">
        <div style="width:14%;">
            &nbsp;&nbsp;
        </div>     
        <div style="width:76%">
            <div class="chat-bubble chat-bubble-right">
                __prompt
            </div>
        </div>
        <div style="width:12%;">
            <img src="__avatar" style="width:80%;object-fit:cover;border-radius:3px;margin-left:5px;"/>
        </div>        
    </div>
`;
//ChatGPT回复内容模板：头像在左侧，气泡在由侧
var completionTpl=`
    <div style="display:flex;flex-direction:row;width:100%;margin-left:2%;margin-bottom:8px;">
        <div style="width:12%">
            <img src="images/avatar/chatgpt.jpeg" style="width:80%;object-fit:cover;border-radius:3px;"/>
        </div>    
        <div style="width:76%">
            <div id="completion__uuid" class="chat-bubble chat-bubble-left">
            </div>         
        </div>  
        <div style="width:14%;">
            &nbsp;&nbsp;
        </div>           
    </div>
`;
//显示prompt：将用户输入的prompt显示到界面
function showPrompt(text){
    var html = promptTpl.replace(/__avatar/g,app.globalData.userInfo.avatarUrl).replace(/__prompt/g,text);
    $("#Center").append(html); 
    var scrollHeight = $('#Center').prop("scrollHeight");
    $('#Center').scrollTop(scrollHeight,200);
}
//显示completion：将ChatGPT的回复显示到界面
var pendingCompletionUUID = null;
function showCompletionProgress(){
    pendingCompletionUUID = getUUID();
    var html = completionTpl.replace(/__uuid/g,pendingCompletionUUID);
    $("#Center").append(html);    
    $("#completion"+pendingCompletionUUID).append("<img src='images/loading.gif'/>");//显示提示图标
    var scrollHeight = $('#Center').prop("scrollHeight");
    $('#Center').scrollTop(scrollHeight,200);    
}
function showCompletion(text){
    $("#completion"+pendingCompletionUUID).empty();//清空进度显示
    $("#completion"+pendingCompletionUUID).append(text);//显示得到的文字
    pendingCompletionUUID = null;
    var scrollHeight = $('#Center').prop("scrollHeight");
    $('#Center').scrollTop(scrollHeight,200);    
}

//检查并发送prompt到后端请求应答
function sendPrompt(){
    //检查是否完成授权
    if(!broker || !broker.nickname){
        siiimpleToast.message('请点击顶部立即开始使用~~',{
              position: 'bottom|center'
            });         
        return;        
    }    
    //检查是否还有回复在等待
    if(pendingCompletionUUID){
        siiimpleToast.message('还在回答上一个问题哦，稍等哈~~',{
              position: 'bottom|center'
            });         
        return;
    }
    //检查是否有虚拟豆
    if(!broker || !broker.points || broker.points<1){
        siiimpleToast.message('体验次数已用完，可打赏或邀请继续体验~~',{
              position: 'bottom|center'
            });         
        return;        
    }
    //检查是否有输入文字
    var prompt = $("#promptBox").val();
    if(!prompt || prompt.trim().length==0){
        siiimpleToast.message('说点什么吧~~',{
              position: 'bottom|center'
            });         
        return;        
    }
    //显示到界面
    showPrompt(prompt.trim());
    showCompletionProgress();
    $("#promptBox").val("");
    //发送请求并等待回复
    console.log("try to register broker.");
    $.ajax({
        url:app.config.sx_api+"/rest/api/chatgpt",
        type:"post",
        data:JSON.stringify({
            prompt: prompt.trim(),
            broker:{
                id: broker.id
            },
            openid: app.globalData.userInfo._key
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        timeout: 120000,//设置超时时间为120s
        success:function(res){
            console.log("got answer.",res);
            showCompletion(res.text.replace(/\n/g,"<br/>"));
            //扣除虚拟豆：直接前端操作
            if(broker){
                broker.points = broker.points-1;
                $("#sxCredit").empty();
                $("#sxCredit").append("贡献度："+(broker.points>0?broker.points:0));
                //如果小于0则提示充值
                if(broker.points<1){
                    console.log("no points remain.");
                    showCompletionProgress();
                    showCompletion("体验次数已经用完了哦，欢迎打赏继续体验。也可以邀请获得体验次数，每邀请一人增加5次😘😘");
                }
            }
        },
        error:function(){
            console.log("chatgpt failed.");
            showCompletion("🤯🤯ChatGPT抱怨问题有点多，请稍等再体验哦~~");            
        },
        complete:function(XHR,TextStatus){
            if(TextStatus=='timeout'){ //超时执行的程序
                console.log("chatgpt timeout.");
                showCompletion("😴😴问题有点多，排队有点久，换一个试试吧~~"); 
            }
        }
    });     
}

//加载默认值设置，包含默认父级broker_id，注册时使用
var defaultSettings = {};
function loadDefaultSettings(){
    util.AJAX(app.config.sx_api+"/sys/dict/rest/byType", function (res) {
        showloading(false);
        console.log("load dict values.", res)
        if (res && res.length>0) {//加载类型列表
            res.forEach(function(item){
                defaultSettings[item.value]=item.label;
            });         
        }else{//如果没有则提示，
            console.log("cannot load ditc by type: sx_default ");           
        }
    }, 
    "GET",
    {type:"sx_default"},
    {});
}

//加载并显示贡献度列表
var creditTpl = `
    <div style="display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:center;align-items:center;">
        <div style="width:12%;text-align:center;">
            <img src="images/credit/__type.png" style="width:36px;height:36px;__greyscale"/>
        </div>
        <div style="width:15%;text-align:center;font-size:18px;font-weight:bold;color:#F54E4D">
            __points
        </div>        
        <div style="width:73%;">
            <div style="font-size:12px;font-weight:bold;line-height:16px;text-align:left;">
                __name
            </div>
            <div style="font-size:10px;line-height:12px;font-weight:normal;text-align:left;">
                __desc
            </div>         
        </div>        
    </div>
`;
function loadCredits(){
    util.AJAX(app.config.sx_api+"/mod/credit/rest/credits", function (res) {
        console.log("load credits.", res)
        if (res && res.length>0) {//加载类型列表
            res.forEach(function(credit){   
                if(credit.points>0){
                    var html  = creditTpl.replace(/__points/g,credit.points).replace(/__type/g,credit.type).replace(/__name/g,credit.name).replace(/__desc/g,credit.description)
                    $("#creditList").append(html);
                }
            });     
        }else{//如果没有则提示，
            console.log("cannot load ditc by type: sx_default ");           
        }
    }, 
    "GET",
    {},
    {});
}

//显示所有收益提示列表
var moneyTips = [
    {type:"order",name:"直接订单收益",desc:"分享商品并形成订单后获取相应的收益"},
    {type:"team",name:"团队订单收益",desc:"团队成员及再下级团队成员形成订单后获取相应收益，团队越大收益越多"},
    {type:"credit",name:"贡献度收益",desc:"按照贡献度大小获取相应的贡献度收益"},
    {type:"notify",name:"订单通知",desc:"直接订单或团队订单形成后将收到公众号通知消息"},
    {type:"settle",name:"结算周期",desc:"按月结算，每月25日结算上月收益"},
    {type:"withdraw",name:"提现",desc:"金额大于50元即可提现，直接通过微信操作完成"},
    {type:"invoice",name:"发票",desc:"机构伙伴可提前开具发票，在提现前提交发票即可"},

];
var moneyTipTpl = `
    <div style="display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;margin:5px 0;">
        <div style="width:20%;text-align:center;">
            <img src="images/money/__type.png" style="width:36px;height:36px;"/>
        </div>
        <div style="width:80%;">
            <div style="font-size:12px; font-weight:bold;line-height:14px;text-align:left;">
                __name
            </div>
            <div style="font-size:10px;font-weight:normal;line-height:12px;text-align:left;">
                __desc
            </div>         
        </div>        
    </div>
`;
function showMoneyTipList(){
    moneyTips.forEach(function(tip){ 
        var html  = moneyTipTpl.replace(/__type/g,tip.type).replace(/__name/g,tip.name).replace(/__desc/g,tip.desc)
        $("#moneyTipList").append(html);
    });
}

//注册生活家：默认自动注册
function registerBroker(){
    var parentBrokerId = defaultSettings.broker_id;
    if(fromBrokerId&&fromBrokerId.trim().length>0){
        parentBrokerId = fromBrokerId;
    }
    
    //同时更新broker的nickname及avatarUrl：由于微信不能静默获取，导致broker内缺乏nickname及avatarUrl
    console.log("try to register broker.");
    $.ajax({
        url:app.config.sx_api+"/mod/broker/rest/"+parentBrokerId,
        type:"post",
        data:JSON.stringify({
            nickname: app.globalData.userInfo.nickname,
            avatarUrl:app.globalData.userInfo.avatarUrl,
            openid: app.globalData.userInfo._key
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        success:function(res){
            console.log("register success.",res);
            /**
            siiimpleToast.message('已开放生活家权限~~',{
                  position: 'bottom|center'
                });   
            //**/           
            widow.location.href = "toys.html";//新注册后直接刷新     
            /**
            //微信不支持进入分享页后直接获取UserInfo，需要再次请求授权得到
            var shareUrl = window.location.href.replace(/toys/g,"share");//需要使用中间页进行跳转
            if(shareUrl.indexOf("?")>0)
                shareUrl += "&origin=toys";//添加源，表示是一个列表页分享      
            else
                shareUrl += "?origin=toys";//添加源，表示是一个列表页分享      
            window.location.href = shareUrl;      
            //**/             
        },
        error:function(){
            console.log("register failed.",app.globalData.userInfo);
            /**
            siiimpleToast.message('糟糕，好像出错了，麻烦联系我们~~',{
                  position: 'bottom|center'
                });    
            //**/           
        }
    });     
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        //userInfo = res;
        currentPerson = res;
        insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
        //showPerson(currentPerson);//显示设置的用户表单
        loadBrokerByOpenid(userInfo._key);//根据当前登录用户openid加载broker信息
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
            broker = res.data;
            if(!broker.badges)
                broker.badges=[];
            insertBroker(broker);//显示达人信息
            registerShareHandler();//注册分享事件

            /**
            if(!broker.nickname){ //由于微信不支持从分享页直接进入授权，初次进入后虽然完成静默注册，但无法获取userinfo，需要再次触发授权得到，多跳转一次oauth授权
                var shareUrl = window.location.href.replace(/toys/g,"share");//需要使用中间页进行跳转
                if(shareUrl.indexOf("?")>0)
                    shareUrl += "&origin=toys";//添加源，表示是一个列表页分享      
                else
                    shareUrl += "?origin=toys";//添加源，表示是一个列表页分享      
                window.location.href = shareUrl;          
            }else{
                insertBroker(broker);//显示达人信息
                registerShareHandler();//注册分享事件
            }
            //**/
        }else{ //不是达人则显示用户信息
            registerBroker();//如果是接受邀请则注册达人
            loadBadges();//不传递broker信息，仅显示用户勋章
            //仅显示提示内容
            var locks = ["broker","tailor","expert","scholar"];
            locks.forEach(function(lock){
                $("#"+lock+"Btns").css("display","none");
                $("#"+lock+"Tips").css("display","block");
                $("#"+lock+"JoinBtn").css("display","block");
            });            
        }
    });
}

//显示没有更多内容
function shownomore(flag){
  if(flag){
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

var shareTitle = "立即体验ChatGPT";
var shareDesc = "ChatGPT是一款人工智能机器人，能够通过学习和理解人类语言来进行对话，是当下最火热🔥的话题";
var shareLogo = "https://www.biglistoflittlethings.com/ilife-web-wx/images/avatar/chatgpt.jpeg";
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
    if(app.globalData.userInfo && app.globalData.userInfo._key){//如果为注册用户，则使用当前用户
        shareUserId = app.globalData.userInfo._key;
    }

    //准备分享url，需要增加分享的 fromUser、fromBroker信息
    var shareUrl = window.location.href.replace(/toys/g,"share");//需要使用中间页进行跳转
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromBroker="+shareBrokerId;
        //shareUrl += "&fromUser="+shareUserId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromBroker="+shareBrokerId;                
        //shareUrl += "&fromUser="+shareUserId;
    }
    shareUrl += "&origin=toys";//添加源，表示是一个列表页分享

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
                    //'onMenuShareTimeline', 'onMenuShareAppMessage','onMenuShareQQ', 'onMenuShareWeibo', 'onMenuShareQZone',
                   'checkJsApi',
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
                wx.updateTimelineShareData({
                    title:shareTitle, // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:shareLogo, // 分享图标
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
                    title:shareTitle, // 分享标题
                    desc:shareDesc, // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: shareLogo, // 分享图标
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
                wx.onMenuShareTimeline({
                    title:shareTitle, // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:shareLogo, // 分享图标
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
                    title:shareTitle, // 分享标题
                    desc:shareDesc, // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: shareLogo, // 分享图标
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
