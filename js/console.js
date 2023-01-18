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

    //注册事件：加入或升级 生活家
    $("#brokerJoinBtn").click(function(){
        if($(this).data("action")=="join"){
            registerBroker();//直接注册就完事了
        }else if($(this).data("action")=="upgrade"){
            //TODO 支持充值升级
            siiimpleToast.message('尚未开放，敬请期待~~',{
                  position: 'bottom|center'
                });              
        }else{
            console.log("wrong action type.");
        }
    });

    //注册事件：加入或升级 定制师
    $("#tailorJoinBtn").click(function(){
        if($(this).data("action")=="join"){
            //申请tailor勋章
            showCandidateForm("tailor", "定制师");
        }else if($(this).data("action")=="upgrade"){
            //TODO 支持充值升级
            siiimpleToast.message('尚未开放，敬请期待~~',{
                  position: 'bottom|center'
                });              
        }else{
            console.log("wrong action type.");
        }
    });

    //注册事件：加入领域达人
    $("#expertJoinBtn").click(function(){
        showCandidateForm("expert", "领域达人");
    });

    //注册事件：加入专家学者
    $("#scholarJoinBtn").click(function(){
        showCandidateForm("scholar", "专家学者");
    });

    //注册事件：关闭浮出表单
    $(".btnNo").click(function(){     
        $.unblockUI(); //直接取消即可
    });    

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

var currentPerson = {};//默认当前修改用户为空

var broker = {};//记录broker，注意可能为空

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
                var html  = creditTpl.replace(/__points/g,credit.points?creditpoints:15).replace(/__type/g,credit.type).replace(/__name/g,credit.name).replace(/__desc/g,credit.description)
                $("#creditList").append(html);
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

//注册生活家
function registerBroker(){
    //同时更新broker的nickname及avatarUrl：由于微信不能静默获取，导致broker内缺乏nickname及avatarUrl
    console.log("try to register broker.");
    $.ajax({
        url:app.config.sx_api+"/mod/broker/rest/"+defaultSettings.broker_id?defaultSettings.broker_id:"77276df7ae5c4058b3dfee29f43a3d3b",
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
            siiimpleToast.message('已开放生活家权限~~',{
                  position: 'bottom|center'
                });              
            widow.location.href = "console.html";//刷新页面
        },
        error:function(){
            console.log("register failed.",app.globalData.userInfo);
            siiimpleToast.message('糟糕，好像出错了，麻烦联系我们~~',{
                  position: 'bottom|center'
                });            
        }
    });     
}

//显示申请表单：输入姓名、公司、职位、介绍
function showCandidateForm(badgeType, badgeName){
    console.log("show candidate form.");  
    //设置默认值
    $("#candidateTip").empty();
    $("#candidateTip").append("欢迎加入"+badgeName);

    //显示表单
    $.blockUI({ message: $('#candidateform'),
        css:{ 
            padding:        10, 
            margin:         0, 
            width:          '80%', 
            top:            '20%', 
            left:           '10%', 
            textAlign:      'center', 
            color:          '#000', 
            border:         '1px solid silver', 
            backgroundColor:'#fff', 
            cursor:         'normal' 
        },
        overlayCSS:  { 
            backgroundColor: '#000', 
            opacity:         0.7, 
            cursor:          'normal' 
        }
    }); 

    $("#btnSaveCandidate").click(function(){//提交申请，等待审核
        //检查必填项：名称。排行规则在切换时已经检查
        if( !$("#candidateName2").val() || $("#candidateName2").val().trim().length ==0 ){
            siiimpleToast.message('名称为必填~~',{
              position: 'bottom|center'
            });                 
        }
        /**
        else if( !$("#candidateCompany2").val() || $("#candidateCompany2").val().trim().length ==0 ){
            siiimpleToast.message('公司或院校为必填~~',{
              position: 'bottom|center'
            });                 
        }else if( !$("#candidateJob2").val() || $("#candidateJob2").val().trim().length ==0 ){
            siiimpleToast.message('身份或职位为必填~~',{
              position: 'bottom|center'
            });                 
        }
        //**/
        else if( !$("#candidateDesc2").val() || $("#candidateDesc2").val().trim().length ==0 ){
            siiimpleToast.message('简介为必填~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to save candidate.");
            //领域专家、学者申请
            var categoryBadge = {
                broker:{ 
                    id: broker.id
                },
                badge:{
                    key: badgeType //默认申请领域专家
                },
                name: $("#candidateName2").val(),
                //company: $("#candidateCompany2").val(),
                //job: $("#candidateJob2").val(),
                description: $("#candidateDesc2").val()
            };          
            saveCandidateInfo(badgeName, categoryBadge);
        }
    });
}

//提交申请，等待审核
function saveCandidateInfo(badgeName, candidate){
    //保存申请
    console.log("try to save candidate info.",candidate);
    $.ajax({
        url:app.config.sx_api+"/mod/categoryBroker/rest/badge",
        type:"post",
        data:JSON.stringify(candidate),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save candidate done===\n",ret);
            if(ret.success){ 
                //发送通知
                sendCandidateMsgToWebhook(ret.data)
                //取消浮框，并刷新界面
                $.unblockUI(); //直接取消即可
                siiimpleToast.message('已提交，请留意公众号消息~~',{
                      position: 'bottom|center'
                    });                  
            }else{
              siiimpleToast.message('啊哦，出错了~~',{
                      position: 'bottom|center'
                    });    
            }
        }
    });
     
}
//发送信息到运营群：运营团队收到立即审核通知
function sendCandidateMsgToWebhook( candidate ){
    //推动图文内容到企业微信群，便于转发
    var msg = {
            "msgtype": "news",
            "news": {
               "articles" : [
                   {
                       "title" : candidate.badge.name+"申请，请审核",
                       "description" : candidate.description,
                       "url" : "https://www.biglistoflittlethings.com/ilife-web-wx/candidate.html?id="+candidate.id,
                       "picurl" : app.globalData.userInfo.avatarUrl
                   }
                ]
            }
        };

    //推送到企业微信
    console.log("\n===try to sent webhook msg. ===\n");
    $.ajax({
        url:app.config.wechat_cp_api+"/wework/ilife/notify-cp-company-broker",
        type:"post",
        data:JSON.stringify(msg),
        headers:{
            "Content-Type":"application/json"
        },        
        success:function(res){
            console.log("\n=== webhook message sent. ===\n",res);
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
        //检查是否有persona设置，如果没有则跳转到persona选择界面
        if((res.persona && res.persona._key) || !res.openId){//如果有persona则显示表单。注意：对于通过画像生成虚拟用户则直接显示表单，通过有无openId判断
            insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
            //showPerson(currentPerson);//显示设置的用户表单
            loadBrokerByOpenid(userInfo._key);//根据当前登录用户openid加载broker信息
        }else{//没有persona则提示先选择一个persona
            window.location.href = "user-choosepersona.html?id="+personId+"&refer=user";//refer=user表示设置后返回到user界面
        }
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
        }else{ //不是达人则显示用户信息
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

